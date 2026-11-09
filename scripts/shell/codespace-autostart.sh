#!/usr/bin/env bash
# Start the Caspy demo backend automatically when the Codespace starts.
# Runs from .devcontainer postStartCommand. It only does what an operator would
# do by hand after opening the Codespace: write the private .env from the
# owner's Codespaces secret (if missing), start the checked-out commit with the
# reviewed release helper, then try to make port 8000 public.
# It never keeps the Codespace awake, and never prints secret values.
set -uo pipefail
umask 077
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_DIR" || exit 0
mkdir -p data
LOG="$PROJECT_DIR/data/autostart.log"
log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG"; }

if [[ "${CODESPACES:-}" != "true" ]]; then
  echo "Autostart only runs inside a GitHub Codespace." >&2
  exit 0
fi
log "autostart: begin"

# 1. Private settings: only create .env when it is missing or empty.
if [[ ! -s .env ]]; then
  if [[ -n "${CASPY_PREVIEW_ENV_B64:-}" ]]; then
    if printf '%s' "$CASPY_PREVIEW_ENV_B64" | base64 -d > .env.tmp 2>/dev/null && [[ -s .env.tmp ]]; then
      mv .env.tmp .env && chmod 600 .env && log "autostart: wrote .env from Codespaces secret"
    else
      rm -f .env.tmp; log "autostart: secret could not be decoded; stopping"; exit 0
    fi
  else
    log "autostart: no .env and no CASPY_PREVIEW_ENV_B64 secret; stop and restart the Codespace after adding it"
    exit 0
  fi
fi

# 2. Start the exact checked-out commit (the helper refuses duplicates and
#    mismatched source, and waits for health before returning).
commit="$(git rev-parse HEAD)"
if python3 scripts/codespace_release.py "$commit" >> "$LOG" 2>&1; then
  log "autostart: backend ready for $commit"
else
  log "autostart: release helper failed; see data/cloud-preview.log"
  exit 0
fi

# 3. Best effort: make only port 8000 public for the Vercel proxy.
if command -v gh >/dev/null 2>&1 && [[ -n "${CODESPACE_NAME:-}" ]]; then
  if gh codespace ports visibility 8000:public --codespace "$CODESPACE_NAME" >> "$LOG" 2>&1; then
    log "autostart: port 8000 set to public"
  else
    log "autostart: could not set port 8000 public automatically; set it in the Ports tab"
  fi
fi
log "autostart: done"
