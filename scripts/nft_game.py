"""Local-chain wallet authentication and mint vouchers, isolated from LLM calls."""
import copy
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import threading
import time
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]


class LocalNFT:
    def __init__(self, config=None):
        self.config = config or json.loads(Path(os.environ.get('CASPY_NFT_CONFIG', ROOT / 'data/nft-local.json')).read_text())
        self.node = shutil.which('node')
        if not self.node:
            raise RuntimeError('Use bash run-heist.sh --nft so Node is on PATH.')
        self.auth = {}
        self.challenges = {}
        self.lock = threading.Lock()
        self.call('check')

    def call(self, action, **values):
        try:
            result = subprocess.run([self.node, '--experimental-strip-types', str(ROOT / 'frontend/scripts/nft-bridge.mjs')],
                input=json.dumps(dict(action=action, config=self.config, **values)),
                capture_output=True, text=True, timeout=45)
        except subprocess.TimeoutExpired:
            raise RuntimeError('Local NFT operation timed out. Check Anvil.') from None
        try:
            data = json.loads(result.stdout)
        except ValueError:
            raise RuntimeError('Local NFT bridge unavailable. Check Node and the local chain.') from None
        if result.returncode or data.get('error'):
            raise ValueError(data.get('error', 'Local NFT operation failed.'))
        return data

    def nonce(self, token, body, origin):
        address = body.get('address', '')
        if not isinstance(address, str) or not re.fullmatch(r'0x[0-9a-fA-F]{40}', address) or body.get('chain_id') != 31337:
            raise ValueError('Connect a local chain 31337 wallet.')
        with self.lock:
            now = time.time()
            self.challenges = {k: v for k, v in self.challenges.items() if v['expires'] > now}
            if len(self.challenges) >= 1000:
                raise ValueError('Too many sign-in requests.')
            nonce = secrets.token_hex(16)
            self.challenges[token] = dict(nonce=nonce, address=address, origin=origin, expires=now+300)
            return {'nonce': nonce}

    def verify(self, token, body, origin):
        with self.lock:
            challenge = self.challenges.pop(token, None)
        if not challenge or challenge['expires'] < time.time() or challenge['origin'] != origin:
            raise PermissionError('Sign-in expired. Connect your wallet again.')
        message, signature = body.get('message'), body.get('signature')
        if not isinstance(message, str) or not isinstance(signature, str) or len(message) > 4096 or not re.fullmatch(r'0x[0-9a-fA-F]{130}', signature):
            raise ValueError('Invalid wallet signature.')
        result = self.call('verify', message=message, signature=signature, address=challenge['address'],
                           nonce=challenge['nonce'], domain=urlsplit(origin).netloc, origin=origin)
        # Rotate the cookie after authentication to prevent session fixation.
        authenticated = secrets.token_urlsafe(32)
        with self.lock:
            self.auth = {k: v for k, v in self.auth.items() if v['expires'] > time.time()}
            self.auth[authenticated] = dict(address=result['address'], expires=time.time()+21600)
        return authenticated, result

    def address(self, token):
        with self.lock:
            auth = self.auth.get(token)
        if not auth or auth['expires'] < time.time():
            raise PermissionError('Connect your wallet and sign in to continue.')
        return auth['address']

    def owner(self, token):
        return 'wallet:' + self.address(token).lower()

    def logout(self, token):
        with self.lock:
            self.auth.pop(token, None)
            self.challenges.pop(token, None)

    def voucher(self, games, ident, token):
        address = self.address(token)
        entry = games.owned(ident, self.owner(token))
        with entry['lock']:
            data = entry['data']
            if data['status'] not in ('won', 'lost'):
                raise ValueError('Finish your heist before claiming a collectible.')
            tier = 0 if data['status'] == 'won' else 1
            status = self.call('status', session_id=ident, to=address, tier=tier)
            if status.get('minted'):
                data.update(status)
                # Preserve the game result; mint status is a separate field.
                data['status'] = 'won' if tier == 0 else 'lost'
                games.persist()
                raise ValueError('This heist already minted its collectible.')
            cached = entry.get('voucher')
            if cached and int(cached['deadline']) > time.time()+60:
                return copy.deepcopy(cached)
            voucher = self.call('sign', session_id=ident, to=address, tier=tier,
                                nonce=str(secrets.randbits(128)), deadline=int(time.time())+86400)
            entry['voucher'] = voucher
            games.persist()
            return copy.deepcopy(voucher)

    def status(self, games, ident, token, tx_hash=None):
        address = self.address(token)
        entry = games.owned(ident, self.owner(token))
        with entry['lock']:
            data = entry['data']
            if data['status'] not in ('won', 'lost'):
                raise ValueError('This heist is not eligible for minting.')
            tx_hash = tx_hash or data.get('tx_hash')
            if tx_hash is not None and (not isinstance(tx_hash, str) or not re.fullmatch(r'0x[0-9a-fA-F]{64}', tx_hash)):
                raise ValueError('Invalid transaction hash.')
            result = self.call('status', session_id=ident, to=address, tier=0 if data['status'] == 'won' else 1,
                               **({'tx_hash': tx_hash} if tx_hash else {}))
            for key in ('minted', 'tx_hash', 'token_id', 'contract', 'chain_id'):
                if key in result:
                    data[key] = result[key]
            # Allow a fresh transaction after a reverted claim.
            if result['status'] == 'failed':
                data.pop('tx_hash', None)
            games.persist()
            return result
