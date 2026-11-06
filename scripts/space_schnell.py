"""Quota-limited official FLUX Schnell Space. No paid inference fallback.

The public Space receives the redacted art prompt after the game's explicit
generation consent. Anonymous calls do not attach HF_TOKEN or billing credentials.
The remote API can queue, throttle, fail or change; failures preserve the reward.
"""
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from urllib.parse import urlsplit

from bifrost_setup import NoRedirect

SPACE = 'black-forest-labs/FLUX.1-schnell'
ORIGIN = 'https://black-forest-labs-flux-1-schnell.hf.space'
LIMIT = 15_000_000


class SpaceSchnell:
    model = 'black-forest-labs/FLUX.1-schnell'
    provider = 'huggingface-zerogpu-space'
    local = False
    configured = True

    def render(self, prompt, seed, target):
        opener = urllib.request.build_opener(NoRedirect())

        def read(path, body=None):
            request = urllib.request.Request(ORIGIN + path,
                data=None if body is None else json.dumps(body).encode(),
                headers={'Content-Type': 'application/json', 'User-Agent': 'Caspy-Demo/1.0'})
            with opener.open(request, timeout=240) as response:
                raw = response.read(LIMIT + 1)
            if len(raw) > LIMIT:
                raise RuntimeError('invalid_image')
            return raw

        try:
            event = json.loads(read('/gradio_api/call/infer', {
                'data': [prompt, seed, False, 512, 512, 4]})).get('event_id')
            if not isinstance(event, str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,128}', event):
                raise RuntimeError('space_unavailable')
            stream = read('/gradio_api/call/infer/' + event).decode()
            result = None
            for block in stream.replace('\r\n', '\n').split('\n\n'):
                lines = block.splitlines()
                kind = next((line[7:] for line in lines if line.startswith('event: ')), '')
                if kind == 'error':
                    raise RuntimeError('space_quota')
                if kind == 'complete':
                    result = json.loads('\n'.join(line[6:] for line in lines if line.startswith('data: ')))
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
            raw = read(parsed.path)
            with tempfile.TemporaryDirectory() as folder:
                source = Path(folder) / 'source.png'
                source.write_bytes(raw)
                normalized = subprocess.run([sys.executable, str(Path(__file__).with_name('normalize_candy_image.py')), str(source), str(target)],
                    capture_output=True, timeout=30)
                if normalized.returncode:
                    raise RuntimeError('invalid_image')
        except urllib.error.HTTPError as error:
            raise RuntimeError('space_quota' if error.code in (401, 403, 429) else 'space_unavailable') from None
        except (OSError, ValueError):
            raise RuntimeError('space_unavailable') from None
        return {'ok': True, 'model': self.model, 'provider': self.provider,
                'steps': 4, 'width': 512, 'height': 512, 'space': SPACE,
                'safety_checker': False,
                'content_controls': 'win gate and candy-only art direction; no verified image safety classifier',
                'prompt_processing': 'public third-party Space; anonymous quota; no paid fallback'}
