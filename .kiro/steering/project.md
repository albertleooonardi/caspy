# Caspy's Prompt Heist — Project Steering

Checkpoint: **4 November 2026**. This file is the continuation guide for Kiro.
Read the implementation before changing behavior; distinguish completed work,
observed QA, and future production requirements. Full requirements:
#[[file:PRD.md]], especially sections 20–22. Older architecture proposals in the
PRD/README are not proof that a service is implemented or deployed.

## Product and reward rules

Caspy is a Halloween persuasion game and an optional AI evaluation/research
platform. A player gets **up to three prompts**, each at most **500 characters**,
to convince the ghost to share candy. A confirmed win can end the heist early.

- Only an independently confirmed, eligible win earns candy. A loss earns **no
  candy, reward image or NFT**. Pending/void results cannot mint.
- The actor replies in character; a separate judge evaluates the conversation.
  Friendly actor text alone never proves a win. Eligible rewards require a clean
  `YIELD`, confidence at least 0.8, no exploit flag/category and server checks.
- Quality (creativity, coherence, specificity) plus collection-relative text
  novelty determines C/B/A/S: 0–59 / 60–74 / 75–89 / 90–100. Grades are persisted
  before artwork and do not change on retry. No gacha, random rarity or rerolls.
- Maximum collection supply is 1,000. One candy per wallet/heist is enforced.
- Source prompts guide candy flavor, color and wrapper motifs. The art direction
  is a wrapped bonbon with two twisted wrapper ends, expressive eyes, purple
  outlines, pastel shading and Halloween accents; not another ghost silhouette.

**Golden rule:** the LLM may influence the outcome but must never hold mint
 authority. Never wire an LLM tool/function to sign, mint, transact, write `won`,
 change grade or consume/refund attempts. All authority stays in server code and
 verified contracts.

## Implemented stack — not the production roadmap

- Frontend: Astro + React/TypeScript, SSE chat and viem/chain bridge.
- API: `scripts/heist_api.py`, Python standard-library HTTP service. It is **not
  FastAPI/Pydantic** today.
- LLM: Bifrost actor and independent judge with existing scoped keys/routes,
  budgets and free-model fallbacks. Local image inference does not make LLM
  calls offline. Do not silently add paid model routes.
- Database: **Supabase PostgreSQL via Psycopg 3.2.13**. Runtime has no SQLite
  fallback. Account login remains Caspy email/password, not Supabase Auth.
- Chain: **local Anvil 31337, test ETH only**. The launcher does not deploy to
  Base mainnet or a public testnet.
- Contracts: v2 `CaspyHeist` ERC-721/EIP-712 and `CaspyCandyMarket` fixed-price
  escrow. Local development signing is implemented; production KMS is not.
- Images: local FLUX.1-schnell via isolated `.venv-flux` / MFLUX 0.24.0 / MLX,
  pinned 4-bit checkpoint, 512×512, four steps, single worker and offline lookup.
  `CASPY_IMAGE_BACKEND=hf-dev` explicitly selects optional hosted FLUX.1-dev,
  which requires server-side HF credentials and provider credits. No paid fallback.
- n8n: `n8n/` is a placeholder only. No workflows or event dispatch are wired;
  the launcher does not start n8n. Future use is optional notifications, never
  game/reward authority.
- Redis, managed identity, cloud KMS, distributed jobs, public asset hosting,
  payments and a public-chain rollout remain future work.

## Repository map

- `run.sh`: **sole root shell entry point** for the implemented stack.
- `scripts/shell/`: all other shell helpers, including Bifrost startup, one-time
  Flux setup and the relocated compatibility launcher.
- `scripts/platform_store.py`, `database.py`: accounts, consent, research,
  dataset licensing, PostgreSQL adapter and transaction handling.
- `scripts/candy_rules.py`, `candy_store.py`, `candy_art.py`, `local_flux.py`:
  reward gate, grading, generation, commitments and private prompt delivery.
- `scripts/check_supabase.py`, `migrate_supabase.py`, `sql/bifrost_postgres.sql`:
  database preflight, completed migration/recovery and PostgreSQL log helper.
- `frontend/`: app routes, account/research/candy UI, walkthrough and assets.
- `blockhain/`: Solidity/Foundry and voucher utilities. This spelling is current;
  do not casually rename it and break launcher/import paths.
- `bifrost/`: ignored third-party gateway clone; do not commit it.
- `data/`: ignored private runtime/recovery files, local chain state and artwork.

## Supabase migration — completed, do not repeat blindly

All three runtime databases moved to private Supabase schemas:

