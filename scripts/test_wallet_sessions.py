"""Wallet proof persistence, revocation and deployment isolation; no chain calls."""
from pathlib import Path
import secrets
import tempfile
import unittest
from unittest.mock import patch

from database import Database
from nft_game import LocalNFT


class WalletSessionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.database = Database(Path(self.temp.name) / 'fixture.sqlite3')
        self.config = dict(chain_id=84532, contract='0x'+'1'*40, deployment_block_hash='0x'+'2'*64)
        self.wallet = '0x'+'3'*40

    def instance(self, config=None):
        with patch('nft_game.shutil.which', return_value='node'), patch.object(LocalNFT, 'call'):
            nft = LocalNFT(config or self.config)
        nft.persist_sessions(self.database)
        return nft

    def test_verified_cookie_survives_restart_and_contains_no_plaintext_token(self):
        first = self.instance()
        token = secrets.token_urlsafe(32)
        first.challenges[token] = dict(expires=2000, origin='https://caspy.example', nonce='nonce', address=self.wallet)
        with patch('nft_game.time.time', return_value=1000), patch.object(first, 'call', return_value={'address':self.wallet}):
            first.save_session(token, self.wallet)
            cookie, _ = first.verify(token, {'message':'fixture', 'signature':'0x'+'a'*130}, 'https://caspy.example')
        restarted = self.instance()
        with patch('nft_game.time.time', return_value=1001):
            self.assertEqual(restarted.address(cookie), self.wallet)
            with self.assertRaises(PermissionError): restarted.address(token)
            with self.assertRaises(PermissionError): restarted.address(self.wallet)
        with self.database.connect() as db:
            row = db.execute('SELECT * FROM wallet_sessions').fetchone()
            self.assertEqual(row['token_hash'], first.token_hash(cookie))
            self.assertNotIn(cookie, str(dict(row)))
            self.assertEqual(row['expires'], 22600)

    def test_expiry_and_shared_logout_fail_closed(self):
        first, second = self.instance(), self.instance()
        with patch('nft_game.time.time', return_value=1000): first.save_session('proof', self.wallet)
        with patch('nft_game.time.time', return_value=22600):
            with self.assertRaises(PermissionError): second.address('proof')
        with patch('nft_game.time.time', return_value=1001):
            second.logout('proof')
            with self.assertRaises(PermissionError): first.address('proof')

    def test_different_deployment_cannot_restore_session(self):
        first = self.instance()
        first.save_session('proof', self.wallet)
        for change in (dict(chain_id=31337), dict(contract='0x'+'4'*40), dict(deployment_block_hash='0x'+'5'*64)):
            with self.assertRaises(PermissionError): self.instance({**self.config, **change}).address('proof')
        self.assertEqual(self.instance().address('proof'), self.wallet)

    def test_failed_signature_never_persists_session(self):
        first = self.instance()
        first.challenges['challenge'] = dict(expires=2000, origin='https://caspy.example', nonce='nonce', address=self.wallet)
        with patch('nft_game.time.time', return_value=1000), patch.object(first, 'call', side_effect=ValueError('Invalid signature')):
            with self.assertRaises(ValueError): first.verify('challenge', {'message':'fixture', 'signature':'0x'+'a'*130}, 'https://caspy.example')
        with self.database.connect() as db:
            self.assertEqual(db.execute('SELECT count(*) FROM wallet_sessions').fetchone()[0], 0)
