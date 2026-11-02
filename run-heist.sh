#!/usr/bin/env bash
# Run the local AI playground; all services bind to loopback.
set -euo pipefail
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
# IDE shells may not load nvm from .zshrc.
if ! command -v node >/dev/null 2>&1; then
  NODE_BIN="$(python3 - <<'PY'
from pathlib import Path
paths = list((Path.home() / '.nvm/versions/node').glob('*/bin/node'))
paths.sort(key=lambda p: tuple(map(int, p.parent.parent.name.lstrip('v').split('.'))))
print(paths[-1].parent if paths else '')
PY
)"
  if [ -n "$NODE_BIN" ]; then export PATH="$NODE_BIN:$PATH"; fi
fi
command -v npm >/dev/null 2>&1 || { echo 'Node.js and npm are required.' >&2; exit 1; }
command -v bifrost >/dev/null 2>&1 || { echo 'Install Bifrost: npm install -g @maximhq/bifrost' >&2; exit 1; }
python3 scripts/bifrost_setup.py check
if [ ! -d frontend/node_modules ]; then (cd frontend && npm install); fi
pids=()
cleanup() { for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
if ! curl --noproxy '*' -fsS http://127.0.0.1:8080/health >/dev/null 2>&1; then
  bash run-bifrost.sh &
  pids+=("$!")
fi
python3 - <<'PY'
import time, urllib.request
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
for _ in range(60):
    try:
        with opener.open('http://127.0.0.1:8080/health', timeout=1) as response:
            if response.status == 200:
                break
    except OSError:
        pass
    time.sleep(0.5)
else:
    raise SystemExit('Bifrost did not become ready. Check its startup output.')
PY
python3 scripts/heist_api.py &
pids+=("$!")
sleep 1
kill -0 "${pids[${#pids[@]}-1]}" 2>/dev/null || { echo 'Game API could not start. Check port 8000.' >&2; exit 1; }
echo 'Open http://localhost:4321/play — live AI, no wallet or real minting.'
cd frontend
PUBLIC_LOCAL_AI=true node node_modules/astro/astro.js dev --host 127.0.0.1 &
pids+=("$!")
wait "${pids[${#pids[@]}-1]}"
