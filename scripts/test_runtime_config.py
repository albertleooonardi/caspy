import unittest
from runtime_config import public_origin, server_settings


class RuntimeConfigTests(unittest.TestCase):
    def test_local_defaults_preserve_launcher(self):
        settings = server_settings({})
        self.assertEqual(settings['address'], ('127.0.0.1', 8000))
        self.assertIn('http://localhost:4321', settings['origins'])
        self.assertFalse(settings['secure_cookies'])

    def test_production_requires_exact_https_origin_and_secure_cookies(self):
        settings = server_settings({'CASPY_ENV':'production', 'CASPY_PUBLIC_ORIGIN':'https://caspy.example', 'CASPY_API_HOST':'0.0.0.0', 'PORT':'9000'})
        self.assertEqual(settings['address'], ('0.0.0.0', 9000))
        self.assertEqual(settings['origins'], ('https://caspy.example',))
        self.assertTrue(settings['secure_cookies'])
        with self.assertRaises(ValueError): server_settings({'CASPY_ENV':'production'})

    def test_invalid_origins_and_ports_fail_closed(self):
        for value in ('https://caspy.example/path', 'https://user:pass@caspy.example', 'http://public.example', 'https://caspy.example?x=1', 'https://caspy.example#fragment', '*'):
            with self.subTest(origin=value), self.assertRaises(ValueError): public_origin({'CASPY_PUBLIC_ORIGIN':value})
        for value in ('0','65536','invalid'):
            with self.assertRaises(ValueError): server_settings({'PORT':value})
