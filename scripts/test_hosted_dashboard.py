import base64
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import threading
import time
import unittest

from hosted_dashboard import CASPY_PORT, GATEWAY_PORT, dashboard_origin, prepare_proxy


HOST = 'caspy-api.onrender.com'
ORIGIN = 'https://' + HOST
PASSWORD = 'disposable-test-password'


class Probe(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.server.server_port == GATEWAY_PORT and self.headers.get('Authorization'):
            self.send_error(500, 'Admin credentials leaked to the gateway')
            return
        self.send_response(200)
        self.end_headers()
        self.wfile.write(f'{self.server.server_port}:{self.path}'.encode())

    do_POST = do_GET

    def log_message(self, *_):
        pass


class DashboardProxyTests(unittest.TestCase):
    def test_opt_in_is_bound_to_render_host(self):
        self.assertIsNone(dashboard_origin({}))
        settings = {'CASPY_BIFROST_DASHBOARD_HOST': HOST, 'RENDER_EXTERNAL_HOSTNAME': HOST}
        self.assertEqual(dashboard_origin(settings), ORIGIN)
        with self.assertRaises(ValueError):
            dashboard_origin({**settings, 'RENDER_EXTERNAL_HOSTNAME': 'other.onrender.com'})
        with self.assertRaises(ValueError):
            dashboard_origin({**settings, 'CASPY_BIFROST_DASHBOARD_HOST': HOST + '/api'})

    @unittest.skipUnless(shutil.which('nginx'), 'Proxy integration runs in the cloud container build')
    def test_proxy_preserves_public_api_and_guards_dashboard(self):
        from contextlib import ExitStack
        from http.client import HTTPConnection

        with ExitStack() as stack:
            folder = Path(stack.enter_context(tempfile.TemporaryDirectory()))
            for port in (CASPY_PORT, GATEWAY_PORT):
                server = stack.enter_context(ThreadingHTTPServer(('127.0.0.1', port), Probe))
                threading.Thread(target=server.serve_forever, daemon=True).start()
                stack.callback(server.shutdown)
            with socket.socket() as sock:
                sock.bind(('127.0.0.1', 0))
                port = sock.getsockname()[1]

            command = prepare_proxy({
                'BIFROST_ADMIN_USERNAME': 'admin', 'BIFROST_ADMIN_PASSWORD': PASSWORD,
            }, ORIGIN, port, folder)
            proxy = stack.enter_context(subprocess.Popen(command))
            stack.callback(proxy.terminate)
            for _ in range(100):
                try:
                    with socket.create_connection(('127.0.0.1', port), timeout=0.1):
                        break
                except OSError:
                    time.sleep(0.02)
            else:
                self.fail('Proxy did not bind')

            token = base64.b64encode(f'admin:{PASSWORD}'.encode()).decode()
            basic = {'Authorization': 'Basic ' + token}

            def request(path, method='GET', **headers):
                direct = HTTPConnection('127.0.0.1', port, timeout=2)
                try:
                    direct.request(method, path, headers={'Host': HOST, **headers})
                    response = direct.getresponse()
                    return response.status, response.getheader('Cache-Control'), response.read()
                finally:
                    direct.close()

            for path in ('/health', '/account/me', '/game/turn', '/candy/config', '/social'):
                self.assertEqual(request(path), (200, None, f'{CASPY_PORT}:{path}'.encode()))
            for path in ('/', '/login', '/_next/static/bundle.js', '/api/config', '/v1/models'):
                self.assertEqual(request(path)[:2], (401, 'no-store'))
                self.assertEqual(request(path, **basic), (200, 'no-store', f'{GATEWAY_PORT}:{path}'.encode()))
            self.assertEqual(request('/api/config', **{**basic, 'Host': 'wrong.onrender.com'})[0], 404)
            self.assertEqual(request('/api/session/login', 'POST', **basic)[0], 403)
            self.assertEqual(request('/api/session/login', 'POST', Origin='https://other.example', **basic)[0], 403)
            self.assertEqual(request('/api/session/login', 'POST', Origin=ORIGIN, **basic)[0], 200)
