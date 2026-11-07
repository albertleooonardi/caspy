import unittest
import tempfile
from unittest.mock import patch
from pathlib import Path

from heist_api import Games, next_daily_reset


class FakeGateway:
    def __init__(self, verdict='NO_YIELD', exploit=False, confidence=1, failure=None):
        self.verdict, self.exploit, self.confidence, self.failure = verdict, exploit, confidence, failure
        self.calls = 0

    def actor(self, messages, emit):
        self.calls += 1
        if self.failure == 'actor':
            raise ValueError('private provider error')
        emit('Boo! ')
        if self.failure == 'partial':
            raise ValueError('private provider error')
        emit('My candy stays here.')

    def judge(self, messages):
        if self.failure == 'judge':
            raise ValueError('private provider error')
        return dict(verdict=self.verdict, confidence=self.confidence, exploit_flag=self.exploit, category='other',candy_scores={'creativity':18,'coherence':18,'specificity':18})


class GamesTest(unittest.TestCase):
    def test_contributors_can_replay_completed_heists_without_daily_reset(self):
        for status in ('lost', 'void', 'won'):
            with self.subTest(status=status), tempfile.TemporaryDirectory() as folder:
                store = Path(folder) / 'games.json'
                games = Games(FakeGateway(), store)
                first = games.create('wallet:contributor', unlimited=True)
                games.sessions[first['id']]['data']['status'] = status
                games.persist()
                restored = Games(FakeGateway(), store)
                second = restored.create('wallet:contributor', unlimited=True)
                self.assertNotEqual(first['id'], second['id'])
                self.assertEqual(second['attempts_remaining'], 3)
                self.assertEqual(restored.owned(first['id'], 'wallet:contributor')['data']['status'], status)
                self.assertEqual(restored.create('wallet:contributor', unlimited=True)['id'], second['id'])

    def test_unlimited_replay_does_not_abandon_pending_or_inflight_turns(self):
        with tempfile.TemporaryDirectory() as folder:
            games = Games(FakeGateway(), Path(folder) / 'games.json')
            first = games.create('wallet:contributor', unlimited=True)
            games.sessions[first['id']]['data']['status'] = 'pending_review'
            self.assertEqual(games.create('wallet:contributor', unlimited=True)['id'], first['id'])
            games.sessions[first['id']]['data']['status'] = 'won'
            games.sessions[first['id']]['in_flight'] = 'judge'
            self.assertEqual(games.create('wallet:contributor', unlimited=True)['id'], first['id'])

    def test_jakarta_reset_boundary(self):
        # Unix epoch midnight UTC is 07:00 Jakarta: next midnight is 17:00 UTC.
        self.assertEqual(next_daily_reset(0), 17 * 3600)
        self.assertEqual(next_daily_reset(17 * 3600 - 1), 17 * 3600)
        self.assertEqual(next_daily_reset(17 * 3600), 41 * 3600)

    def test_daily_retry_preserves_loss_and_survives_restart(self):
        with tempfile.TemporaryDirectory() as folder:
            store = Path(folder) / 'games.json'
            with patch('heist_api.time.time', return_value=100):
                games = Games(FakeGateway(), store)
                first = games.create('wallet:owner')
                for turn in range(3):
                    games.turn(first['id'], 'wallet:owner', 'Pitch', str(turn), lambda _: None)
            reset = first['next_reset_at']
            with patch('heist_api.time.time', return_value=reset - 1):
                restored = Games(FakeGateway(), store)
                self.assertEqual(restored.create('wallet:owner')['id'], first['id'])
            with patch('heist_api.time.time', return_value=reset):
                new = restored.create('wallet:owner')
                self.assertNotEqual(new['id'], first['id'])
                self.assertEqual((new['attempts_remaining'], new['messages']), (3, []))
                self.assertEqual(restored.create('wallet:owner')['id'], new['id'])
                again = Games(FakeGateway(), store)
                self.assertEqual(again.create('wallet:owner')['id'], new['id'])
                self.assertEqual(again.owned(first['id'], 'wallet:owner')['data']['status'], 'lost')
                with self.assertRaises(LookupError):
                    again.owned(first['id'], 'wallet:other')

    def test_daily_retry_keeps_active_pending_and_winning_heists(self):
        for status in ('active', 'pending_review', 'won'):
            with self.subTest(status=status), tempfile.TemporaryDirectory() as folder:
                store = Path(folder) / 'games.json'
                with patch('heist_api.time.time', return_value=100):
                    games = Games(FakeGateway(), store)
                    first = games.create('wallet:owner')
                    games.sessions[first['id']]['data']['status'] = status
                    games.persist()
                with patch('heist_api.time.time', return_value=first['next_reset_at'] + 1):
                    self.assertEqual(Games(FakeGateway(), store).create('wallet:owner')['id'], first['id'])

    def setup_game(self, **kwargs):
        gateway = FakeGateway(**kwargs)
        games = Games(gateway)
        session = games.create('owner')
        return games, gateway, session['id']

    def test_three_turns_then_closed(self):
        games, gateway, ident = self.setup_game()
        for i in range(3):
            result = games.turn(ident, 'owner', 'A clever pitch', str(i), lambda _: None)
            self.assertEqual(result['attempts_remaining'], 2-i)
        self.assertEqual(result['status'], 'lost')
        self.assertEqual(len(result['messages']), 6)
        with self.assertRaises(ValueError):
            games.turn(ident, 'owner', 'Extra', 'extra', lambda _: None)
        self.assertEqual(gateway.calls, 3)

    def test_only_confident_clean_judge_can_win(self):
        for options, status in [({'verdict': 'YIELD'}, 'won'),
                                ({'verdict': 'YIELD', 'exploit': True}, 'active'),
                                ({'verdict': 'YIELD', 'confidence': .7}, 'active')]:
            games, _, ident = self.setup_game(**options)
            self.assertEqual(games.turn(ident, 'owner', 'Pitch', '1', lambda _: None)['status'], status)

    def test_ownership_and_idempotency(self):
        games, gateway, ident = self.setup_game()
        with self.assertRaises(LookupError):
            games.owned(ident, 'other-owner')
        first = games.turn(ident, 'owner', 'Pitch', 'same', lambda _: None)
        again = games.turn(ident, 'owner', 'Pitch', 'same', lambda _: None)
        self.assertEqual(first, again)
        self.assertEqual(gateway.calls, 1)

    def test_failures_and_refunds(self):
        for failure, remaining, status in [('actor', 3, 'active'), ('partial', 2, 'void')]:
            games, _, ident = self.setup_game(failure=failure)
            with self.assertRaisesRegex(RuntimeError, 'Caspy|judge'):
                games.turn(ident, 'owner', 'Pitch', '1', lambda _: None)
            data = games.owned(ident, 'owner')['data']
            self.assertEqual((data['attempts_remaining'], data['status']), (remaining, status))

    def test_provider_quota_error_is_readable_and_refunds_an_unstarted_reply(self):
        import urllib.error
        games,gateway,ident=self.setup_game()
        with patch.object(gateway,'actor',side_effect=urllib.error.HTTPError('http://fixture',429,'private provider message',{},None)):
            with self.assertRaisesRegex(RuntimeError,'quota limit') as error:
                games.turn(ident,'owner','Fictional pitch','quota-fixture',lambda _:None)
        data=games.owned(ident,'owner')['data']
        self.assertEqual((data['attempts_remaining'],data['status']),(3,'active'))
        self.assertNotIn('private provider message',str(error.exception))

    def test_judge_failure_can_be_retried_without_spending_another_attempt(self):
        games, gateway, ident = self.setup_game(failure='judge', verdict='YIELD')
        result = games.turn(ident, 'owner', 'Pitch', '1', lambda _: None)
        self.assertEqual(result['status'], 'pending_review')
        self.assertEqual(result['attempts_remaining'], 2)
        gateway.failure = None
        result = games.review(ident, 'owner')
        self.assertEqual(result['status'], 'won')
        self.assertEqual(result['attempts_remaining'], 2)
        self.assertEqual(gateway.calls, 1)

    def test_concurrent_turn_rejected_before_spending(self):
        games, gateway, ident = self.setup_game()
        lock = games.owned(ident, 'owner')['lock']
        with lock:
            with self.assertRaisesRegex(ValueError, 'still running'):
                games.turn(ident, 'owner', 'Pitch', '1', lambda _: None)
        self.assertEqual(gateway.calls, 0)

    def test_expiration(self):
        games, _, ident = self.setup_game()
        games.sessions[ident]['created'] -= 21601
        with self.assertRaises(LookupError):
            games.owned(ident, 'owner')

    def test_persistent_sessions_do_not_expire_or_reset_on_restart(self):
        with tempfile.TemporaryDirectory() as folder:
            store = Path(folder) / 'games.json'
            games = Games(FakeGateway(verdict='YIELD'), store)
            ident = games.create('wallet:owner')['id']
            games.turn(ident, 'wallet:owner', 'Pitch', '1', lambda _: None)
            games.sessions[ident]['created'] -= 21601
            games.persist()
            restored = Games(FakeGateway(), store)
            restored.prune()
            self.assertEqual(restored.create('wallet:owner')['id'], ident)
            self.assertEqual(restored.owned(ident, 'wallet:owner')['data']['status'], 'won')

    def test_restart_during_judging_preserves_review_without_an_extra_attempt(self):
        with tempfile.TemporaryDirectory() as folder:
            store = Path(folder) / 'games.json'
            games = Games(FakeGateway(failure='judge'), store)
            ident = games.create('wallet:owner')['id']
            games.turn(ident, 'wallet:owner', 'Pitch', '1', lambda _: None)
            games.sessions[ident]['in_flight'] = 'judge'
            games.persist()
            restored = Games(FakeGateway(verdict='YIELD'), store)
            self.assertEqual(restored.owned(ident, 'wallet:owner')['data']['status'], 'pending_review')
            result = restored.review(ident, 'wallet:owner')
            self.assertEqual((result['status'], result['attempts_remaining']), ('won', 2))


if __name__ == '__main__':
    unittest.main()
