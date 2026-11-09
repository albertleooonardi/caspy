# Caspy's Prompt Heist — Project Steering

Checkpoint: **8 November 2026** (later dated sections below supersede earlier
ones where they differ). This file is the continuation guide for Kiro.
Read the implementation before changing behavior; distinguish completed work,
observed QA, and future production requirements. Full requirements:
#[[file:PRD.md]], especially sections 20–22. Older architecture proposals in the
PRD/README are not proof that a service is implemented or deployed.

Cloud deployment preparation is now in progress: read
#[[file:docs/cloud-deployment.md]] before hosting work. The user requires full NFT
gameplay, approved Base Sepolia preparation and selected Render free in My
Workspace after Railway rejected project creation (expired trial). Vercel project
`caspy-prompt-heist` is created. `/deploy-testnet` prepares two operator-approved
contract transactions; it does not activate the backend. CI/release workflows,
HTTPS origin/cookies, a same-origin API proxy, optional private PostgreSQL game
snapshots/blobs, and the official free Schnell Space adapter are prepared. One
anonymous real Space image succeeded, but quotas/queues remain. Do not claim full
cloud gameplay is live until contracts, hosting secrets and end-to-end verification
are complete. Preserve the new ignored voucher signer in `data/credentials/`;
never print it or use Anvil keys on a public chain. Existing local storage remains
the default for ./run.sh. Later sections describe that local checkpoint.

**7 November cloud update:** initial approved source `3911622` is pushed on
`codex/cloud-preview-20261106`; draft PR #1; all four GitHub CI jobs passed.
Vercel frontend build READY at `https://caspy-prompt-heist.vercel.app`, operator
setup `/deploy-testnet`; full game not activated. Railway trial expired and
Render requires card details even for free creation; user cannot add a card and
selected a quota-limited GitHub Codespaces demo backend instead. Corrected CLI
login is repository owner `albertleooonardi` (old `leokimiaa` login preserved).
Private server environment is staged in ignored credentials files, not source.
Only API port 8000 may be forwarded after readiness; never expose Bifrost/Anvil.
Contracts, backend configuration and deployed full-flow QA remain pending.
Production CI environment has owner approval/main-only protection; release flag
is false until verified. See cloud-deployment.md for authoritative live progress.

**7 November deployed testnet update:** confirmed Base Sepolia configuration is
in ignored `data/nft-sepolia.json`: candy
`0x29545806dda87005d8e7b8b203f08a7dd45956bb`, marketplace
`0xb829ac0181ed55beb70e024e137ff4ebb64bd9e0`. V2, expected signer role,
market linkage and supply 1,000 were verified on-chain. Frontend `d84137c` is
READY with NFT mode, server-only backend origin and an explicit nested API proxy.
Public health/candy config/marketplace returned 200; actor streaming and strict
JSON judge smoke passed. The backend runs the same source release.
Cloud bundle `data/credentials/codespaces-preview.env` uses the working IPv4
Supabase Session pooler and separate Bifrost roles. Only API port 8000 is public;
Codespaces idle/quota still applies. Restart cleanup now signals service process
groups; event reads respect the public RPC's 200-block limit. Browser automation
was unavailable, and real cloud wallet play → image → mint → trade → payout still
needs user verification. Automatic CD is disabled pending scoped CI credentials
and full QA. Read `docs/qa-cloud-2026-11-07.md` and cloud-deployment.md before
continuing. These current results supersede the earlier pending-contract notes.

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
- Maximum collection supply is 1,000. At most one candy entitlement per wallet
  per deployment/season and one mint per wallet are enforced independently of
  how many heists a contributor plays.
- Contributor accounts have unlimited heist replay after any terminal result,
  preserving three prompts per heist. `Games.create(unlimited=...)` receives its
  permission from the server-authenticated role, never a request-body flag.
  Active/in-flight/pending-review sessions cannot be abandoned. Old heists can
  be reopened via Account's View heist links; result/claim routes accept a session
  query parameter but still enforce existing account and wallet ownership checks.
  NFT entitlement and one-mint-per-wallet restrictions remain unchanged.
