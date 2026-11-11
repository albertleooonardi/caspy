"""Quota-limited official FLUX Schnell Space. No paid inference fallback.

The public Space receives the redacted art prompt after the game's explicit
generation consent. When the server has HF_TOKEN, it is sent only to the
official Space origin so ZeroGPU quota is counted against that account rather
than the host's shared IP address; without it, calls are anonymous.
The remote API can queue, throttle, fail or change; failures preserve the reward.
"""
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from urllib.parse import urlsplit

from bifrost_setup import NoRedirect, environment

SPACE = 'black-forest-labs/FLUX.1-schnell'
ORIGIN = 'https://black-forest-labs-flux-1-schnell.hf.space'
LIMIT = 15_000_000
ROOT = Path(__file__).resolve().parents[1]


class SpaceSchnell:
    model = 'black-forest-labs/FLUX.1-schnell'
    provider = 'huggingface-zerogpu-space'
    local = False
    configured = True

    def __init__(self, token=None):
        self.token = environment(ROOT).get('HF_TOKEN', '') if token is None else token

    def render(self, prompt, seed, target):
        return self.render_with_progress(prompt, seed, target, lambda phase: None)

    def render_with_progress(self, prompt, seed, target, progress):
        # A malformed value must never reach a request header.
        if self.token and not re.fullmatch(r'hf_[A-Za-z0-9]{8,200}', self.token):
            raise RuntimeError('authentication')
        account = {'Authorization': 'Bearer ' + self.token} if self.token else {}
        opener = urllib.request.build_opener(NoRedirect())
        deadline = time.monotonic() + 240

        def read(path, body=None):
            request = urllib.request.Request(ORIGIN + path,
                data=None if body is None else json.dumps(body).encode(),
                headers={'Content-Type': 'application/json', 'User-Agent': 'Caspy-Demo/1.0', **account})
            with opener.open(request, timeout=30) as response:
                raw = response.read(LIMIT + 1)
            if len(raw) > LIMIT:
                raise RuntimeError('invalid_image')
            return raw

        try:
            progress('connecting')
            event = json.loads(read('/gradio_api/call/infer', {
                'data': [prompt, seed, False, 512, 512, 4]})).get('event_id')
            if not isinstance(event, str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,128}', event):
                raise RuntimeError('space_unavailable')
            progress('waiting_provider')
            result = None
            request = urllib.request.Request(ORIGIN + '/gradio_api/call/infer/' + event,
                headers={'Accept':'text/event-stream','User-Agent':'Caspy-Demo/1.0', **account})
            # Consume complete SSE events immediately; waiting for EOF can hang
            # even after the provider has already returned the finished image.
            with opener.open(request, timeout=30) as response:
                kind, lines, size = '', [], 0
                while True:
                    if time.monotonic() > deadline: raise RuntimeError('space_timeout')
                    raw = response.readline(LIMIT + 1)
                    size += len(raw)
                    if size > LIMIT: raise RuntimeError('space_unavailable')
                    if not raw: break
                    line = raw.decode().rstrip('\r\n')
                    if line.startswith('event:'): kind = line[6:].strip()
                    elif line.startswith('data:'): lines.append(line[5:].lstrip(' '))
                    elif not line:
                        if kind == 'error': raise RuntimeError('space_quota')
                        if kind == 'complete':
                            result = json.loads('\n'.join(lines)); break
                        kind, lines = '', []
            if not isinstance(result, list) or len(result) < 2 or result[1] != seed:
                raise RuntimeError('space_unavailable')
            file = result[0]
            image_url = file.get('url') if isinstance(file, dict) else None
            if not isinstance(image_url, str):
                raise RuntimeError('invalid_image')
            parsed = urlsplit(image_url)
            # Never fetch arbitrary model-returned URLs or send credentials.
            if parsed.scheme != 'https' or parsed.netloc != urlsplit(ORIGIN).netloc or not parsed.path.startswith('/gradio_api/file=') or parsed.query or parsed.fragment:
                raise RuntimeError('invalid_image')
            progress('downloading')
            raw = read(parsed.path)
            progress('validating')
            with tempfile.TemporaryDirectory() as folder:
                source = Path(folder) / 'source.png'
                source.write_bytes(raw)
                normalized = subprocess.run([sys.executable, str(Path(__file__).with_name('normalize_candy_image.py')), str(source), str(target)],
                    capture_output=True, timeout=30)
                if normalized.returncode:
                    raise RuntimeError('invalid_image')
        except urllib.error.HTTPError as error:
            if error.code == 401 and self.token: raise RuntimeError('authentication') from None
            raise RuntimeError('space_quota' if error.code in (401, 403, 429) else 'space_unavailable') from None
        except TimeoutError:
            raise RuntimeError('space_timeout') from None
        except urllib.error.URLError as error:
            raise RuntimeError('space_timeout' if isinstance(error.reason,TimeoutError) else 'space_unavailable') from None
        except (OSError, ValueError):
            raise RuntimeError('space_unavailable') from None
        return {'ok': True, 'model': self.model, 'provider': self.provider,
                'steps': 4, 'width': 512, 'height': 512, 'space': SPACE,
                'safety_checker': False,
                'content_controls': 'win gate and candy-only art direction; no verified image safety classifier',
                'prompt_processing': 'public third-party Space; ' + ('account' if self.token else 'anonymous') + ' quota; no paid fallback'}
