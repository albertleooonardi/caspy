"""Disposable screenshot fixture, never a development or production API.

Build the real frontend with PUBLIC_NFT_ENABLED=true,
PUBLIC_CONTRACT_ADDRESS=0x1111111111111111111111111111111111111111,
PUBLIC_NFT_SEASON=tutorial-only, then pass that build directory here.
Only binds loopback; all API/RPC writes are blocked. Stop after capture.
"""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class CaptureHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split('?', 1)[0].startswith(('/api/', '/rpc')):
            self.send_error(403, 'Tutorial fixture: no backend access')
            return
        if self.path.split('?', 1)[0] == '/tutorial-fixture.js':
            content = Path(__file__).with_name('tutorial_capture_fixture.js').read_bytes()
        else:
            path = Path(self.translate_path(self.path))
            if path.is_dir():
                path /= 'index.html'
            if path.suffix != '.html' or not path.is_file():
                return super().do_GET()
            content = path.read_bytes().replace(b'<head>', b'<head><script src="/tutorial-fixture.js"></script>', 1)
        self.send_response(200)
        self.send_header('Content-Type', 'text/javascript' if self.path == '/tutorial-fixture.js' else 'text/html')
        self.send_header('Content-Length', str(len(content)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(content)

    def do_POST(self):
        self.send_error(403, 'Tutorial fixture: writes disabled')

    def log_message(self, *_):
        pass


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('build_directory')
    parser.add_argument('--port', type=int, default=8766)
    args = parser.parse_args()
    handler = partial(CaptureHandler, directory=str(Path(args.build_directory).resolve()))
    print(f'Tutorial-only capture server: http://127.0.0.1:{args.port}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), handler).serve_forever()