- For other roles, NFT gameplay daily retry: lost/void heists can be followed by a new three-prompt
  heist after the next 00:00 WIB (Jakarta), based on the old heist's creation day.
  Server authority lives in `Games.create`; persistent history survives restart.
  Active/pending-review/winning games are preserved, so rewards remain claimable.
  Contract `mintedWallet` still permits only one mint per deployment. Client shows
  the next unlock and a daily-heist action; this does not delete previous data.
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

Verified migration-time snapshot: **98 live tables / 19,980 rows** (historical
counts, not current row totals). Five legacy databases,
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
and email verification are not implemented. Researcher accounts/workspaces are
self-service and are not verified organizations. Email confirmation, researcher
applications, admin approval, MFA and verified badges are proposed only; do not
claim they exist or make a verified badge a cosmetic substitute for authorization.

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

Current focused checks on 6 November: **14 game API tests + 15 platform tests +
11 frontend tests = 40 passed**, type check passed and production build generated
17 routes. These include contributor replay, protected unfinished games, Jakarta
reset boundaries, role-derived replay permission, persistence and access checks.
David and Elroy passed live local API login/session/logout; Leonardi's existing
password was preserved. The latest Python replay changes still require a
user-managed launcher restart; do not equate passing tests with process activation.

Next priorities:

1. After the user restarts `./run.sh`, verify contributor Play another heist after
   loss/win, historical chats and old reward access in Chrome. Confirm other-role
   daily locking and pending-review protection without changing the system clock.
2. Finish desktop/mobile visual QA of the new dashboard, compact login/register,
   deck collection and marketplace board. Native browser captures have intermittently
   returned blank/no-window results; record that limitation rather than claiming
   all screens have been verified. Recent JSX/CSS changes do not update video assets.
3. Resolve seller payout: verify the actual withdrawal receipt and zero credited
   proceeds. The previous 0.01 test-ETH credit persisted after user reports.
4. Calibrate judge category/flag consistency. A benign declined story was labeled
   `exploit_attempt` with `exploit_flag: false`; preserve reward gates.
5. Investigate local render reliability/performance: ~249–305 seconds, ~7.9 GB on
   an 8 GiB M3, one transient failure; no load guarantee or image safety classifier.
6. Production hardening: verified identities/account recovery, least-privilege DB
   role, managed signing, durable assets/backups, representative evals, security/
   accessibility/mobile/load checks and independent contract review. The launcher
   is local development tooling, not a production deployment. n8n is future work.

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

## Historical price-history implementation — superseded presentation

The retained `PriceHistory.tsx` can read public `/market/history`, backed by the local chain
bridge's confirmed `CandySold` events for the current deployment. Minting,
asking prices and cancellations do not establish a sale price. Its historical all-candies
view used individual dots (different assets); selecting a candy connects its
actual resales. Includes 7/30-day/all-time filters, exact wei/transaction details,
trade count, volume, accessible table and a truthful empty state. Prices use
BigInt arithmetic. Latest 1,000 sales are displayed with a truncation notice.
Backend changes require a user-managed launcher restart. Do not seed fake sales
into the live marketplace to make the chart look populated.

Chrome QA confirms local NFT mode currently uses unlocked Anvil RPC accounts,
not the MetaMask extension. Do not claim MetaMask integration has passed. See
`docs/qa-report-2026-11-05.md` for dated evidence and remaining coverage.

## Chrome QA continuation — 5 November

See `docs/qa-report-2026-11-05.md` for evidence and limits. Dedicated fictional
researcher account completed live Bifrost play (eligible YIELD, confidence 0.96;
S/92), rating, human review, zero-price development dataset publication, catalog
and owner JSON export. Export omits direct account/wallet/session identity fields.
Walkthrough playback, pause, chapter seek and win-only quiz passed in Chrome.

