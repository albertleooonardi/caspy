#!/usr/bin/env bash
# One-time local image runtime/model setup. No server or paid API is started.
set -euo pipefail
cd "$(dirname -- "${BASH_SOURCE[0]}")"
if [ "$(uname -s)" != Darwin ] || [ "$(uname -m)" != arm64 ]; then
  echo 'The local MLX backend requires an Apple Silicon Mac.' >&2; exit 1
fi
if [ ! -x .venv-flux/bin/python ]; then
  command -v uv >/dev/null || { echo 'Install uv from https://docs.astral.sh/uv/getting-started/installation/ first.' >&2; exit 1; }
  uv venv --python 3.14 .venv-flux
fi
.venv-flux/bin/python -m pip --version >/dev/null 2>&1 && INSTALLER=pip || INSTALLER=uv
if [ "$INSTALLER" = uv ]; then uv pip install --python .venv-flux/bin/python -r scripts/requirements-flux-local.txt;
else .venv-flux/bin/python -m pip install -r scripts/requirements-flux-local.txt; fi
.venv-flux/bin/python scripts/setup_local_flux.py
