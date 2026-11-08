# Reviewed source publication request

Destination: **https://github.com/albertleooonardi/caspy** (existing public repository).
Proposed branch: `codex/cloud-preview-20261106`; `main` stays unchanged.

This snapshot includes the current requested dashboard, contributor replay and
UI checkpoint, plus full-NFT cloud preparation, CI/CD, tests and documentation.
The public deployment JSON contains compiled contract bytecode/ABIs and an
unfunded voucher signer **address**, never its private key.

Excluded: `.env`, `data/`, account credentials, database snapshots, generated
private artwork/prompts, model weights, dependencies and hosting authentication.
A focused credential-pattern scan found no candidates in the proposed files;
this is a safeguard, not a guarantee of a complete security audit.

Automatic approval review rejected the original broad `git add .` and push.
The user then explicitly approved this source-only list. It was committed and
pushed as `391162282fde418c62650860e00b0c1028330d70`; all four GitHub CI jobs passed.
The Vercel frontend build is READY. Railway declined project creation due to
expired trial; Render declined free-service creation until billing is added.
The user cannot add a card and selected a quota-limited Codespaces demo instead.

Follow-up work adapts the reviewed backend to the user-selected Codespace.
Full-game activation still needs your two Base Sepolia wallet transactions and
private backend environment configuration.

## Files proposed for publication

- `.dockerignore`
- `.env.example`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `.gitignore`
- `.kiro/steering/project.md`
- `PRD.md`
- `deploy/api.Dockerfile`
- `deploy/railway-api.json`
- `docs/cloud-deployment.md`
- `docs/cloud-release-review.md`
- `docs/ui-ux-refresh-2026-11-06.md`
- `frontend/api/[...path].ts`
- `frontend/package.json`
- `frontend/public/deployment/base-sepolia.json`
- `frontend/scripts/api-proxy.test.ts`
- `frontend/scripts/nft-bridge.mjs`
- `frontend/scripts/nft-bridge.test.mjs`
- `frontend/scripts/prepare-testnet.mjs`
- `frontend/scripts/write-release.mjs`
- `frontend/src/components/App.tsx`
- `frontend/src/components/CandyPages.tsx`
- `frontend/src/components/PlatformPages.tsx`
- `frontend/src/components/TestnetDeployment.tsx`
- `frontend/src/components/UserDashboard.tsx`
- `frontend/src/lib/game.ts`
- `frontend/src/lib/wallet.ts`
- `frontend/src/pages/[page].astro`
- `frontend/src/pages/deploy-testnet.astro`
- `frontend/src/styles/experience.css`
- `frontend/vercel.json`
- `scripts/candy_store.py`
- `scripts/cloud_start.py`
- `scripts/cloud_storage.py`
- `scripts/deploy_render.py`
- `scripts/heist_api.py`
- `scripts/nft_game.py`
- `scripts/platform_store.py`
- `scripts/runtime_config.py`
- `scripts/space_schnell.py`
- `scripts/test_cloud_storage.py`
- `scripts/test_heist_api.py`
- `scripts/test_nft_integration.py`
- `scripts/test_platform_http.py`
- `scripts/test_platform_store.py`
- `scripts/test_runtime_config.py`
- `scripts/test_space_schnell.py`
- `scripts/test_supabase.py`
