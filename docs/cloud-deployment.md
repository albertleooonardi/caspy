# Caspy cloud preview — 6 November 2026

Target: **full NFT gameplay on Base Sepolia (84532)**. This is a testnet preview,
not mainnet, a production audit, or a claim that every service is already live.

## Selected services

- Vercel `caspy-prompt-heist`: Astro frontend and same-origin `/api/*` streaming proxy.
  Project `prj_Islt0E92COn1SAxH9DBX1N9uKFmB`; owner `team_gzCwaB4orszBfmIRlfMDtfbR`.
- Render: one free Docker web service in the user-confirmed **My Workspace**
  (`tea-d45g930dl3ps738d3f1g`), Singapore. Bifrost listens only on container loopback.
- Existing Supabase: accounts/research plus optional private game snapshots and
  immutable candy blobs. No migration/deletion of existing local games or artwork.
- Official `black-forest-labs/FLUX.1-schnell` Hugging Face ZeroGPU Space:
  anonymous, fixed seed, 512×512, four steps, explicit generation consent. Quotas,
  queues and failures are expected; there is no automatic paid fallback.
- Base Sepolia: separate candy and marketplace contracts; browser-wallet signatures
  and transactions. Never expose Anvil or reuse its development keys publicly.

Railway project creation was rejected because the account's trial expired. No
paid Railway plan was selected. Render free services sleep after inactivity and
have limited resources/usage. This preview does not promise always-on availability.
See [Render free limitations](https://render.com/docs/free) and
[Hugging Face Spaces APIs](https://huggingface.co/docs/hub/spaces-api-endpoints).

## Contract setup — operator wallet action

1. `npm run build --prefix blockhain`.
2. With Node 24 on PATH, `node --experimental-strip-types frontend/scripts/prepare-testnet.mjs`.
   This creates a fresh voucher-only signer in ignored
   `data/credentials/base-sepolia-signer.env` (0600). It is unfunded and never
   printed. Public bytecode and its signer address go into
   `frontend/public/deployment/base-sepolia.json`. Rerunning preserves the signer.
3. Open `/deploy-testnet` on the frontend. Connect a wallet funded with **Base
   Sepolia test ETH**. The operator must approve the two transactions themselves.
   Keep the page open between them. The connected wallet becomes administrator;
   the server signer only authorizes eligible candy vouchers.
4. Download `nft-sepolia.json`, save it as `data/nft-sepolia.json`, and provide the
   public JSON to the backend as `CASPY_NFT_CONFIG_JSON`. Never paste a private key
   or seed phrase into a page or chat.

## Backend configuration

Dockerfile: `deploy/api.Dockerfile`. Command: `python scripts/cloud_start.py`.
One API replica per deployment namespace; snapshots are not a distributed engine.
The startup supervisor validates config, checks existing Supabase stores, starts
private Bifrost, waits for readiness, then starts the API. It forwards termination
to both children. A failed dependency exits the container; it never returns a
fake successful NFT mode. Readiness endpoint: `/health`.

Runtime variables (server-side only):

| Variable | Value/source |
| --- | --- |
| `CASPY_ENV` | `production` |
| `CASPY_PUBLIC_ORIGIN` | Exact stable HTTPS frontend origin, without a path |
| `CASPY_API_HOST` | `0.0.0.0` |
| `PORT` | Render's assigned port (Docker default 8000 is also supported) |
| `CASPY_NFT_ENABLED` | `true` |
| `CASPY_NFT_CONFIG` | `/app/data/nft-sepolia.json` |
| `CASPY_NFT_CONFIG_JSON` | Confirmed public deployment JSON |
| `CASPY_NFT_SIGNER_PRIVATE_KEY` | New private voucher signer; configure privately in hosting settings |
| `CASPY_ASSET_STORAGE` | `postgres` (required for Render free) |
| `CASPY_IMAGE_BACKEND` | `hf-space-schnell` |
| `CASPY_FLUX_DAILY_LIMIT` | `10`, or another explicit small limit |
| `SUPABASE_DB_URL` | Existing server-only database URL |
| `OPEN_ROUTER_API_KEY` | Existing provider credential; only configured free routes |
| `BIFROST_SETUP_TOKEN`, `BIFROST_ADMIN_USERNAME`, `BIFROST_ADMIN_PASSWORD` | Existing gateway settings |
| `BIFROST_CASPY_VK`, `BIFROST_JUDGE_VK` | Existing distinct virtual-key credentials |
| `CASPY_BF_CONFIG_*`, `CASPY_BF_LOGS_*` | Existing isolated PostgreSQL roles, database/host/port/password |
| `BIFROST_TRANSPORT_VERSION` | `v2.4.0` |

Do not import `.env` into a frontend, Git repository, image layer, or CI artifact.
Host secrets need to be configured in Render; connecting MCP does not copy them.
Cloud startup will intentionally fail until contracts and required secrets exist.

The new `caspy.game_snapshots` and `caspy.candy_blobs` tables are private, have RLS
enabled on PostgreSQL, and revoke access from `anon`/`authenticated`. The existing
server database role remains privileged. Snapshot contents include operational
chat history; do not expose them through Supabase clients. Blob hashes are checked
on write and read. Render restarts must not delete these persistent records.
Local development retains its JSON/filesystem storage. No old NFTs are rewritten.

## Frontend configuration

Root directory: `frontend`; Node 24; `npm ci`; `npm run build`; output `dist`.

- `PUBLIC_NFT_ENABLED=true`
- `PUBLIC_NFT_CHAIN_ID=84532`
- `PUBLIC_NFT_RPC_URL=https://sepolia.base.org` (use a dedicated RPC for load)
- `PUBLIC_CONTRACT_ADDRESS` and `PUBLIC_MARKET_ADDRESS`: confirmed contracts.
- `PUBLIC_NFT_SEASON`: deployment block hash.
- `CASPY_BACKEND_URL`: Render HTTPS origin, **server-only**.

The proxy preserves server cookies and SSE, rejects redirects/arbitrary origins,
and limits request bodies. Hosted cookies are Secure/HttpOnly/SameSite=Strict;
POST CSRF checks allow only the exact configured frontend origin. Preview aliases
do not automatically gain access to the production API.

## CI/CD

`.github/workflows/ci.yml` runs frontend checks/build, Python auth/research/image
and temporary HTTP tests, voucher tests, contract tests, disposable Anvil NFT
integration, and a Linux Docker build. No live DB keys, wallet keys or inference
credentials are available to PR checks. Official actions and CLIs are pinned.

`.github/workflows/release.yml` first reuses the checks, then deploys the exact
commit to Render, waits for `live`, validates Base Sepolia health/source, builds
and stages Vercel, verifies its API proxy and release source, then promotes that
same build. It runs only on `main` and is **disabled** until
`CASPY_CLOUD_RELEASE_ENABLED=true` is explicitly configured. Keep Render native
auto-deploy and Vercel Git auto-deploy off for this CI-driven path.

GitHub configuration:

- Environment `production`: required reviewer and deployment branch restriction
  to `main`; review repository code before granting deployment secrets.
- Secrets: `RENDER_API_KEY`, `VERCEL_TOKEN`, scoped to the intended accounts.
- Variables: `RENDER_SERVICE_ID`, `CASPY_BACKEND_URL`, `VERCEL_ORG_ID`,
  `VERCEL_PROJECT_ID`, and finally `CASPY_CLOUD_RELEASE_ENABLED=true`.

Do not enable release before one complete testnet wallet → play → grade → image →
mint → list → buyer purchase → seller payout test passes on the deployed stack.
An initial setup preview is not the full-game launch. Account email verification,
recovery, managed signing, abuse protection, distributed jobs and independent
contract/security review remain production work.
