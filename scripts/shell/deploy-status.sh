#!/usr/bin/env bash
# Read-only deployment status: GitHub CI, release flag, live frontend/API revision.
# Makes no changes and prints no secrets. Usage: bash scripts/shell/deploy-status.sh [branch]
set -uo pipefail
cd "$(dirname "$0")/../.."

REPO="${CASPY_REPO:-albertleooonardi/caspy}"
SITE="${CASPY_SITE:-https://caspy-prompt-heist.vercel.app}"
BRANCH="${1:-$(git branch --show-current)}"
LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo none)"

line() { printf '%-22s %s\n' "$1" "$2"; }
short() { printf '%.7s' "$1"; }

echo "== Git"
line "branch" "$BRANCH"
line "local HEAD" "$(short "$LOCAL_SHA")"
line "pushed (origin)" "$(short "$REMOTE_SHA")$([ "$LOCAL_SHA" = "$REMOTE_SHA" ] || echo '  (local differs from origin)')"

echo "== GitHub CI (latest runs for this branch)"
if command -v gh >/dev/null 2>&1; then
  timeout 30 gh run list --repo "$REPO" --branch "$BRANCH" --limit 4 \
    --json name,status,conclusion,headSha \
    --jq '.[] | "\(.headSha[0:7])  \(.name)  \(.status)/\(.conclusion // "-")"' 2>&1 || echo "could not read CI runs"
  echo "== Release switch"
  timeout 30 gh variable list --repo "$REPO" 2>/dev/null | awk '$1=="CASPY_CLOUD_RELEASE_ENABLED"||$1=="CASPY_BACKEND_PROVIDER"{print $1"  "$2}'
  for name in VERCEL_TOKEN CODESPACES_TOKEN; do
    if timeout 30 gh secret list --env production --repo "$REPO" 2>/dev/null | awk '{print $1}' | grep -qx "$name"; then
      line "secret $name" "set (value hidden)"
    else
      line "secret $name" "MISSING in environment production"
    fi
  done
else
  echo "gh CLI not installed"
fi

echo "== Live deployment ($SITE)"
health="$(curl -s --max-time 20 "$SITE/api/health" 2>/dev/null || true)"
if [ -n "$health" ]; then
  live="$(printf '%s' "$health" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("commit") or "unknown")' 2>/dev/null || echo unparsable)"
  line "backend commit" "$(short "$live")$([ "$live" = "$LOCAL_SHA" ] && echo '  matches local HEAD' || echo '  differs from local HEAD')"
else
  line "backend" "no response (Codespace asleep or port 8000 private?)"
fi
release="$(curl -s --max-time 20 "$SITE/release.json" 2>/dev/null || true)"
if [ -n "$release" ]; then
  fe="$(printf '%s' "$release" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("commit","unknown"))' 2>/dev/null || echo unparsable)"
  line "frontend commit" "$(short "$fe")$([ "$fe" = "$LOCAL_SHA" ] && echo '  matches local HEAD' || echo '  differs from local HEAD')"
else
  line "frontend" "no release.json response"
fi
