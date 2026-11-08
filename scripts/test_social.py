import tempfile
import unittest
from pathlib import Path

from platform_store import Platform, Fault
from social_store import normalize_code, MAX_FAILED_LOOKUPS
from test_platform_store import HandlerStub


class SocialTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name)/'platform.sqlite3'
        self.store = Platform(self.path)
        self.ada_token, self.ada = self.register('ada')
        self.ben_token, self.ben = self.register('ben')
        self.cy_token, self.cy = self.register('cy')

    def tearDown(self):
        self.temp.cleanup()

    def register(self, name):
        return self.store.authenticate({'name': name, 'email': name+'@example.test', 'password': 'testing-password-123',
                                        'account_type': 'contributor', 'terms_accepted': True}, '127.0.0.1', '', True)

    def route(self, path, token, body=None):
        handler = HandlerStub(path, token)
        self.assertTrue(self.store.handle(handler, body))
        return handler.result

    def code(self, token):
        return self.route('/social', token)['code']

    def test_code_normalization_rejects_ambiguous_or_malformed_input(self):
        self.assertEqual(normalize_code(' abcd-2345 '), 'ABCD2345')
        for bad in ('', 'ABCD', 'ABCD-234I', 'ABCD-2340', 'ABCDEFGHJ', None, 12345678):
            with self.assertRaises(Fault): normalize_code(bad)

    def test_request_accept_list_and_remove_flow_hides_private_fields(self):
        ben_code = self.code(self.ben_token)
        self.assertRegex(ben_code, r'^[A-Z2-9]{4}-[A-Z2-9]{4}$')
        self.assertEqual(self.code(self.ben_token), ben_code)  # stable
        sent = self.route('/social/requests', self.ada_token, {'code': ben_code.lower()})
        self.assertEqual(sent['status'], 'pending')
        ada_view, ben_view = self.route('/social', self.ada_token), self.route('/social', self.ben_token)
        self.assertEqual([item['name'] for item in ada_view['outgoing']], ['ben'])
        self.assertEqual([item['name'] for item in ben_view['incoming']], ['ada'])
        self.assertFalse(ada_view['friends'])
        self.assertNotIn('@', str(ben_view)); self.assertNotIn(self.ada['id'], str(ben_view))
        request_id = ben_view['incoming'][0]['id']
        self.route(f'/social/requests/{request_id}/accept', self.ben_token, {})
        self.route(f'/social/requests/{request_id}/accept', self.ben_token, {})  # idempotent
        self.assertEqual([item['name'] for item in self.route('/social', self.ada_token)['friends']], ['ben'])
        self.assertEqual([item['name'] for item in self.route('/social', self.ben_token)['friends']], ['ada'])
        with self.assertRaises(Fault) as duplicate: self.route('/social/requests', self.ada_token, {'code': ben_code})
        self.assertEqual(duplicate.exception.status, 409)
        self.route(f'/social/friends/{request_id}/remove', self.ada_token, {})
        self.assertFalse(self.route('/social', self.ben_token)['friends'])

    def test_crossing_requests_become_friends_and_self_request_is_rejected(self):
        self.route('/social/requests', self.ada_token, {'code': self.code(self.ben_token)})
        result = self.route('/social/requests', self.ben_token, {'code': self.code(self.ada_token)})
        self.assertEqual(result['status'], 'accepted')
        self.assertEqual(len(self.route('/social', self.ada_token)['friends']), 1)
        with self.assertRaises(Fault) as own: self.route('/social/requests', self.cy_token, {'code': self.code(self.cy_token)})
        self.assertEqual(own.exception.status, 400)

    def test_only_the_right_person_can_respond_and_outsiders_see_nothing(self):
        self.route('/social/requests', self.ada_token, {'code': self.code(self.ben_token)})
        request_id = self.route('/social', self.ben_token)['incoming'][0]['id']
        for token, action, status in ((self.ada_token, 'accept', 403), (self.ada_token, 'decline', 403),
                                      (self.cy_token, 'accept', 404), (self.cy_token, 'cancel', 404)):
            with self.assertRaises(Fault) as denied: self.route(f'/social/requests/{request_id}/{action}', token, {})
            self.assertEqual(denied.exception.status, status)
        with self.assertRaises(Fault) as early: self.route(f'/social/friends/{request_id}/remove', self.ada_token, {})
        self.assertEqual(early.exception.status, 409)
        self.route(f'/social/requests/{request_id}/cancel', self.ada_token, {})
        self.assertFalse(self.route('/social', self.ben_token)['incoming'])

    def test_decline_blocks_resend_but_decliner_can_still_invite(self):
        ben_code, ada_code = self.code(self.ben_token), self.code(self.ada_token)
        self.route('/social/requests', self.ada_token, {'code': ben_code})
        request_id = self.route('/social', self.ben_token)['incoming'][0]['id']
        self.route(f'/social/requests/{request_id}/decline', self.ben_token, {})
        self.assertFalse(self.route('/social', self.ada_token)['outgoing'])
        self.assertFalse(self.route('/social', self.ben_token)['incoming'])
        with self.assertRaises(Fault) as blocked: self.route('/social/requests', self.ada_token, {'code': ben_code})
        self.assertEqual(blocked.exception.status, 409)
        self.assertEqual(self.route('/social/requests', self.ben_token, {'code': ada_code})['status'], 'pending')
        self.assertEqual(len(self.route('/social', self.ada_token)['incoming']), 1)

    def test_unknown_codes_are_throttled_and_regenerating_invalidates_the_old_code(self):
        for _ in range(MAX_FAILED_LOOKUPS):
            with self.assertRaises(Fault) as missing: self.route('/social/requests', self.ada_token, {'code': 'AAAAAAAA'})
            self.assertEqual(missing.exception.status, 404)
        with self.assertRaises(Fault) as limited: self.route('/social/requests', self.ada_token, {'code': self.code(self.ben_token)})
        self.assertEqual(limited.exception.status, 429)
        old = self.code(self.cy_token)
        fresh = self.route('/social/code', self.cy_token, {})['code']
        self.assertNotEqual(old, fresh)
        self.assertEqual(self.code(self.cy_token), fresh)
        with self.assertRaises(Fault) as stale: self.route('/social/requests', self.ben_token, {'code': old})
        self.assertEqual(stale.exception.status, 404)

    def test_unauthenticated_and_persisted_state(self):
        with self.assertRaises(Fault) as anonymous: self.route('/social', 'not-a-session')
        self.assertEqual(anonymous.exception.status, 401)
        self.route('/social/requests', self.ada_token, {'code': self.code(self.ben_token)})
        restored = Platform(self.path)
        handler = HandlerStub('/social', self.ben_token)
        restored.handle(handler)
        self.assertEqual(len(handler.result['incoming']), 1)


if __name__ == '__main__':
    unittest.main()