Real Schnell attempt one failed; explicit same-seed retry succeeded. Token #1
minted, listed with user-approved prompt license, and was purchased by the separate
player account. User executed purchase after automatic review required handoff.
At that QA checkpoint, the graph showed the actual 0.01 test-ETH sale; filtered multi-sale graph
controls also passed with an isolated fictional fixture. Buyer prompt access
unlocked; seller access was denied after transfer. Seller is credited 0.01 test
ETH; final payout remains unverified: readback still shows the full credit
after user-reported confirmations. Do not claim payout success without a
matching transaction and zero credited balance.

Approved fictional research withdrawal blocked future owner exports and removed
the empty release from the catalog, preserving the NFT and sale. Cross-workspace
researcher grant flows remain fixture-tested rather than Chrome-verified.
MetaMask is bypassed by the current local wallet implementation; do not claim
extension signing passed. Intermittent blank Chrome route rendering and local
render reliability remain open findings. The temporary graph fixture server on
18889 was stopped; user app servers remain user-managed. Never insert fictional
fixture sales into live history.

## UI/UX refresh — 6 November

Signed-in accounts now have `/dashboard` (`UserDashboard.tsx`), also shown at `/`
after account loading. Guests keep the public homepage. Login/registration default
to the dashboard; explicit allowed `next` routes are preserved. Dashboard uses
existing authenticated activity and collection endpoints, never creates a heist
on load, and keeps account settings at `/account`. Current-heist restoration uses
the saved session ID and the existing owner checks. It shows activity summaries; full historical chats are opened from
Account → View heist. Session query parameters do not bypass backend ownership. Collection and current heist require the wallet in NFT mode. New
devices without a saved session ID must open Play to restore their heist.

Account-entry layout keeps the original enlarged Caspy PNG, not an animated
replacement/GIF. Login uses compact spacing and omits announcement/footer to fit
a typical desktop viewport. Registration pairs name/email and password fields;
the left illustration stays visible while scrolling on desktop. Small viewports
keep normal scrolling and stack controls rather than clipping required inputs.

Three requested development contributors: `leonardi@caspy.local` (existing;
password preserved), `david@caspy.local` and `elroy@caspy.local` (created). Temporary
credentials for new accounts are in ignored `data/credentials/` files with 0600
permissions and 0700 directory permissions. Do not print or commit them, reset
existing passwords unasked, imply terms acceptance, or enable research consent
for these accounts. Account role is not email or organization verification.
Contributors who create a research workspace become researchers and follow that
role's replay rules; choosing research consent does not change their role.

Marketplace presentation now uses horizontal achievement-style listing rows:
candy thumbnail/name, grade/score, seller wallet, asking price and buy/cancel
action. Prompt license stays expandable. The user requested removing the graph
from marketplace; its component is no longer rendered there. History API and
source component remain available for future use. Collection retains compact
deck cards. Do not restore the marketplace graph without a new product request.

See `docs/ui-ux-refresh-2026-11-06.md` for the shared design system, implemented
interaction improvements, browser coverage and limits. `experience.css` loads
after legacy styles; keep overrides organized there. Fonts are served locally
with their OFL licenses. Shared reward progress lives in `RewardJourney.tsx`.

Chrome checks covered mobile sign-in, wallet loading/connection, optional research
disclosure and collection search/reset, plus desktop collection presentation.
Frontend tests (11), type check and production build passed. These presentation
changes do not resolve or re-verify the earlier payout discrepancy or MetaMask
extension integration. Development servers remain user-managed.

## Latest image connection checkpoint — 7 November 2026