| Schema | Purpose |
| --- | --- |
| `caspy` | Accounts, sessions, wallet links, research and candy jobs |
| `caspy_bifrost_config` | Gateway configuration, routing and governance |
| `caspy_bifrost_logs` | Gateway logs |
| `caspy_archive` | Lossless private recovery snapshots, not live app tables |

Verified checkpoint: **98 live tables / 19,980 rows**. Five legacy databases,
including two old pre-QA copies, were archived with **39,776 rows**. Those five
SQLite databases and their WAL/SHM sidecars were removed; a final scan found zero
SQLite databases under `data/`. Existing password hashes and records were kept.

- Runtime requires server-only `SUPABASE_DB_URL`; Bifrost uses separate
  `CASPY_BF_CONFIG_*` and `CASPY_BF_LOGS_*` roles/credentials in root `.env`.
- Do not expose private schemas to `anon` / `authenticated` or put credentials
  in frontend environment variables. Application RLS and role separation passed.
  API account/workspace authorization must still be enforced.
- TLS is required. Psycopg prepared statements are disabled; transaction advisory
  locking preserves serialized quota checks. Do not remove those invariants when
  changing queries or adding parallel workers.
- Keep `extra_float_digits=3`: the server default rounded pricing values during
  verification. Keep the PostgreSQL-only `bifrost_safe_jsonb` helper: SQLite had
  recorded its migration as a no-op. Review ordering uses an explicit insertion
  sequence instead of depending on SQLite rowid.
- `data/supabase-migration-report.json` holds counts/hashes;
  `supabase-migration-recovery.json` and `supabase-migration-state.json` contain
  private recovery data/credentials. Preserve their 0600 permissions. Never print,
  commit, upload or delete these as routine cleanup.
- SQLite remains only for explicitly requested disposable test fixtures and
  legacy migration reads. Never recreate a runtime SQLite database or restore an
  old SQLite Bifrost config as a workaround.
- Chain state (`data/anvil-state.json`), deployment/NFT game JSON and candy files
  (`data/candy-assets/`) **remain local**. Supabase Storage was not introduced.
- The API currently uses the administrative database URL. A narrower production
  application role and backup/restore operations remain hardening work.

Details: #[[file:docs/supabase.md]]. A normal restart is **not** a reason to rerun
migration or delete `data/`.

## Authentication, research and marketplace boundaries

Email/password accounts use salted PBKDF2, opaque server sessions and
HttpOnly/SameSite cookies (eight-hour account sessions; separate wallet sessions).
Wallet verification/linking is distinct from account login. Password recovery
and email verification are not implemented.

Private play is the default. A named research campaign, research contribution
and commercial research licensing require separate explicit choices. Consent
never changes attempts, win probability or NFT eligibility. Organization scopes,
human review, reviewed releases, manual dataset access grants, filtered exports
and withdrawal are implemented. Redaction does not guarantee anonymity; previously
downloaded copies cannot be recalled. Metrics are exploratory task evaluation,
not proof of general model safety. No automated payments or RLHF training exist.

NFT listing requires prompt-license consent and escrow approval. Buyers pay the
exact fixed test-ETH price; sellers can cancel or withdraw proceeds. Source-prompt
access follows verified ownership or the seller's active escrow listing. It does
not transfer copyright/exclusivity or automatically license a research dataset.
Voucher content/URI hashes, grade agreement, expiry, recipient and replay/supply
checks must remain enforced. Public metadata must exclude raw source prompts.

## Walkthrough checkpoint

`frontend/public/videos/caspy-showcase.mp4` is the current 100-second, ten-chapter
H.264/AAC film (1600×900, 30 fps). It has Halloween music/wordless choir and **no
voiceover**. Eight animated actual-interface screenshots show typing, grade,
artwork approval, generation, finished art and staged mint confirmation. Screens
use labeled fictional tutorial data; they do not establish a real win or mint.
Collection/marketplace remain explanatory illustrations in this edition.

Shared storyboard: `frontend/src/lib/walkthrough.json`; screenshot manifest:
`walkthrough-shots.json`. Keep timing, captions, player chapter UI, written guide
and quiz consistent. Bump the media cache version when changing exported assets;
current version is `kinetic-halloween-website-v5`. Preview typography/crops before
encoding, then decode/verify the final film. Rendering instructions and evidence:
#[[file:docs/animated-walkthrough.md]].

## Run, build and test

User starts the complete application with `./run.sh`; `--ai-only` omits the
blockchain and NFT rewards. It detects nvm Node, installs the pinned database
client in `.venv`, checks all PostgreSQL stores and manages service readiness.
One-time image setup is `bash scripts/shell/setup-flux.sh` on Apple Silicon.

