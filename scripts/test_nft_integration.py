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
from platform_store import Platform
from candy_store import CandyStore
from test_candy_store import FixtureRenderer
from http.cookies import SimpleCookie
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
        cls.server.platform = Platform(Path(cls.temp.name) / 'platform.sqlite3')
        cls.server.candy = CandyStore(cls.server.platform, cls.server.nft, Path(cls.temp.name)/'assets', FixtureRenderer())
        cls.server.nft.candies = cls.server.candy
        cls.store = Path(cls.temp.name) / 'games.json'
        cls.server.games = Games(FakeGateway(verdict='YIELD'), cls.store)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.candy.close()
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
        for key, value in response.getheaders():
            if key.lower() == 'set-cookie':
                parsed = SimpleCookie(); parsed.load(value)
                for name, item in parsed.items():
                    if item.value: self.cookies[name] = item.value
                    else: self.cookies.pop(name, None)
        self.cookie = '; '.join(f'{key}={value}' for key, value in self.cookies.items())
        data = response.read().decode()
        self.assertEqual(response.status, expected, data)
        streaming = response.getheader('Content-Type') == 'text/event-stream'
        conn.close()
        return data if streaming else json.loads(data)

    def sign_in(self, account):
        self.account, self.cookie, self.cookies = account, '', {}
        self.api('/account/register', {'name': f'Player {account}', 'email': f'player{account}@example.test', 'password': 'testing-password-123', 'account_type': 'contributor', 'terms_accepted': True})
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
        if not won:
            self.api('/candy/generate', {'session_id':game['id'],'accept_provider':True}, expected=403)
            self.api('/game/voucher', {'session_id':game['id']}, expected=400)
            self.assertFalse(self.api('/mint/status/'+game['id'])['minted'])
            self.assertNotIn('candy',game)
            return
        self.assertEqual(game['candy']['state'],'earned')
        self.api('/candy/generate', {'session_id':game['id'],'accept_provider':False}, expected=400)
        self.api('/candy/generate', {'session_id':game['id'],'accept_provider':True})
        for _ in range(50):
            game=self.api('/game/session/'+game['id'])
            if game['candy']['state']=='ready': break
            time.sleep(.05)
        self.assertEqual(game['candy']['state'],'ready')
        # Client-supplied tiers and recipients are ignored; the server owns both.
        voucher = self.api('/game/voucher', {'session_id': game['id'], 'tier': 1 if won else 0, 'to': '0x' + '11'*20})
        self.assertEqual(voucher['grade'], game['candy']['assessment']['grade'])
        self.assertEqual(voucher['to'].lower(), address.lower())
        self.assertEqual(voucher, self.api('/game/voucher', {'session_id': game['id']}))
        tampered = {**voucher, 'grade': 1 if voucher['grade'] != 1 else 4}
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
        # A contributor may replay, while the old claim stays durable and one per wallet.
        self.server.games = Games(FakeGateway(), self.store)
        restored = self.api('/game/session/' + game['id'])
        self.assertEqual(restored['id'], game['id'])
        self.assertTrue(restored['minted'])
        self.assertEqual(restored['token_id'], status['token_id'])
        replay = self.api('/game/session', {})
        self.assertNotEqual(replay['id'], game['id'])
        self.assertEqual(replay['attempts_remaining'], 3)
        self.assertTrue(self.api('/game/session/' + game['id'])['minted'])
        available = self.api('/auth/local-wallets')['wallets']
        self.assertTrue(any(item['address'].lower() == address.lower() and item['linked'] for item in available))
        collection=self.api('/candy/collection')['tokens']
        self.assertEqual(collection[0]['token_id'],status['token_id'])
        self.assertEqual(self.api('/candy/prompt/'+status['token_id'])['prompt'],'A clever ghost bakery trade.')
        self.driver('write',contract=self.config['contract'],function_name='licensePrompt',args=[status['token_id'],'Non-exclusive source prompt access; no copyright transfer.'])
        self.driver('write',contract=self.config['contract'],function_name='approve',args=[self.config['market'],status['token_id']])
        self.driver('write',contract=self.config['market'],market=True,function_name='list',args=[status['token_id'],'1000'])
        self.assertEqual(self.api('/market/history')['sales'], [])
        listed=self.api('/market/listings')['listings'][0]
        self.assertNotIn('prompt',listed)
        seller_cookie,seller_cookies=self.cookie,dict(self.cookies)
        seller=self.account
        buyer=self.sign_in(8)
        self.api('/candy/prompt/'+status['token_id'],expected=403)
        purchase=self.driver('write',contract=self.config['market'],market=True,function_name='buy',args=[listed['listing_id']],value='1000')
        history=self.api('/market/history')
        self.assertEqual(history['chain_id'],31337)
        self.assertEqual(history['total_sales'],1)
        self.assertFalse(history['truncated'])
        sale=history['sales'][0]
        self.assertEqual(sale['token_id'],status['token_id'])
        self.assertEqual(sale['listing_id'],listed['listing_id'])
        self.assertEqual(sale['price_wei'],'1000')
        self.assertEqual(sale['transaction_hash'],purchase['hash'])
        self.assertEqual(sale['seller'].lower(),address.lower())
        self.assertEqual(sale['buyer'].lower(),buyer.lower())
        self.assertGreater(sale['timestamp'],0)
        self.assertEqual(self.api('/candy/prompt/'+status['token_id'])['prompt'],'A clever ghost bakery trade.')
        self.assertEqual(self.api('/candy/collection')['tokens'][0]['owner'].lower(),buyer.lower())
        # A resale asking price and its cancellation never become recorded sales.
        self.driver('write',contract=self.config['contract'],function_name='approve',args=[self.config['market'],status['token_id']])
        self.driver('write',contract=self.config['market'],market=True,function_name='list',args=[status['token_id'],'2000'])
        resale=self.api('/market/listings')['listings'][0]
        self.assertEqual(self.api('/market/history')['sales'],history['sales'])
        self.driver('write',contract=self.config['market'],market=True,function_name='cancel',args=[resale['listing_id']])
        self.assertEqual(self.api('/market/history')['sales'],history['sales'])
        self.account=seller
        # Restore the original authenticated account cookies for the access regression below.
        self.cookie,self.cookies=seller_cookie,seller_cookies
        self.api('/candy/prompt/'+status['token_id'],expected=403)
        self.assertEqual(self.api('/market/account')['proceeds_wei'],'1000')
        self.driver('write',contract=self.config['market'],market=True,function_name='withdraw')
        # Another signed wallet cannot read or claim the original session.
        self.sign_in(account + 5)
        self.assertFalse(any(item['address'].lower() == address.lower() for item in self.api('/auth/local-wallets')['wallets']))
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
        uri='http://localhost/explicit-test-fixture.json'
        signed = signer.create_voucher(address, 92, '0x'+secrets.token_hex(32), *(['0x'+'12'*32]*3), uri, 1, int(time.time())+3600)
        voucher = {**signed['voucher'], 'uri': signed['uri'], 'nonce': '1', 'deadline': str(signed['voucher']['deadline']), 'signature': signed['signature'], 'chainId': 31337, 'contract': self.config['contract']}
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
        if game['status']=='lost':
            self.api('/game/voucher', {'session_id':game['id']}, expected=400)
            return
        self.api('/candy/generate', {'session_id':game['id'],'accept_provider':True})
        for _ in range(100):
            if self.api('/game/session/'+game['id'])['candy']['state']=='ready': break
            time.sleep(.05)
        voucher=self.api('/game/voucher', {'session_id':game['id']})
        transaction=self.driver('mint', voucher=voucher)
        self.assertTrue(self.api('/mint/submit', {'session_id':game['id'],'tx_hash':transaction['hash']})['minted'])


if __name__ == '__main__':
    unittest.main()
