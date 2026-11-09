# Caspy cloud preview — 6 November 2026

**7 November status:** the user approved source publication. Branch
`codex/cloud-preview-20261106`, draft [PR #1](https://github.com/albertleooonardi/caspy/pull/1).
[GitHub CI](https://github.com/albertleooonardi/caspy/actions/runs/42234188394)
passed all four jobs for `3911622`, including Linux Docker and isolated NFT tests.
The Vercel frontend is READY at https://caspy-prompt-heist.vercel.app; this is
operator/demo UI, **not activated full cloud gameplay**. Its first deployment
was assigned Vercel's production target by the API; protection was preserved.
The connector cannot fetch protected pages with its current alias permissions.

Railway trial expired. Render returned HTTP 402 requiring payment information
even for the free service; the user cannot add a card. No backend service was
created and no paid plan was selected. The user selected a **GitHub Codespaces
demo backend** within included usage. It sleeps/stops and is not always-on
production hosting. New Docker Spaces are not a free alternative under current
Hugging Face creation requirements. The existing anonymous Schnell image Space
was verified separately and remains usable subject to quota.

Codespaces configuration is `.devcontainer/devcontainer.json`, with only port
8000 forwarded privately by default. `scripts/shell/run-cloud-preview.sh` starts
the production-mode API/private Bifrost, never Anvil. After confirmed testnet
configuration and private environment transfer, `scripts/codespace_release.py`
starts/verifies the exact commit. Only then may port 8000 be made public for the
Vercel proxy. Ports 8080/8545 remain unforwarded. No keepalive circumvents idle
timeout or quota. Workspace data is not a substitute for persistent Supabase.

For CI/CD set `CASPY_BACKEND_PROVIDER=codespaces`, `CASPY_CODESPACE_NAME`, and
`CASPY_BACKEND_URL`; the protected deployment environment needs a scoped
`CODESPACES_TOKEN` instead of `RENDER_API_KEY`. Vercel still needs `VERCEL_TOKEN`.
Production environment now has a required owner reviewer and a main-only branch
policy; Vercel project IDs are configured. `CASPY_CLOUD_RELEASE_ENABLED=false`
until full deployed-game QA passes. Never print tokens or copy them into source.

The private backend environment is prepared in ignored
`data/credentials/render-preview.env` (0600; historical filename). The confirmed
contract JSON is now saved; use the current Codespaces bundle described below. This file is server-only, never a frontend env
or CI artifact. Regenerate its contract setting after wallet deployment; a
Codespace uses port 8000 and its workspace path rather than Docker's `/app`.

**7 November deployed checkpoint:** the full-feature testnet preview is configured
at https://caspy-prompt-heist.vercel.app. Frontend release `d84137c` is READY;
backend is running the same exact commit. Public proxy checks returned
200 for health (Base Sepolia, minting enabled), candy configuration and marketplace
listings. Both live gateway checks passed: actor stream and independent strict
JSON judge. This is an available testnet preview, not completed browser/wallet
end-to-end QA. See `docs/qa-cloud-2026-11-07.md` for evidence and remaining checks.

- Candy: `0x29545806dda87005d8e7b8b203f08a7dd45956bb`.
- Marketplace: `0xb829ac0181ed55beb70e024e137ff4ebb64bd9e0`.
- Voucher signer: `0x0151Fefd570E611d40cA9bEa78aF50068C11B097` (public address).
- Confirmed configuration is in ignored `data/nft-sepolia.json`. Read-only RPC
  verified v2, signer role, marketplace linkage, maximum supply 1,000 and zero
  minted at initial verification. Never redeploy these contracts merely to
  restart the backend.
- The current private bundle is `data/credentials/codespaces-preview.env`.
  It preserves the verified IPv4 Supabase **Session pooler on port 5432** and
  separate Bifrost database roles. Do not regenerate it from the historical
  direct-connection Render bundle.
- Codespaces API port 8000 is public; Bifrost 8080 and Anvil 8545 are not forwarded.
  Codespaces can idle/stop within quota; the service is not always-on hosting.
- Fixed actual deployment issues: 200-block public RPC event limit (paginated
  reads), orphan Bifrost child processes on restart (service process groups),
  and Vercel nested API routing/wildcard query metadata (explicit proxy rewrite).
- Automatic release remains disabled, protected main-only environment retained;
  scoped `CODESPACES_TOKEN` and `VERCEL_TOKEN` still need owner configuration.

The original Render plan and its configuration below remain as a documented
fallback if billing becomes available, not the currently selected backend.

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

## Recovering after Codespaces stops

An observed 7 November outage left Vercel's static frontend online while its API
proxy returned 502: the running Codespace had no API process and port 8000 had
reverted to private, redirecting Vercel to GitHub authentication. The configured
Codespaces idle timeout is 30 minutes; restarting the editor alone does not start
the backend. This demo is not always-on hosting.

After starting the existing Codespace, in its project terminal run:

```sh
.venv/bin/python scripts/codespace_release.py "$(git rev-parse HEAD)"
```

Wait for the exact-release readiness message, then make **only port 8000 public**
in the Ports tab. Keep 8080 and 8545 unforwarded. Do not re-deploy the contracts,
regenerate the signer or reset Supabase. From the local authenticated GitHub CLI,
the port command is `gh codespace ports visibility 8000:public --codespace caspy-nft-demo-jjw5666x9jjvfqxg6`.

Backend release `eaedfd3` replaces historical event scans for active listings and
collection ownership with current contract storage reads. Direct public-chain
market/collection reads completed in under one second during verification;
three disposable local-chain mint/trading integration tests passed (live-AI test
intentionally skipped). Historical sales/status event queries still use range
pagination. Frontend remains on its independent chat release `b846244`.

## Image/reward recovery release — 7 November

Backend `7bd583c`, frontend `eb2ef92` (Vercel deployment
`dpl_Df7dbjwen2kXixNmbgX849kBsypj`) are deployed and healthy. The result page
publishes ready artwork before checking mint status, serializes polling, shows
real generation phases and supports saved-image reload. Mint checks use storage
or one receipt block rather than deployment-age event scans. The Space parser
stops on SSE completion instead of EOF. Public hash-addressed PNG/JSON assets are
cached without account/tunnel cookies; private API responses remain no-store.
A fictional real cloud image generated in 3.77s; original saved-artwork CDN HIT
was 0.187s. Provider queues and Codespaces sleep remain operational limitations.
Full findings and test evidence: `docs/image-generation-analysis-2026-11-07.md`.
Do not regenerate existing ready rewards when troubleshooting a display failure.

## Gemini text-provider checkpoint — 7 November 2026

Release `938ad4e7f805b3a10f6f16f6e124e4133e72b9ea` is deployed on Vercel
(`dpl_GZTyidJn1JkX4L7pNn7BVzGx5zMh`) and Codespaces. Both health/source checks
passed; all four CI jobs passed (run 42386166642). OpenRouter had returned HTTP
429 `free-models-per-day`; Gemini is now the configured text provider.

- Actor: `gemini/gemini-3.1-flash-lite`; fallback `gemini/gemini-2.5-flash-lite`.
- Judge: `gemini/gemini-3.6-flash`; fallback `gemini/gemini-2.5-flash`.
- Gemini primary streaming and strict JSON smoke passed. An in-memory fictional
  turn through the actual actor and full candy judge schema completed in 3.83s;
  served model IDs matched both primaries, with creativity/coherence/specificity
  validated. No player attempt, persisted game, reward or transaction was created.
- Native credential/model preflight succeeded; actor text took 0.97s and judge
  structured JSON 1.85s. These are individual observations, not guaranteed latency.
- Explicit Gemini text-model allowlists preserve distinct actor/judge models,
  virtual keys, rate limits, shared budgets and separate database roles. The
  `use-gemini` command backs up existing config before switching; default example
  remains OpenRouter for existing installations.
- `GEMINI_API_KEY` is server-only in ignored root/cloud environments. Never copy
  it into Vercel public variables, source or a report. The user provided the key
  for a requested free-tier project; `CASPY_GEMINI_FREE_TIER_CONFIRMED=true` records
  that choice. No billing setting was changed. The flag is an operator assertion,
  not an API-based verification of Google's billing account.
- Configure an eligible free-tier project without billing, add the key privately,
  then run `python3 scripts/bifrost_setup.py use-gemini` before restarting. Local
  development servers remain user-started. Cloud deploy uses the existing reviewed
  Codespace release helper, then only API port 8000 becomes public after health.
- Request reasoning uses Gemini's minimal effort mapping. Hosted image generation
  remains FLUX.1-schnell; no image/paid/tool models were added to the Gemini routes.
- The privacy page describes hosted Google free-tier processing separately from
  optional Caspy research sharing. Google free quotas and Codespaces idle limits
  remain; they are not bypassed. Quota errors now explain the limit and preserve
  an unstarted reply's attempt.
- The supplied key appeared in chat: rotate it, save its replacement privately in
  `.env`, and update the cloud bundle before retiring the old deployed credential.

Provider references: https://docs.getbifrost.ai/providers/supported-providers/gemini,
https://ai.google.dev/gemini-api/docs/pricing,
https://ai.google.dev/gemini-api/docs/rate-limits.

## v3 activated — 8 November 2026

The user's downloaded v3 configuration was verified against runtime bytecode,
version, maximum supply, signer role, marketplace linkage and deployment block
hash. Candy `0x13cc9bb8ede8f77e4552715040555b924558c690`, marketplace
`0xa6ab784124e952d478d3dd2a2475e1353a934ec5`, block 55968978. Frontend
Vercel deployment `dpl_8hB76V2v8YtemSdPmX2U4YAdgfXx` READY and backend
both use source `f90e0c0` and the new public configuration. Live candy/config
and frontend JS address checks matched; new season initially has zero reserved
rewards. No player turn, generated image or public-chain transaction was
created by the activation checks. The active backend now enables multiple
rewards from distinct eligible heists for one wallet. Real user minting on v3
remains to be verified.

Old public config is preserved as ignored
`data/nft-sepolia-v2-before-v3-20261108.json`; private cloud environment backup
is `data/credentials/codespaces-preview.before-v3-20261108.env` (0600).
Never print the environment backup. Supabase keeps old rewards/snapshots and
assets. New session storage key and wallet scope use the new season, so refresh,
reconnect/sign once, and start a new heist. Old v2 wins do not automatically
become v3 entitlements, and old NFTs are not shown by the v3-scoped collection.
Codespaces still sleeps; this change does not provide 24/7 hosting.

## Saved artwork status repair — 8 November 2026

Release f49b8ac is live on Vercel and Codespaces. A ready candy's ensure_win
serialized its public metadata inside the reward reservation transaction.
Reading PostgreSQL blobs on a second connection could wait on that same
transaction's advisory lock. Reservation now exits before serialization; the
concurrent generate re-read branch also exits before metadata access. A guard
regression rejects nested transactions. Three cloud storage tests, 12 candy
tests, the real disposable-Supabase blob fixture, 27 frontend tests, type check,
build and all four CI jobs passed. Existing user reward status returned ready
in 0.09s with one generation attempt and unchanged S/91 assessment. No new
image, heist or mint was created.

Gameplay progress now uses Prepare/Create candy/Save artwork, without model
names, GPU/setup instructions or seed jargon. Hosted prompt processing remains
disclosed in an expandable consent detail and privacy notice. Collection no
longer prints the generator model. Technical provenance stays in immutable
metadata. The grading rule is unchanged: this S was 16+18+17+40=91; with zero
earlier prompts, v1 awarded full novelty. This is an uncalibrated rubric, not
a guaranteed B/S outcome. Do not silently regrade saved or minted awards.

## Heist history and automatic artwork updates — 8 November 2026

Release f1cd4fe adds /heists, linked from dashboard Recorded heists, View all
heists, recent activity and Account. Account-owned transcript/outcome/grade/token
details use GET /account/heists/<id>; ownership is checked before current or
archived snapshot lookup. Old seasons are read-only; missing snapshots are
reported, not reconstructed from research samples. History reads do not need
wallet proof; play/mint/trade still do. The reward page uses serialized 2.5-second
status checks, bounded error backoff and immediate foreground/online recovery.
It never automatically generates, rerolls or submits a transaction. Manual
refresh remains optional. User-facing gateway names were removed. See
docs/heist-history-live-updates-2026-11-08.md for validation and limits.

## Migrated wallet index correction — 8 November 2026

Live catalog inspection found candy_jobs_migrated_0, a standalone unique
(namespace,wallet) index from the SQLite migration, still blocking v3 rewards.
The earlier native-constraint-only migration was incomplete. Release e54608a
identifies and removes only exact namespace/wallet unique keys, handling both
standalone and constraint forms. The heist PK, other indexes and saved records
remain intact. A real disposable-Supabase regression with both forms passed,
as did 12 candy-store cases. Unexpected integrity errors now report temporary
reservation failure rather than falsely claiming an existing heist reward.
See docs/reward-index-repair-2026-11-08.md.