Backend release `7bd583c` and frontend `eb2ef92` are live. Read
`docs/image-generation-analysis-2026-11-07.md` before changing reward flow.
Existing ready artwork was hidden behind a slow mint check; the UI now shows the
saved image immediately, serializes polls and reports chain trouble separately.
`nft-bridge.mjs` uses `usedSessions`, immutable token commitments or the receipt
block for mint status. SSE image responses stop at completion and expose live
queue/provider/download/save phases; no automatic provider retry or paid fallback.
Only public content-addressed PNG/JSON responses are cached; their cookies are
stripped both ways and HTML/error responses are never cached. Accounts stay
no-store. Original reward hashes/grade/one generation attempt were preserved.
Real fictional generation took 3.77s; saved-artwork repeat CDN HIT took 0.187s.
All relevant tests and CI passed. Browser/wallet transaction QA remains manual;
free GPU quotas and Codespaces sleep have not been eliminated.

## Latest text-provider update — 7 November

Release `938ad4e` is deployed on Vercel/Codespaces. OpenRouter's daily free-model
quota was exhausted, so the user selected Google AI Studio and supplied a key.
The key is only in ignored server env files; never print it. Gemini actor
`gemini-3.1-flash-lite` and independent judge `gemini-3.6-flash` passed streaming,
full candy-schema validation and a fictional in-memory turn in 3.83s. Distinct
2.5 fallbacks are configured, model allowlists/budgets/auth preserved, no billing
setting changed. `bifrost_setup.py use-gemini` performs a backed-up switch and
requires `CASPY_GEMINI_FREE_TIER_CONFIRMED=true` for the operator's free-project
choice. Metadata/preflight tests cannot independently verify the project's billing
status. Gemini still has quotas; Codespaces still sleeps. Hosted images remain
Schnell, and saved grades/images were not changed. See cloud-deployment.md for
full live status, privacy note, key rotation and setup commands.

## Wallet persistence checkpoint — 8 November 2026

Backend release `a8cba1d` persists verified wallet sessions in private Supabase
`wallet_sessions` (token digests only, six-hour absolute expiry, scoped to chain/
contract/deployment). Startup calls `persist_sessions(platform.database)`.
Restart recovery, expiry, logout, token rotation, isolation and private-table
permissions passed isolated and live disposable-schema tests. Account logout
intentionally revokes the wallet session; email login alone never proves wallet
ownership. Earlier memory-only proofs cannot be recovered; sign once after this
release. See `docs/wallet-session-persistence-2026-11-08.md`. Codespaces remains
a demo with sleep/quota/lifetime limits; no 24/7 claim or keepalive bypass.

## Multiple-reward implementation — 8 November 2026

The user now requests multiple candies per wallet. New v3 seasons allow this,
one entitlement/mint per winning heist, finite 1,000 supply, no loss reward and
no rerolls. This supersedes the prior one-per-wallet product requirement.
Current public v2 contracts remain limited until the user signs new v3 candy
and marketplace deployments at /deploy-testnet and provides their public JSON.
The bridge supports both versions with matching EIP-712 domains; the DB migration
drops only candy_jobs_namespace_wallet_key and retains saved data. Legacy v2
uses an explicit server wallet gate. Do not wipe old contracts, rewards, signer
or account data when activating the new season. Old NFTs persist on their old
contract; the current collection UI is deployment-scoped. PRD amendment records
this activation boundary.

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

## Confirmed mint warning repair — 8 November 2026

Read-only live checks confirmed the reported v3 candy as token #1: saved game
and candy job both minted, on-chain owner matches the player's wallet on 84532.
The /mint/submit tracking request had failed but subsequent status recovery
confirmed the token; an earlier UI error string remained visible. Frontend
2009c30 clears busy/error/sync-warning on authoritative mint confirmation,
including already-persisted minted snapshots, and suppresses stale mint warnings
on a confirmed reward. Tracking failure does not resubmit a transaction. Two
regression cases plus all 29 frontend tests, type checks and build passed.
No replacement mint, image regeneration or grade change was performed.

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

