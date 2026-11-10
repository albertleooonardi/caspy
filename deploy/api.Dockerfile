FROM node:24.13.1-bookworm-slim AS node
FROM python:3.11-slim-bookworm
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY scripts/requirements-database.txt scripts/requirements-candy.txt /tmp/requirements/
RUN python -m venv /app/.venv \
    && /app/.venv/bin/pip install --no-cache-dir -r /tmp/requirements/requirements-database.txt -r /tmp/requirements/requirements-candy.txt
COPY frontend/package.json frontend/package-lock.json /app/frontend/
RUN cd /app/frontend && npm ci --omit=dev \
    && npm install --global @maximhq/bifrost@1.6.3
COPY scripts/ /app/scripts/
COPY frontend/scripts/nft-bridge.mjs /app/frontend/scripts/nft-bridge.mjs
COPY frontend/src/lib/contract.ts /app/frontend/src/lib/contract.ts
COPY frontend/src/lib/chainEvents.ts /app/frontend/src/lib/chainEvents.ts
RUN node --experimental-strip-types --input-type=module -e "await import('./frontend/src/lib/contract.ts'); await import('./frontend/src/lib/chainEvents.ts');"
COPY bifrost.config.example.json /app/bifrost.config.example.json
ENV PATH="/app/.venv/bin:${PATH}" \
    PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 \
    BIFROST_TRANSPORT_VERSION=v2.4.0 \
    CASPY_ENV=production CASPY_API_HOST=0.0.0.0 PORT=8000 \
    CASPY_NFT_ENABLED=true CASPY_NFT_CONFIG=/app/data/nft-sepolia.json \
    CASPY_IMAGE_BACKEND=hf-space-schnell CASPY_ASSET_STORAGE=postgres
RUN mkdir -p /app/data && bifrost --help >/dev/null 2>&1
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s \
  CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('PORT','8000')+'/health',timeout=4)"
CMD ["python", "scripts/cloud_start.py"]
