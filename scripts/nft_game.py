"""Local-chain wallet authentication and mint vouchers, isolated from LLM calls."""
import copy
import hashlib
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
            raise RuntimeError('Use bash run.sh --nft so Node is on PATH.')
        self.auth = {}
        self.challenges = {}
        self.lock = threading.Lock()
        self.call('check')
        self.database = None

    def persist_sessions(self, database):
        """Persist only token digests; signature challenges remain short-lived."""
        self.database = database
        self.session_scope = f"{self.config['chain_id']}:{self.config['contract'].lower()}:{self.config['deployment_block_hash']}"
        with database.connect() as db:
            db.executescript('''CREATE TABLE IF NOT EXISTS wallet_sessions(
                token_hash TEXT PRIMARY KEY, address TEXT NOT NULL,
                scope TEXT NOT NULL, expires BIGINT NOT NULL);
                CREATE INDEX IF NOT EXISTS wallet_sessions_expiry ON wallet_sessions(expires);''')
            if database.postgres:
                db.execute('ALTER TABLE wallet_sessions ENABLE ROW LEVEL SECURITY')
                db.execute('REVOKE ALL ON wallet_sessions FROM PUBLIC, anon, authenticated')

    @staticmethod
    def token_hash(token):
        return hashlib.sha256(token.encode()).hexdigest()

    def save_session(self, token, address):
        expires = int(time.time()) + 21600
        if self.database is not None:
            with self.database.connect() as db:
                db.execute('DELETE FROM wallet_sessions WHERE expires <= ?', (int(time.time()),))
                db.execute('INSERT INTO wallet_sessions(token_hash,address,scope,expires) VALUES (?,?,?,?)',
                           (self.token_hash(token), address, self.session_scope, expires))
        else:
            with self.lock:
                self.auth = {k: v for k, v in self.auth.items() if v['expires'] > time.time()}
                self.auth[token] = dict(address=address, expires=expires)

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
        if not isinstance(address, str) or not re.fullmatch(r'0x[0-9a-fA-F]{40}', address) or body.get('chain_id') != self.config['chain_id']:
            raise ValueError('Connect a wallet on the configured candy chain.')
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
        self.save_session(authenticated, result['address'])
        self.logout(token)
        return authenticated, result

    def address(self, token):
        if self.database is not None:
            with self.database.connect() as db:
                auth = db.execute('SELECT address FROM wallet_sessions WHERE token_hash=? AND scope=? AND expires>?',
                                  (self.token_hash(token), self.session_scope, int(time.time()))).fetchone()
            if not auth:
                raise PermissionError('Connect your wallet and sign in to continue.')
            return auth['address']
        with self.lock:
            auth = self.auth.get(token)
        if not auth or auth['expires'] < time.time():
            raise PermissionError('Connect your wallet and sign in to continue.')
        return auth['address']

    def owner(self, token):
        return 'wallet:' + self.address(token).lower()

    def logout(self, token):
        if self.database is not None:
            with self.database.connect() as db:
                db.execute('DELETE FROM wallet_sessions WHERE token_hash=?', (self.token_hash(token),))
        with self.lock:
            self.auth.pop(token, None)
            self.challenges.pop(token, None)

    def voucher(self, games, ident, token):
        address = self.address(token)
        entry = games.owned(ident, self.owner(token))
        with entry['lock']:
            data = entry['data']
            if data['status'] != 'won':
                raise ValueError('Only an independently confirmed win earns a candy NFT.')
            commitments = self.candies.commitments(ident)
            status = self.call('status', session_id=ident, to=address, **commitments)
            if status.get('minted'):
                self.candies.mark_minted(ident, status['token_id'])
                raise ValueError('This heist already minted its candy.')
            cached = entry.get('voucher')
            if cached and 'imageHash' in cached and int(cached['deadline']) > time.time()+60:
                return copy.deepcopy(cached)
            voucher = self.call('sign', session_id=ident, to=address, **commitments,
                                nonce=str(secrets.randbits(128)), deadline=int(time.time())+86400)
            entry['voucher'] = voucher
            games.persist()
            return copy.deepcopy(voucher)

    def status(self, games, ident, token, tx_hash=None):
        address = self.address(token)
        entry = games.owned(ident, self.owner(token))
        with entry['lock']:
            data = entry['data']
            if data['status'] != 'won':
                return {'status': 'not_eligible', 'minted': False}
            try:
                commitments = self.candies.commitments(ident)
            except LookupError:
                return {'status': 'awaiting_image', 'minted': False}
            except Exception as error:
                from platform_store import Fault
                if isinstance(error, Fault) and error.status in (404, 409):
                    return {'status': 'awaiting_image', 'minted': False}
                raise
            tx_hash = tx_hash or data.get('tx_hash')
            if tx_hash is not None and (not isinstance(tx_hash, str) or not re.fullmatch(r'0x[0-9a-fA-F]{64}', tx_hash)):
                raise ValueError('Invalid transaction hash.')
            result = self.call('status', session_id=ident, to=address, **commitments,
                               **({'tx_hash': tx_hash} if tx_hash else {}))
            before={key:data.get(key) for key in ('minted','tx_hash','token_id','contract','chain_id')}
            for key in ('minted', 'tx_hash', 'token_id', 'contract', 'chain_id'):
                if key in result:
                    data[key] = result[key]
            # Allow a fresh transaction after a reverted claim.
            if result['status'] == 'failed':
                data.pop('tx_hash', None)
            if result.get('minted'):
                self.candies.mark_minted(ident, result['token_id'])
            if before!={key:data.get(key) for key in before}: games.persist()
            return result