Live verification: f1cd4fe is deployed on both services; /heists returns 200
and unsigned history requests return 401. Frontend bundle contains the new
history/automatic-reconnect UI and no gateway brand name. All four CI jobs
passed. Read-only checks of the reported account found five records: four
saved transcripts available (two current, two older seasons); one legacy
record has no snapshot and correctly returns an unavailable-history message.
No conversation text or token was printed, and no new heist/image/mint was
created by verification.

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

Live e54608a verification: obsolete migrated index absent, heist PK present;
all four CI jobs passed and public API healthy. The reported account's saved,
clean winning heist was recovered through ensure_win using its persisted judge
verdict, account/wallet link and existing v3 namespace. New reward is earned
with zero image requests. A before/after comparison verified all prior reward
rows unchanged. No conversation rerun, image generation or mint transaction.

## Profile/loading checkpoint — 8 November 2026

Profile page uses ProfilePanel/UserAvatar and private profiles table (RLS).
/account/avatar accepts token_id or null, checks account/wallet link, on-chain
ownership and committed image; it does not transact. Account metadata includes
avatar URL/chain/contract/token; pictures are cosmetic, not ownership proof.
Common LoadingState supplies labelled waits, slow-response hints, skeletons and
reduced-motion support across account/dashboard/history/research/catalog/reward/
collection, with video buffering and source-prompt progress. ApiError preserves
HTTP status; temporary connection failures no longer masquerade as sign-out.
Background dashboard data stays visible. Read docs/loading-profile-review-2026-11-08.md
for test results, selection-time ownership semantics and missing browser QA.

## Loading/profile implementation — 8 November 2026

Release 342e66e implements the profile/loading amendment. Backend was restarted
only after confirming zero in-flight turns and zero running image jobs. New
profiles table persists verified, account-owned NFT picture selection; no real
user avatar was selected by QA. Shared loading, background-preservation and
offline-versus-expired handling were reviewed across the app. See
docs/loading-profile-review-2026-11-08.md for tested scenarios and explicit
browser unavailability. Do not claim visual browser sign-off.

## Social friends — 8 November 2026

Players add friends with a private friend code (`XXXX-XXXX`, unambiguous alphabet,
stable per account, regenerable). There is deliberately **no name/email search**,
so accounts cannot be enumerated; keep it that way. Code is
`scripts/social_store.py` (routes `/social...`, dispatched by `Platform.handle`,
which gained the `/social` prefix), frontend `Social.tsx`, `lib/social.ts`,
`styles/social.css`, nav link for signed-in users, `social` in `[page].astro` and
`protectedPage`. Tables `friend_codes` and `friendships` are created at startup;
on PostgreSQL they have RLS enabled and access revoked from PUBLIC/anon/authenticated.
Responses expose only an opaque friendship ID, name, picture URL and a timestamp,
never email, user ID, wallet or role. Limits: 200 friends, 50 pending outgoing,
10 unknown-code lookups per 10 minutes (reuses `login_attempts`; the failed lookup
is committed before the 404 is raised, so do not move the raise back inside that
transaction). Declined requests hide from both sides and cannot be resent by the
sender; the decliner may still invite them. A friendship grants nothing: no access
to heists, wallets, collections or research data, and no effect on attempts,
grades or rewards. Not built: blocking/reporting, notifications, messaging.

Tests: `scripts/test_social.py` (7), a live disposable-schema class
`SupabaseSocialTests` in `test_supabase.py` (8, includes table privilege checks)
and `frontend/src/lib/social.test.ts` (4). All passed on 8 November with the type
check, build and four CI jobs. No browser walkthrough was available. Merged to
`main`; **not deployed** to the live preview when written (live was `342e66e`).
Deploying it needs a Codespace update plus a Vercel redeploy; see below.

## Main merge, protection and release state — 8 November 2026

