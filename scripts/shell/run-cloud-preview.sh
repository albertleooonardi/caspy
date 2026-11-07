#!/usr/bin/env bash
# Run the production-mode API/Bifrost in the user's Codespace, never local Anvil.
# User/CI supplies an ignored root .env and confirmed Base Sepolia config first.
set -euo pipefail
umask 077
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_DIR"
if [[ "${CODESPACES:-}" != "true" ]]; then
  echo "This helper is only for the selected GitHub Codespaces demo." >&2
  exit 1
fi
if [[ ! -f .env ]]; then
  echo "Configure the private server .env in this Codespace first. Never commit it." >&2
  exit 1
fi
if [[ -f "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
  # nvm is the Codespace's installed runtime manager, not an untrusted dotenv file.
  source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  nvm install 24.13.1
  nvm use 24.13.1
fi
node -e 'if(Number(process.versions.node.split(".")[0])<22)throw Error("Node 22+ required")'
if [[ ! -x .venv/bin/python ]]; then python3 -m venv .venv; fi
.venv/bin/python -m pip install --disable-pip-version-check -r scripts/requirements-database.txt -r scripts/requirements-candy.txt
npm ci --omit=dev --prefix frontend
if ! command -v bifrost >/dev/null 2>&1; then npm install --global @maximhq/bifrost@1.6.3; fi
export PORT=8000 CASPY_NFT_CONFIG="$PROJECT_DIR/data/nft-sepolia.json"
exec .venv/bin/python scripts/cloud_start.py
