#!/usr/bin/env bash
# Compatibility entry point. Use ./run.sh from the project root for the complete Caspy stack.
set -euo pipefail
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
exec bash "$PROJECT_DIR/run.sh" "$@"