PR #1 was merged into `main` as `d298c48` (merge commit, CI green). Further changes
to `main` need a pull request. Protection on `main`: PR required with zero approvals,
the four CI checks required (Frontend checks, API and authentication checks,
Contracts and NFT integration, Cloud container build), force-push and deletion
blocked, administrators may bypass. `codex/cloud-preview-20261106` blocks
force-push and deletion only. The merge ran the release workflow's checks but did
not deploy: `CASPY_CLOUD_RELEASE_ENABLED` is still `false`. The `production`
environment had no `VERCEL_TOKEN`; `CODESPACES_TOKEN` was not confirmed. Do not
enable release until the full deployed wallet-to-payout run passes; the seller
payout discrepancy is still unresolved. Do not create or print deployment tokens;
ask the owner to add them.

## Preview outage and recovery — 8 November 2026

The Vercel proxy returned 502 because the Codespace was running but no process
listened on port 8000, and the port had reverted to private. Recovery that worked:
in the Codespace terminal run, as **one line**,
`.venv/bin/python scripts/codespace_release.py "$(git rev-parse HEAD)"` (two pasted
lines had merged into one command earlier and nothing ran), wait for the exact-release
ready message, then if the address returns 401 run
`gh codespace ports visibility 8000:public --codespace caspy-nft-demo-jjw5666x9jjvfqxg6`.
Verify `/api/health` through the Vercel URL. The helper restarts the same checked-out
commit, so it does not deploy new code. The Codespace had local changes (`*` after
the commit); do not `git pull`, reset or discard them without the owner's approval,
since they may be private environment files. A restart or port change must wait
for zero in-flight turns and image jobs. Demo hosting still sleeps after 30 minutes
idle and is not 24/7; never claim otherwise or add a keepalive.

## README, tooling and agent notes — 8 November 2026

- README was rewritten to match this guide and the PRD (banner, labelled screenshots,
  video poster linking the repository mp4, Mermaid architecture, accurate stack and
  limits). Assets in `docs/assets/readme/` are generated by
  `scripts/build_readme_assets.py` from tracked artwork; the screenshots use
  fictional tutorial data, so keep their label and never present them as a real win.
- `scripts/shell/deploy-status.sh` is a read-only status report (git vs origin, CI
  runs, release switch, whether deploy secrets exist, live backend/frontend commit).
  `.kiro/hooks/python-syntax-on-save.json` compiles saved `scripts/*.py` files.
- Vercel and read-only Supabase MCP entries were proposed for the user-level
  `~/.kiro/settings/mcp.json`, but writing that file is blocked by a permission
  rule; give the owner the snippet rather than working around the block. Supabase
  MCP must stay read-only and project-scoped, and the app's admin database URL must
  never be given to an MCP server.
- Shell quirks: zsh treats `[...]` in unquoted `gh api` fields as globs (quote them);
  `gh codespace ssh` hung in this environment, so use short separate commands with
  explicit timeouts and ask the owner to run Codespace commands in its terminal.
- An unpushed local commit `c30bd42 "update 08/11/2026"` holds the hook, the status
  script, docs and this steering file, plus two stray root files named `200` and
  `300` that look accidental. Remove those two before pushing, and use a pull request
  because `main` is protected.

## Pending follow-ups — 8 November 2026

1. Deploy Social: update the Codespace (resolve its local changes with the owner),
   restart with the release helper, make port 8000 public, redeploy the Vercel
   frontend, then verify health, `/social` and a fictional two-account flow.
2. Open a pull request for the unpushed local commit after removing `200`/`300`.
3. Add `VERCEL_TOKEN` and `CODESPACES_TOKEN` only when the owner is ready, finish the
   full deployed QA, verify seller payout, then consider enabling release.
4. Browser/mobile QA of Social, the new README rendering on GitHub, loading states
   and profile pictures; MetaMask extension flow is still untested.
5. Move the backend to an always-on host once a payment method is available.