**Never run development servers/watchers from the agent.** Ask the user to start
or restart the launcher. Temporary isolated test HTTP servers/Anvil processes
used by integration tests are permitted. Do not kill unrelated processes or
start duplicate apps on occupied ports.

| Check | Command from root |
| --- | --- |
| Database preflight (read-only) | `.venv/bin/python scripts/check_supabase.py` |
| Frontend | `npm run check --prefix frontend`, `npm test --prefix frontend`, `npm run build --prefix frontend` |
| Python regression | `.venv/bin/python -m unittest discover -s scripts -p 'test_*.py' -v` |
| Live Supabase fixtures | `CASPY_RUN_SUPABASE_TESTS=1 CASPY_RUN_HTTP_TESTS=1 .venv/bin/python -m unittest discover -s scripts -p 'test_supabase.py' -v` |
| Optional local-chain integration | `CASPY_RUN_CHAIN_TESTS=1 .venv/bin/python -m unittest discover -s scripts -p 'test_nft_integration.py' -v` |
| Contracts | `npm run build --prefix blockhain`, `npm test --prefix blockhain` |
| Voucher signer | `.venv/bin/python -m pytest blockhain/utils/test_voucher_signer.py -q` |
| Shell syntax | `bash -n run.sh scripts/shell/*.sh` |

Live Supabase tests create/drop only their random private `caspy_test_*` schemas
with fictional data; never point destructive fixtures at the live `caspy` schema.
Use `.venv/bin/python` for database dependencies, `.venv-flux/bin/python` only for
image inference. Some IDE terminals need their nvm Node bin directory on PATH.

## Verified results and next work

Completed migration checks: **25 live PostgreSQL regression cases**, 3 adapter
checks, 4 migration safeguard tests, 13 Bifrost setup tests, plus local store/candy
regressions. All three connection preflights, schema isolation/RLS and migration
content hashes passed after cleanup. Walkthrough media checks and frontend tests/
build passed in the earlier video task. These are dated results, not perpetual
certification; do not claim tests were rerun when they were not.

Next priorities, in order:

1. Full-stack startup after Supabase migration passed live QA on 4 November:
   frontend 4321, API 8000 and Bifrost 8080 health returned HTTP 200.
2. `/candy/config` reports local FLUX.1-schnell, `generation_local: true`,
   `configured: true`. Runtime activation is verified; a fresh end-to-end
   render/mint still needs a genuinely eligible live win.
3. Complete a real eligible heist → local art → voucher → mint → collection →
   listing → purchase → private prompt-access check. Fixture chain tests and
   staged tutorial screenshots do not replace that end-to-end validation.
4. Fix/calibrate judge category/flag consistency. One benign declined story was
   labeled `exploit_attempt` while `exploit_flag` was false. Preserve reward gates;
   do not loosen them to make a test win.
5. Investigate local inference reliability/performance: observed renders took
   about 249–305 seconds, ~7.9 GB memory on an 8 GiB M3, with one transient failure.
   No concurrency/load guarantee or local image safety classifier exists.
6. Production hardening includes restricted app DB credentials, managed signing,
   durable assets, account recovery, representative evals, mobile/accessibility/
   load/security checks and independent contract review. WCAG 2.2 AA is a target,
   not a completed certification. n8n remains optional future work.

## Secrets and working conventions

Never print root `.env`, database URLs/passwords, provider keys, session cookies,
raw private prompts or recovery export contents. Use `.env.example` as a template.
Keep real `.env`, `data/`, downloaded models and the third-party clone ignored.
Treat dotenv as data; do not source it as executable shell code. Local signing
credentials are development-only; do not claim KMS custody is already deployed.

Keep server-authoritative attempts/status, idempotency requirements, versioned
rubrics/provenance, explicit generation/retry consent and immutable commitments.
Preserve existing uncommitted work; do not reset the repository or silently
rewrite product behavior while addressing a narrow task.

## Marketplace price history — 4 November QA implementation

`PriceHistory.tsx` reads public `/market/history`, backed by the local chain
bridge's confirmed `CandySold` events for the current deployment. Minting,
asking prices and cancellations do not establish a sale price. The collection
view uses individual dots (different assets); selecting a candy connects its
actual resales. Includes 7/30-day/all-time filters, exact wei/transaction details,
trade count, volume, accessible table and a truthful empty state. Prices use
BigInt arithmetic. Latest 1,000 sales are displayed with a truncation notice.
Backend changes require a user-managed launcher restart. Do not seed fake sales
into the live marketplace to make the chart look populated.

Chrome QA confirms local NFT mode currently uses unlocked Anvil RPC accounts,
not the MetaMask extension. Do not claim MetaMask integration has passed. See
`docs/qa-report-2026-11-04.md` for dated evidence and remaining coverage.
