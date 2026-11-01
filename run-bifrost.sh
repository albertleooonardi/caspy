#!/usr/bin/env bash
# Dev helper: load .env and run the local Bifrost gateway for caspy.
# The gateway serves the OpenAI-compatible API at http://localhost:8080.
# Usage: bash run-bifrost.sh
set -a
. "$(dirname "$0")/.env"
set +a

APP_DIR="$(dirname "$0")/data"
mkdir -p "$APP_DIR"

exec bifrost \
  --app-dir "$APP_DIR" \
  --port 8080 \
  --log-style json \
  --log-level info
