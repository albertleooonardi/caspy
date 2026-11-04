#!/usr/bin/env bash
# Validate the local configuration, then start Bifrost on loopback.
# Usage from project root: bash scripts/shell/run-bifrost.sh
set -euo pipefail
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
exec python3 "$PROJECT_DIR/scripts/bifrost_setup.py" run
