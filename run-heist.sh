#!/usr/bin/env bash
# Start Caspy's frontend, local blockchain, Bifrost, and game API.
set -euo pipefail
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

NFT_MODE=true
case "${1:-}" in
  ''|--nft) ;;
  --ai-only) NFT_MODE=false ;;
  --help|-h)
    echo 'Usage: bash run-heist.sh [--ai-only | --nft]'
    echo 'Default: frontend + local Anvil blockchain/NFTs + Bifrost + game API.'
    echo '--ai-only: frontend + Bifrost + game API, without blockchain or NFT claims.'
    exit 0 ;;
  *) echo 'Usage: bash run-heist.sh [--ai-only | --nft]' >&2; exit 1 ;;
esac
if [ "$#" -gt 1 ]; then echo 'Provide at most one option. Use --help for usage.' >&2; exit 1; fi
command -v python3 >/dev/null 2>&1 || { echo 'Python 3 is required.' >&2; exit 1; }

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
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ] || { echo 'Node.js 22 or later is required.' >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo 'curl is required.' >&2; exit 1; }
command -v bifrost >/dev/null 2>&1 || { echo 'Install Bifrost: npm install -g @maximhq/bifrost' >&2; exit 1; }
python3 scripts/bifrost_setup.py check

# Refuse conflicting app instances before starting any services.
python3 - <<'PY'
import socket
for port in (8000, 4321):
    with socket.socket() as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(('127.0.0.1', port))
        except OSError:
            raise SystemExit(f'Port {port} is busy. Stop the existing game API/frontend, then run this launcher again.')
PY
if [ ! -d frontend/node_modules ]; then (cd frontend && npm ci); fi

pids=()
names=()
cleanup() {
  trap - EXIT INT TERM
  # Stop consumers before the services they depend on.
  for ((i=${#pids[@]}-1; i>=0; i--)); do kill "${pids[$i]}" 2>/dev/null || true; done
  for ((i=0; i<${#pids[@]}; i++)); do wait "${pids[$i]}" 2>/dev/null || true; done
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Poll readiness instead of relying on a fixed startup delay.
wait_for_service() {
  python3 - "$1" "$2" "${3:-}" "${4:-http}" <<'PY'
import json
import os
import sys
import time
import urllib.request
name, url, pid, kind = sys.argv[1:]
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
for _ in range(90):
    if pid:
        try:
            os.kill(int(pid), 0)
        except ProcessLookupError:
            raise SystemExit(f'{name} exited during startup. Check its output above.')
    try:
        req = urllib.request.Request(url)
        if kind == 'chain':
            req = urllib.request.Request(url, data=b'{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}', headers={'Content-Type': 'application/json'})
        with opener.open(req, timeout=1) as response:
            if kind == 'chain' and json.load(response).get('result') != '0x7a69':
                raise SystemExit('Expected local Anvil chain 31337 on port 8545. Stop the conflicting RPC service.')
            if response.status == 200:
                print(f'{name} ready: {url}', flush=True)
                break
    except (OSError, ValueError):
        pass
    time.sleep(0.5)
else:
    raise SystemExit(f'{name} did not become ready. Check its startup output.')
PY
}

if [ "$NFT_MODE" = true ]; then
  # Install only the small hosted-inference client, never model weights.
  if python3 - <<'PY'
import sys
sys.path.insert(0, 'scripts')
from bifrost_setup import environment, ROOT
env=environment(ROOT)
raise SystemExit(0 if env.get('CASPY_IMAGE_BACKEND','local-schnell')=='hf-dev' and env.get('HF_TOKEN') else 1)
PY
  then
    [ -x .venv/bin/python ] || python3 -m venv .venv
    if ! .venv/bin/python -c 'import huggingface_hub, PIL, urllib3; assert huggingface_hub.__version__ == "0.36.2" and PIL.__version__ == "11.3.0" and int(urllib3.__version__.split(".")[0]) < 2' >/dev/null 2>&1; then
      .venv/bin/python -m pip install -r scripts/requirements-candy.txt
    fi
  fi
  if [ ! -f data/flux/ready.json ]; then echo 'Local candy images need one-time setup: bash setup-flux.sh (unless using hf-dev).'; fi
  echo 'Preparing local blockchain and NFT contract...'
  if [ ! -x blockhain/node_modules/.bin/anvil ] || [ ! -x blockhain/node_modules/.bin/forge ]; then (cd blockhain && npm ci); fi
  if [ ! -f blockhain/lib/forge-std/src/Test.sol ]; then
    git clone --depth 1 --branch v1.9.7 https://github.com/foundry-rs/forge-std.git blockhain/lib/forge-std
  fi
  (cd blockhain && npm run build)
  mkdir -p data
  CHAIN_PID=''
  if ! curl --noproxy '*' -fsS -H 'Content-Type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' http://127.0.0.1:8545 >/dev/null 2>&1; then
    node blockhain/node_modules/@foundry-rs/anvil/bin.mjs --host 127.0.0.1 --port 8545 --chain-id 31337 --state data/anvil-state.json --state-interval 1 --silent &
    CHAIN_PID=$!
    pids+=("$CHAIN_PID"); names+=('Blockchain')
  fi
  wait_for_service 'Blockchain' 'http://127.0.0.1:8545' "$CHAIN_PID" chain
  node --experimental-strip-types frontend/scripts/setup-local-nft.mjs
  export CASPY_NFT_ENABLED=true
  export PUBLIC_MARKET_ADDRESS="$(python3 -c 'import json; print(json.load(open("data/nft-local.json"))["market"])')"
  export PUBLIC_CONTRACT_ADDRESS="$(python3 -c 'import json; print(json.load(open("data/nft-local.json"))["contract"])')"
  export PUBLIC_NFT_SEASON="$(python3 -c 'import json; print(json.load(open("data/nft-local.json"))["deployment_block_hash"])')"
else
  export CASPY_NFT_ENABLED=false
fi

BIFROST_PID=''
if ! curl --noproxy '*' -fsS http://127.0.0.1:8080/health >/dev/null 2>&1; then
  bash run-bifrost.sh &
  BIFROST_PID=$!
  pids+=("$BIFROST_PID"); names+=('Bifrost')
fi
wait_for_service 'Bifrost' 'http://127.0.0.1:8080/health' "$BIFROST_PID"

python3 scripts/heist_api.py &
API_PID=$!
pids+=("$API_PID"); names+=('Game API')
wait_for_service 'Game API' 'http://127.0.0.1:8000/health' "$API_PID"

(
  cd frontend
  exec env PUBLIC_LOCAL_AI=true PUBLIC_NFT_ENABLED="$NFT_MODE" node node_modules/astro/astro.js dev --host 127.0.0.1
) &
FRONTEND_PID=$!
pids+=("$FRONTEND_PID"); names+=('Frontend')
wait_for_service 'Frontend' 'http://127.0.0.1:4321/play' "$FRONTEND_PID"
echo 'Caspy is ready: http://localhost:4321/play'
echo 'Bifrost dashboard: http://127.0.0.1:8080'
echo 'Press Ctrl+C to stop the services this launcher started.'

# Bash 3.2 (macOS) has no wait -n; monitor every managed service explicitly.
while true; do
  for ((i=0; i<${#pids[@]}; i++)); do
    if ! kill -0 "${pids[$i]}" 2>/dev/null; then
      echo "${names[$i]} stopped. Shutting down the remaining Caspy services." >&2
      exit 1
    fi
  done
  sleep 1
done
