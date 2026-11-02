import unittest

from heist_api import Games


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
        return dict(verdict=self.verdict, confidence=self.confidence, exploit_flag=self.exploit, category='other')


class GamesTest(unittest.TestCase):
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
        for failure, remaining, status in [('actor', 3, 'active'), ('partial', 2, 'void'), ('judge', 2, 'void')]:
            games, _, ident = self.setup_game(failure=failure)
            with self.assertRaisesRegex(RuntimeError, 'Caspy|judge'):
                games.turn(ident, 'owner', 'Pitch', '1', lambda _: None)
            data = games.owned(ident, 'owner')['data']
            self.assertEqual((data['attempts_remaining'], data['status']), (remaining, status))

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


if __name__ == '__main__':
    unittest.main()
