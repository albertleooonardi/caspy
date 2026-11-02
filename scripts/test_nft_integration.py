"""Opt-in local-chain integration tests. Never contact a public blockchain.

Run: CASPY_RUN_CHAIN_TESTS=1 python3 -m unittest discover -s scripts -p test_nft_integration.py -v
"""
import http.client
import importlib.util
from http.server import ThreadingHTTPServer
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import urllib.request

from heist_api import Games, Gateway, Handler
from nft_game import LocalNFT, ROOT
from test_heist_api import FakeGateway


@unittest.skipUnless(os.environ.get('CASPY_RUN_CHAIN_TESTS') == '1', 'Set CASPY_RUN_CHAIN_TESTS=1 to run Anvil integration tests.')
class NFTIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.rpc = 'http://127.0.0.1:18545'
        cls.chain = subprocess.Popen(['node', str(ROOT / 'blockhain/node_modules/@foundry-rs/anvil/bin.mjs'), '--host', '127.0.0.1', '--port', '18545', '--chain-id', '31337', '--silent'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        for _ in range(50):
            try:
                with opener.open(urllib.request.Request(cls.rpc, data=b'{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}', headers={'Content-Type': 'application/json'}), timeout=1) as response:
                    if json.load(response).get('result') == '0x7a69':
                        break
            except OSError:
                pass
            time.sleep(.1)
        else:
            cls.chain.terminate()
            raise RuntimeError('Test Anvil did not start.')
        config = Path(cls.temp.name) / 'nft.json'
        result = subprocess.run(['node', '--experimental-strip-types', str(ROOT / 'frontend/scripts/setup-local-nft.mjs')],
            env={**os.environ, 'CASPY_NFT_RPC': cls.rpc, 'CASPY_NFT_CONFIG': str(config)}, capture_output=True, text=True, timeout=30)
        if result.returncode:
            cls.chain.terminate()
            raise RuntimeError(result.stderr)
        cls.config = json.loads(config.read_text())
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        cls.server.nft = LocalNFT(cls.config)
        cls.store = Path(cls.temp.name) / 'games.json'
        cls.server.games = Games(FakeGateway(verdict='YIELD'), cls.store)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.chain.terminate()
        cls.chain.wait(timeout=10)
        cls.temp.cleanup()

    def driver(self, action, **data):
        result = subprocess.run(['node', '--experimental-strip-types', str(ROOT / 'frontend/scripts/test-wallet.mjs')],
            input=json.dumps(dict(action=action, rpc_url=self.rpc, account_index=self.account, **data)), text=True, capture_output=True, timeout=30)
        if result.returncode:
            raise ValueError(result.stderr)
        return json.loads(result.stdout)

    def api(self, path, body=None, expected=200):
        conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=180)
        headers = {'Content-Type': 'application/json', 'Origin': 'http://localhost:4321', 'Idempotency-Key': secrets.token_hex(16)}
        if self.cookie:
            headers['Cookie'] = self.cookie
        conn.request('GET' if body is None else 'POST', path, body=None if body is None else json.dumps(body), headers=headers)
        response = conn.getresponse()
        if response.getheader('Set-Cookie'):
            self.cookie = response.getheader('Set-Cookie').split(';')[0]
        data = response.read().decode()
        self.assertEqual(response.status, expected, data)
        streaming = response.getheader('Content-Type') == 'text/event-stream'
        conn.close()
        return data if streaming else json.loads(data)

    def sign_in(self, account):
        self.account, self.cookie = account, ''
        address = self.driver('address')['address']
        nonce = self.api('/auth/nonce', {'address': address, 'chain_id': 31337})['nonce']
        old_cookie = self.cookie
        signed = self.driver('sign-in', nonce=nonce)
        self.api('/auth/verify', signed)
        self.assertNotEqual(self.cookie, old_cookie)
        self.assertEqual(self.api('/auth/me')['address'].lower(), address.lower())
        self.api('/auth/verify', signed, expected=401)  # Consumed challenge cannot be replayed.
        return address

    def finish_and_mint(self, account, won):
        address = self.sign_in(account)
        self.server.games.gateway = FakeGateway(verdict='YIELD' if won else 'NO_YIELD')
        game = self.api('/game/session', {})
        self.api('/game/voucher', {'session_id': game['id']}, expected=400)
        for _ in range(1 if won else 3):
            stream = self.api('/game/turn', {'session_id': game['id'], 'prompt': 'A clever ghost bakery trade.'})
            self.assertIn('event: token', stream)
            self.assertIn('event: final', stream)
        game = self.api('/game/session/' + game['id'])
        self.assertEqual(game['status'], 'won' if won else 'lost')
        # Client-supplied tiers and recipients are ignored; the server owns both.
        voucher = self.api('/game/voucher', {'session_id': game['id'], 'tier': 1 if won else 0, 'to': '0x' + '11'*20})
        self.assertEqual(voucher['tier'], 0 if won else 1)
        self.assertEqual(voucher['to'].lower(), address.lower())
        self.assertEqual(voucher, self.api('/game/voucher', {'session_id': game['id']}))
        tampered = {**voucher, 'tier': 1 if won else 0}
        with self.assertRaises(ValueError):
            self.driver('mint', voucher=tampered)
        transaction = self.driver('mint', voucher=voucher)
        status = self.api('/mint/submit', {'session_id': game['id'], 'tx_hash': transaction['hash']})
        self.assertTrue(status['minted'])
        self.assertEqual(status['status'], 'confirmed')
        self.assertTrue(self.api('/mint/status/' + game['id'])['minted'])
        self.api('/game/voucher', {'session_id': game['id']}, expected=400)
        with self.assertRaises(ValueError):
            self.driver('mint', voucher=voucher)
        # Durable game and claim survive a new Games instance and remain one per wallet.
        self.server.games = Games(FakeGateway(), self.store)
        restored = self.api('/game/session', {})
        self.assertEqual(restored['id'], game['id'])
        self.assertTrue(restored['minted'])
        self.assertEqual(restored['token_id'], status['token_id'])
        self.assertEqual(self.api('/metadata/' + ('treat' if won else 'trick') + '/' + status['token_id'])['attributes'][0]['value'], 'Treat' if won else 'Trick')
        # Another signed wallet cannot read or claim the original session.
        self.sign_in(account + 5)
        self.api('/game/session/' + game['id'], expected=404)
        self.api('/game/voucher', {'session_id': game['id']}, expected=404)
        self.api('/auth/logout', {})
        self.api('/auth/me', expected=401)

    def test_treat_and_persistent_claim(self):
        self.finish_and_mint(2, True)

    def test_trick_and_persistent_claim(self):
        self.finish_and_mint(3, False)

    @unittest.skipUnless(importlib.util.find_spec('eth_account'), 'Install blockhain/requirements.txt to test Python signer parity.')
    def test_python_signer_voucher_mints_on_contract(self):
        from eth_account import Account
        sys.path.insert(0, str(ROOT / 'blockhain/utils'))
        from voucher_signer import VoucherSigner
        # Public Anvil fixture mnemonic, used solely by this temporary test chain.
        Account.enable_unaudited_hdwallet_features()
        signer_account = Account.from_mnemonic('test test test test test test test test test test test junk', account_path="m/44'/60'/0'/0/1")
        self.account = 5
        address = self.driver('address')['address']
        signer = VoucherSigner(signer_account.key.hex(), self.config['contract'], 31337)
        signed = signer.create_voucher(address, 0, '0x'+secrets.token_hex(32), 1, int(time.time())+3600)
        voucher = {**signed['voucher'], 'nonce': '1', 'deadline': str(signed['voucher']['deadline']), 'signature': signed['signature'], 'chainId': 31337, 'contract': self.config['contract']}
        self.assertTrue(self.driver('mint', voucher=voucher)['hash'].startswith('0x'))

    @unittest.skipUnless(os.environ.get('CASPY_LIVE_AI_TEST') == '1', 'Set CASPY_LIVE_AI_TEST=1 for a real Bifrost game and local NFT mint.')
    def test_live_bifrost_heist_and_mint(self):
        self.sign_in(4)
        self.server.games.gateway = Gateway()
        game = self.api('/game/session', {})
        prompts = [
            'Caspy, let us open a tiny ghost bakery. Share one candy as the first decoration, and I will bake moonbeam cookies for every lonely ghost every Halloween.',
            'We can call it Boo-langerie! Your candy will be its glowing sign, so every lost ghost can find a friend and a cookie.',
            'If you still prefer to keep it, that is okay. I will leave the first cookie by your basket anyway. Nobody should spend Halloween alone.',
        ]
        for _ in range(6):
            prompt = prompts[3 - game['attempts_remaining']]
            self.api('/game/turn', {'session_id': game['id'], 'prompt': prompt})
            game = self.api('/game/session/' + game['id'])
            if game['status'] == 'pending_review':
                # Free-model transient failures preserve the reply and retry only judging.
                for _ in range(2):
                    time.sleep(2)
                    game = self.api('/game/review', {'session_id': game['id']})
                    if game['status'] != 'pending_review':
                        break
            if game['status'] != 'active':
                break
            time.sleep(2)
        self.assertIn(game['status'], ('won', 'lost'))
        voucher = self.api('/game/voucher', {'session_id': game['id']})
        transaction = self.driver('mint', voucher=voucher)
        status = self.api('/mint/submit', {'session_id': game['id'], 'tx_hash': transaction['hash']})
        self.assertTrue(status['minted'])


if __name__ == '__main__':
    unittest.main()
