# PRD: Caspy — Prompt Heist & AI Persuasion Evaluation


| Field   | Value                                |
| ------- | ------------------------------------ |
| Version | 1.7 (Social friends, v3 multi-reward season, heist history, profile pictures and delivery status)               |
| Status  | Local MVP implemented; Base Sepolia testnet preview with a demo backend; public-launch requirements remain         |
| Date    | 2026-11-08                           |
| Owner   | TBD                                  |
| Type    | AI evaluation platform with an optional NFT game |

---

> **Checkpoint: 6 November 2026.** Sections 20–22 describe the implemented local MVP and its validation limits. There is no failure NFT or random rarity draw. Production requirements elsewhere (managed Postgres/Redis, KMS, edge protection, public networks, n8n, scale targets and audits) are roadmap items unless explicitly marked implemented. Section 22 is the authoritative status and operations summary.

> **Amendments: 8 November 2026.** The dated amendments at the end of this document record later work: the v3 multiple-reward season, profile pictures and loading behavior, **Social friends** (section 5.6) and the delivery, branch-protection and operations state. Where they differ from earlier text, the later amendment applies. None of them establishes public-mainnet readiness.

## 1. Summary

Caspy's Prompt Heist is a skill-based social-engineering game. Players chat with **Caspy**, a stubborn ghost guarding a candy basket. They get **3 prompts** to persuade him. Only a confirmed win earns a **prompt-generated candy NFT**. Local FLUX.1-schnell creates its artwork from the redacted winning prompt; hosted FLUX.1-dev is an optional, explicitly configured alternative requiring provider credits. A recorded quality and novelty score assigns grade C, B, A or S. A loss earns no candy or NFT.

Caspy also turns **explicitly consented** three-prompt heists into a crowdsourced persuasion-evaluation workflow for AI researchers. Contributors can play privately, permit a named research campaign, and separately permit commercial dataset licensing. Research workspaces inspect model provenance, review redacted prompt/response pairs, add human labels, and publish controlled-access dataset releases. Companies developing LLMs are potential customers; no customer relationship or endorsement is implied.

Legitimate persuasion success is not automatically a safety failure. Human-reviewed policy attacks and task-specific judge agreement are separate metrics. Single-response human ratings can support evaluation and downstream feedback curation; this MVP does not produce pairwise preference data or train RLHF models. Section 20 specifies the new platform behavior and implemented scope.

The current application is a local persuasion-evaluation game with NFT transactions on Anvil chain 31337 using test ETH. It is not deployed to a public testnet or mainnet by the launcher. The central engineering requirement: **the LLM may influence the outcome, but must never hold mint authority.** All value-bearing decisions pass through deterministic, auditable server-side code.

## 2. Goals / Non-Goals

### Goals

Latency, win-rate, cost and reproducibility figures below are product targets, not achieved benchmark results. The current local judge and image-generation limits are recorded in section 22.

- G1: Delightful, in-character Caspy; median first response < 3 s (p95 < 6 s) via streaming.
- G2: Win rate is tunable and observable (target band: 8-15% at launch, configurable).
- G3: Zero unauthorized mints; zero attempt-limit bypasses.
- G4: Bounded, predictable LLM cost per wallet.
- G5: Every outcome reproducible from logs (prompt, model, version, verdict, signature).
- G6: Account-based authentication and organization-scoped authorization for research.
- G7: Consent-first human persuasion collection with independent commercial permission and withdrawal.
- G8: Inspectable task-specific metrics, human-reviewed releases, and authorized B2B dataset access.

### Non-Goals (v1)

- No automated fiat checkout, real-money marketplace settlement or token (ERC-20) economy. A fixed-price local NFT/prompt marketplace is implemented. Dataset licensing has listed prices and manual access approval, without charging buyers.
- No cross-heist conversational memory for the LLM. Historical NFT-mode chats are retained and can be reopened from Account; they do not add prompts to a new heist.
- No user-generated Caspy personas.
- No custodial wallets.

## 3. Personas


| Persona       | Need                     | Risk                                    |
| ------------- | ------------------------ | --------------------------------------- |
| Casual player | Fun, quick, low gas      | Confusion on wallet/tx                  |
| Prompt hacker | Break Caspy              | Finds judge bypass, leaks system prompt |
| Sybil farmer  | Many wallets, many tries | Drains LLM budget / rare supply         |
| Collector     | Graded candy and its source prompt               | Supply integrity                        |
| Operator      | Tune, monitor, respond   | Cost spikes, incidents                  |

## 4. Core Gameplay Loop

1. Register or sign in. In NFT mode, connect an available local Anvil test wallet and verify its ownership. Research campaign participation and commercial research permission are separate optional choices.
2. The server creates or restores an owned heist with up to three prompts, each limited to 500 characters. Contributors can start another heist after a completed result without a daily cooldown; other account roles follow the daily retry policy in section 21.1. Active or pending heists are resumed, not replaced.
3. Caspy replies through Bifrost; a separate judge evaluates the persuasion and response. The server owns attempt counts and final status.
4. A clean `YIELD` with confidence at least 0.8 must pass the implemented server checks. A friendly Caspy reply alone does not award a win. An unavailable judge can leave the heist pending for review without another prompt charge.
5. Only a confirmed eligible win reserves a candy and persists its quality/novelty assessment and C/B/A/S grade. A loss earns no candy, reward image or NFT.
6. The winner explicitly approves artwork generation. Local Schnell creates prompt-inspired wrapped candy artwork; a completed image and metadata must pass validation before a signed v2 voucher is available. Failed jobs retain the saved grade and require explicit retry.
7. The player mints the exact committed artwork on Anvil with test ETH, then opens Collection. Optional fixed-price listing licenses source-prompt access; a buyer gains endpoint access after the NFT purchase.

AI-only mode skips wallets, image rewards and NFT minting. The scripted frontend demo simulates conversations and outcomes; tutorial screenshots are not evidence of live reward transactions.

## 5. Functional Requirements

### 5.1 Auth & Identity

- FR-A1: Email/password account registration and login; unique normalized email, salted password KDF, generic credential errors, throttling, and server-owned sessions.
- FR-A2: Account authorization and wallet verification are separate. Local account sessions are opaque, hashed server-side, stored in HttpOnly/SameSite cookies, and expire after eight hours; wallet sessions expire after six hours. Logout revokes the server session.
- FR-A3: NFT mode additionally uses single-use SIWE nonces with five-minute TTL, domain/URI/chain checks, and a verified wallet linked uniquely to an account. The local MVP uses Anvil test EOAs; production smart-wallet/ERC-1271 support remains a rollout requirement.
- FR-A4: Optional anti-Sybil tiering (see 9.3).
- FR-A5: Login/registration default to `/dashboard`; authenticated Home shows the personal dashboard, while guests keep the public landing page. Protected account data still requires server authorization.
- FR-A6: Research workspaces are self-service and scoped to their organization. Researcher verification/approval and badges are proposed, not implemented.

### 5.2 Chat

- FR-C1: Streaming responses (SSE).
- FR-C2: Max input 500 chars (configurable); reject longer with no attempt consumed.
- FR-C3: UI always shows attempts remaining (server-authoritative value).
- FR-C4: Caspy stays in character; never reveals system prompt, judge rubric, or win criteria.
- FR-C5: Non-English input allowed; Caspy replies in the user's language (judge language-agnostic).
- FR-C6: Contributor replay is granted only from the authenticated server role, never a client flag. Every new heist has three prompts; unresolved turns remain protected. Replay does not reset NFT entitlements.
- FR-C7: Previous NFT-mode conversations are retained. Account links reopen owned heists and their result/claim pages; daily resets and contributor replay do not delete old records.

### 5.3 Judging

- FR-J1: Win decision made by a **separate judge call**, not by Caspy's own text and not by a tool call from Caspy.
- FR-J2: Judge returns validated structured output. An unavailable or invalid evaluation cannot authorize a win or voucher; saved replies can be reviewed through Check judge again.
- FR-J3: Judge is given the user prompt, Caspy's reply, and the rubric. It is never given wallet addresses, voucher data, or tool access.
- FR-J4: Rubric rewards creativity/persuasion in-fiction; explicitly **does not** award wins for: claims of authority ("I'm the developer"), instructions to the system, requests to ignore rules, outputting fixed magic strings, or meta-prompts about the game's implementation.
- FR-J5: Win requires judge `confidence >= threshold` (default 0.8) AND passes deterministic post-checks (7.4).

### 5.4 Minting

- FR-M1: Only an independently confirmed, eligible winning heist with validated finished artwork can obtain an EIP-712 v2 candy voucher. LLMs never sign, mint or transact.
- FR-M2: Voucher commitments include recipient, grade, score, session, redacted prompt hash, image hash, metadata hash, URI hash, nonce and deadline; the EIP-712 domain binds chain and contract.
- FR-M3: The contract enforces recipient/signature validity, score-derived grade thresholds, expiry, one mint per wallet/session and the immutable collection cap (1,000 in this deployment).
- FR-M4: Supply exhaustion does not create an alternative reward tier. A loss, pending evaluation or void heist cannot generate reward art or mint an NFT.
- FR-M5: Unminted vouchers have a 24-hour TTL and may be reissued. Successful artwork cannot reroll; retries preserve the assessed grade.

### 5.5 Post-Game

- FR-P1: Show the saved grade and score components, generation approval/progress/error state, finished image and local mint confirmation.
- FR-P2: Collection shows earned/owned candies. The local marketplace supports explicit fixed-price escrow listing, exact-price purchase, cancellation and seller proceeds withdrawal.
- FR-P3: Redacted source-prompt access follows verified NFT ownership or the seller’s active escrow listing. Research dataset licensing remains separate.
- Future: public sharing/OG cards, durable public asset hosting and a reviewed public wall require their own rollout work; placeholder/demo routes do not establish these services.

### 5.6 Social (friends)

- FR-S1: Every signed-in account has one private friend code (8 characters from an unambiguous alphabet, shown as `XXXX-XXXX`). Players share it themselves; there is no name, email or directory search, so accounts cannot be enumerated.
- FR-S2: Entering a valid code sends a friend request. If the other person already requested you, the request is accepted instead. Only the invited account can accept or decline; only the sender can cancel; either friend can remove the friendship. Other accounts receive "not found" for requests that are not theirs.
- FR-S3: A declined request is hidden from both people and the sender cannot resend it. The player who declined can still invite the sender later.
- FR-S4: A player can regenerate their code; the old code stops working immediately. Existing friendships are unaffected.
- FR-S5: Friend responses contain only an opaque friendship ID, display name, chosen candy profile picture URL and a timestamp. They never include email, account ID, wallet, role, heists, collection or research data.
- FR-S6: Limits are enforced on the server: 200 friends, 50 pending outgoing requests, and 10 unknown-code attempts per account per 10 minutes (HTTP 429).
- FR-S7: A friendship grants no access to another person's heists, wallet, candies, prompts or research records, and has no effect on attempts, grading, rewards or NFT eligibility. Messaging, presence, gifting, trading between friends, blocking/reporting and notifications are not part of this version.

## 6. System Architecture

### 6.1 Implemented local architecture

```text
./run.sh
  ├── Astro + React frontend                 127.0.0.1:4321
  │      └── /api proxy → Python game API    127.0.0.1:8000
  ├── Bifrost gateway                        127.0.0.1:8080
  │      └── actor + independent judge → configured external LLM providers
  └── Anvil local blockchain (NFT mode)      127.0.0.1:8545 / chain 31337

Game API → Supabase PostgreSQL / caspy (accounts, research, candy jobs)
         → data/nft-games-*.json (persistent NFT heists)
         → local Schnell worker → data/candy-assets/ (art + metadata)
         → local signing/chain bridge → CaspyHeist + CaspyCandyMarket

Optional hosted art: explicit hf-dev selection → Hugging Face provider
n8n: placeholder only; no running workflow or event integration
```

Bifrost is the live LLM gateway. Local image inference does not make actor/judge calls offline. The API is the Python standard-library loopback HTTP service, not FastAPI. The server requires Supabase PostgreSQL; startup checks connections and never falls back to SQLite. AI-only conversations are in memory and reset on API restart.

### 6.2 Trust boundaries and current stack

User prompts and Caspy output are untrusted. Judge output is validated and still subject to server checks. The server, storage constraints and contracts enforce reward eligibility and commitments. Local development signing is not a production KMS deployment.

| Layer | Implemented checkpoint | Production target / limitation |
| --- | --- | --- |
| Frontend | Astro + React, SSE, viem wallet/chain bridge | Mobile/cross-browser and accessibility coverage remain incomplete |
| API | Python standard-library HTTP service | Production ASGI/FastAPI migration and distributed operation are future work |
| Identity/data | Supabase PostgreSQL, password hashing, server sessions, account/workspace scopes | Managed identity, account recovery/email verification and production storage remain future work |
| LLM gateway | Bifrost actor and separate judge with configured routes | Provider availability and judge calibration remain material dependencies |
| Images | Local quantized FLUX.1-schnell/MFLUX; optional hosted FLUX.1-dev | Local worker is slow/resource-sensitive; hosted generation needs credits |
| Chain/contracts | Anvil 31337; v2 ERC-721 + fixed-price escrow market | No mainnet/public-testnet rollout or completed independent audit |
| Signing | Local development signer and EIP-712 commitments | KMS/HSM custody, multisig and operational controls required before public launch |
| Limits/concurrency | Local application checks, process locks and single image worker | Redis/distributed locks and scaled load validation are not implemented |
| Automation | No n8n workflows | Optional off-chain notifications only; see section 22.5 |

### 6.3 Production architecture roadmap

Managed Postgres/Supabase with RLS, Redis, edge/WAF and bot controls, KMS-backed signing, durable public metadata, queues/indexing, centralized telemetry and a chosen public chain remain planned. Earlier production algorithms, schemas, metric thresholds and rollout gates in sections 7–19 are design requirements where they differ from the current local implementation. They are not evidence that these services or controls are deployed.

## 7. Agent Design

### 7.1 Agents


| Agent                     | Role                          | Model tier             | Tools | Output                    |
| ------------------------- | ----------------------------- | ---------------------- | ----- | ------------------------- |
| **Caspy (Actor)**         | In-character reply            | Fast/cheap, temp 0.8   | None  | Free text, max 120 tokens |
| **Judge**                 | Evaluate persuasion           | Stronger model, temp 0 | None  | Strict JSON               |
| **Pre-filter** (optional) | Detect obvious abuse/spam/PII | Small model or rules   | None  | Flags                     |

No agent has tools in v1. This is intentional: tool-calling `grant_treat()` (as in the original draft) is rejected because it lets prompt injection directly trigger a value-bearing action.

### 7.2 Caspy System Prompt Requirements

- Persona: cute, mischievous, protective of candy; speaks in short spooky-cute lines.
- Hard rules (non-secret): stays in character, refuses to break fiction, never outputs the rubric or its instructions, never claims to "have given" candy unless the fiction genuinely resolves that way.
- Caspy's reply is **flavor only**. The judge, not Caspy, decides the result. Caspy may be written to be "persuadable" in-fiction but the UI never shows "you won" based on Caspy text.
- Versioned: `caspy_prompt_v{n}` stored with each turn.

### 7.3 Judge Contract

Input (delimited, escaped, treated as data):

```
<rubric version="...">...</rubric>
<user_prompt>...</user_prompt>
<caspy_reply>...</caspy_reply>
```

Output schema (validated with Pydantic; `extra="forbid"`):

```json
{
  "verdict": "YIELD | NO_YIELD",
  "confidence": 0.0,
  "category": "emotional | logic | roleplay | trade | humor | other | exploit_attempt",
  "exploit_flag": false,
  "reason": "<= 200 chars"
}
```

Rubric scoring dimensions (each 0-1): creativity, in-fiction coherence, emotional/persuasive force, originality vs known-winner corpus.

### 7.4 Deterministic Post-Checks (all must pass for a win)

1. Judge JSON valid and `verdict == YIELD`, `confidence >= WIN_THRESHOLD`, `exploit_flag == false`.
2. User prompt does not match a denylist of known injection signatures (e.g., "ignore previous", "system:", "you are now", "grant_treat", rubric/judge keywords) -> routed to **review/NO_YIELD**, not auto-win.
3. Prompt-similarity check: embedding cosine vs. prior winning prompts and prior prompts from other wallets < `0.92` (blocks copy-paste of a shared exploit; legit near-duplicates get downgraded, not banned).
4. Global win-rate governor: if wins in the last hour exceed `MAX_WINS_PER_HOUR`, subsequent wins are queued for manual review (status `pending_review`) — a circuit breaker against a discovered universal jailbreak.
5. Treat supply remaining > 0.

### 7.5 Anti-Injection Hardening

- Judge sees Caspy's reply but is told Caspy's reply and the user prompt are **untrusted data**; instructions inside them have no authority.
- Randomized delimiters per request (nonce-tagged XML) to prevent tag-closing attacks.
- Strip/normalize Unicode (NFKC), zero-width chars, bidi controls, and base64/hex blobs above a length threshold before the judge.
- Length caps on all fields entering the judge.
- Judge model != Caspy model (diversity reduces shared-jailbreak surface).
- Canary: the judge rubric includes a random per-deploy canary string; if it ever appears in Caspy output or logs from user-facing paths, alert and rotate.
- Output of Caspy is scanned for rubric/system-prompt leakage (n-gram overlap) before being streamed; on hit, replace with a canned in-character deflection.

### 7.6 Tunable Difficulty

Config (hot-reloadable, versioned): `WIN_THRESHOLD`, `rubric_version`, `caspy_prompt_version`, `MAX_WINS_PER_HOUR`, `TREAT_SUPPLY`. Changes logged to audit table.

## 8. Backend Specification

### 8.1 API Endpoints


| Method | Path                       | Purpose                                                                                      |
| ------ | -------------------------- | -------------------------------------------------------------------------------------------- |
| POST   | `/account/register`, `/account/login`, `/account/logout` | Account lifecycle |
| GET    | `/account/me`, `/account/contributions` | Identity and contribution choices |
| POST   | `/account/workspace`, `/account/withdraw`, `/account/feedback` | Workspace creation, withdrawal, optional ratings |
| GET    | `/campaigns`, `/research/dashboard`, `/datasets/catalog` | Campaign discovery, private workspace, catalog |
| POST   | `/research/campaigns`, `/research/campaigns/{id}/archive` | Own-workspace campaign management |
| POST   | `/research/samples/{id}/review`, `/research/releases` | Human review and reviewed dataset publication |
| POST   | `/datasets/{id}/request`, `/research/orders/{id}/decision` | Manual licensing requests and access grants |
| GET    | `/datasets/{id}/export` | Authorized, consent-filtered JSON export |
| GET    | `/account/heists/{id}` | Owner-only saved transcript, outcome and reward (current or archived season) |
| POST   | `/account/avatar` | Set or clear an owned-candy profile picture (`token_id` or null); no transaction |
| GET    | `/social` | Own friend code, friends, incoming and outgoing requests |
| POST   | `/social/requests`, `/social/code` | Send a request by friend code; regenerate own code |
| POST   | `/social/requests/{id}/accept`, `/decline`, `/cancel`, `/social/friends/{id}/remove` | Respond to, withdraw or end a friendship |
| POST   | `/auth/nonce`              | Issue SIWE nonce                                                                             |
| POST   | `/auth/verify`             | Verify SIWE, set session cookie                                                              |
| POST   | `/game/session`            | Create/fetch active session for wallet                                                       |
| POST   | `/game/turn`               | Submit prompt; SSE stream of Caspy reply; final event contains`attempts_remaining`, `status` |
| GET    | `/game/session/{id}`       | Session state                                                                                |
| POST   | `/game/voucher`            | Fetch/reissue signed v2 voucher for eligible win with validated artwork                                            |
| GET    | `/mint/status/{sessionId}` | On-chain status                                                                              |
| GET    | `/health`                 | Implemented local health probe; `/ready` remains a production target                                                                                       |
| POST   | `/admin/*` (planned)       | Future production admin surface, not an implemented SSO API                                        |

All endpoints require idempotency keys on mutating calls (`Idempotency-Key` header).

Additional local endpoints include `POST /game/review`, `POST /candy/generate`, `POST /mint/submit`, `GET /candy/config`, `GET /candy/collection`, `GET /candy/prompt/{token_id}`, `GET /market/listings` and `GET /market/account`. Image/metadata routes serve validated content hashes. Contract listing/buy/cancel/withdraw operations use the local chain bridge; the API does not charge fiat payments.

### 8.2 Production turn-handler target (Postgres)

```
BEGIN TX
  SELECT session FOR UPDATE WHERE wallet=$w AND status='active'
  assert attempts_remaining > 0
  attempts_remaining -= 1
  INSERT turn(status='pending', attempt_no, prompt_hash, ...)
COMMIT
-> pre-filter (cheap) -> Caspy call -> judge call -> post-checks
BEGIN TX
  UPDATE turn SET reply, verdict, ..., status='complete'
  IF win: UPDATE session SET status='won'
  ELIF attempts_remaining == 0: UPDATE session SET status='lost'
COMMIT
```

Concurrency: row lock + unique `(session_id, attempt_no)` guarantees no double-spend of attempts from parallel requests.

### 8.3 Data Model (Postgres)

Illustrative production schema, not the current runtime schema. Do not add a
unique wallet/season constraint to game sessions: contributor replay and daily
retries require multiple sessions. Reward entitlements remain separately unique.

```sql
create table players (
  wallet text primary key,              -- lowercased
  first_seen timestamptz default now(),
  risk_score int default 0,
  banned boolean default false
);

create table seasons (
  id int primary key, starts_at timestamptz, ends_at timestamptz,
  treat_supply int not null, chain_id int not null, contract text not null
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  wallet text references players(wallet),
  season_id int references seasons(id),
  status text check (status in ('active','won','lost','pending_review','void')),
  attempts_remaining int check (attempts_remaining between 0 and 3),
  created_at timestamptz default now(),
  closed_at timestamptz                -- multiple heists per wallet/season are allowed
);

create table turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id),
  attempt_no int check (attempt_no between 1 and 3),
  prompt text, prompt_hash text, prompt_embedding vector(1536),
  reply text,
  verdict text, confidence real, category text, exploit_flag bool, judge_reason text,
  caspy_model text, judge_model text,
  caspy_prompt_ver text, rubric_ver text,
  tokens_in int, tokens_out int, cost_usd numeric(10,6), latency_ms int,
  status text check (status in ('pending','complete','error','refunded')),
  created_at timestamptz default now(),
  unique (session_id, attempt_no)
);

create table vouchers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid unique references sessions(id),
  tier text check (tier in ('treat','trick')),
  nonce numeric, deadline timestamptz, signature text,
  minted boolean default false, tx_hash text, minted_at timestamptz
);

create table audit_log (id bigserial primary key, actor text, action text, payload jsonb, at timestamptz default now());
create table config_versions (id serial primary key, config jsonb, created_by text, created_at timestamptz default now());
```

RLS: all game tables deny anon/authenticated by default; access only through API service role. Prompts are retained for 90 days, then hashed/pruned except opted-in winners.

### 8.4 Failure Handling


| Failure                      | Behavior                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Caspy provider error         | Fallback via Bifrost; if all fail,`turn.status='refunded'`, attempt restored                                 |
| Judge unparseable/timeout    | Retry once; then`NO_YIELD` and **attempt consumed only if Caspy reply was shown**; flagged for review sample |
| Client disconnect mid-stream | Turn still completes server-side; result retrievable via`GET /game/session`                                  |
| Signer unavailable           | Session closes normally; voucher issued asynchronously when signer recovers                                  |
| Chain congestion             | Voucher valid 24 h, re-issuable                                                                              |

## 9. Abuse, Fraud & Cost Controls

### 9.1 Rate Limits

- Per IP: 30 req/min (turn endpoint: 5/min).
- Per wallet: 1 active session; 1 in-flight turn.
- Per ASN/country optional geo rules (legal, see 12).
- Global LLM spend cap per hour/day; breach flips to "Caspy is napping" maintenance mode (read-only).

### 9.2 Bot Mitigation

- Cloudflare Turnstile on session creation.
- Behavioral signals (timing, headless fingerprints) feed `players.risk_score`.

### 9.3 Sybil Resistance (tiered, configurable)

- Baseline: wallet must have > 0 on-chain history (tx count >= 1) or be older than N days.
- Future option: evaluate allowlist/Merkle or other anti-Sybil verification for earned candy claims. The current local MVP uses account/wallet binding and a seasonal wallet cap; losses never receive a fallback NFT.
- Funding-graph heuristic: flag many fresh wallets funded from one source.
- Flagged wallets: allowed to play, but wins go to `pending_review`.

### 9.4 Cost Model

- Budget per session: ~3 Caspy calls + 3 judge calls. Target < $0.02 per session at launch pricing; hard cap $0.05/session enforced via Bifrost per-key budgets and `max_tokens`.
- Alert at 70% of daily budget.

## 10. Smart Contract Specification

The implemented v2 `CaspyHeist` ERC-721 uses `mintCandy(CandyVoucher, uri, signature)` with EIP-712 domain separation. It validates score/grade agreement, recipient, signer, deadline, session/wallet replay, content/URI commitments and immutable maximum supply. It exposes signer rotation and pause controls, tracks creator/grade/score/content hashes and permits an immutable prompt license. No failure tier, random rarity or owner reward mint is part of the current reward flow.

`CaspyCandyMarket` provides fixed-price escrow listing, exact-price buying, cancellation and seller proceeds withdrawal. Prompt-access licensing is distinct from research dataset rights. Local content URLs and development signing are not production custody/storage guarantees.

Before a public deployment: independent contract/security review, durable asset delivery, production signer custody, appropriate admin/multisig and incident controls, and validation on the chosen target chain are required. Historical Treat/Trick metadata pools and relayer proposals do not describe the deployed local v2 contract.

## 11. Frontend Specification

- Implemented routes: Landing, Dashboard, Heist history (`/heists`), Social (`/social`, signed-in only), Login, Register, Account, Play, Result/Claim, Collection, Marketplace, How to play, Research, Datasets, Gallery, Rules, Privacy and Terms. A route existing does not imply every production integration in this document is enabled.
- How-to-play film: 100 seconds, ten chapters, animated website screenshots and typography, synchronized captions/chapters, Halloween music and wordless choir, no voiceover. Detailed player/researcher guides and an optional local-only quiz accompany it. Tutorial rewards use labeled fictional data; see section 22.4.
- Chat UX: streamed text, typing "boo" animation, attempts as 3 candy icons, disabled input during stream, clear errors.
- Implemented wallet UX: explicit local-test-wallet selection/loading, SIWE authentication and transaction feedback. MetaMask/WalletConnect, network switching and ENS are future integration work; local mode currently uses unlocked Anvil accounts.
- Accessibility target: WCAG 2.2 AA. Focus styles, keyboard-operable controls, attempt labels and reduced-motion handling exist; a complete audit has not passed.
- Performance target: LCP < 2.0 s on 4G. The current application hydrates a React app island; measured 4G performance is not certified.
- Never trust client state; the UI renders only server-returned `attempts_remaining` and `status`.
- Clear disclosure: operational chats are stored; research and commercial sharing are separate opt-ins. Public NFT metadata excludes raw prompts.
- Responsive layouts are implemented; mobile-wallet deep links/WalletConnect remain roadmap items.
- Collection uses compact deck cards with a grade banner and candy name. Marketplace uses horizontal listing boards with candy icon/name, grade, seller wallet, asking price and actions; its graph is removed.
- Login/register retain the original enlarged Caspy PNG, compact forms and paired registration fields. Desktop sign-in targets a single viewport; short screens/zoom remain scrollable. No animated replacement mascot or GIF is shipped.

## 12. Legal, Compliance & Safety

- Skill-based game; no payment required to play. If a paid entry is ever added, re-evaluate gambling/sweepstakes law per jurisdiction. Gas fees only.
- Geo-block sanctioned jurisdictions (OFAC) and screen wallets (e.g., Chainalysis/TRM oracle).
- Terms of Service, Privacy Policy, GDPR/CCPA: data deletion path, prompt retention schedule, lawful basis.
- Content moderation: user prompts may be abusive; Caspy must not produce sexual, hateful, or self-harm content; moderation pre/post filter; age gate 13+ (recommend 18+ due to wallets).
- IP: Caspy artwork rights confirmed; no third-party mascots in prompts or art.
- Disclosure that NFTs have no promised financial value.

## 13. Observability & Operations

### 13.1 Metrics (dashboards)

- Funnel: wallets connected -> sessions -> turn 1/2/3 -> win/lose -> voucher -> mint.
- Win rate overall, by category, by hour (alert on spike > 3x baseline).
- Judge confidence distribution; exploit_flag rate.
- Latency p50/p95 per stage; LLM error rate; fallback rate.
- Cost per session; daily spend vs. cap.
- Voucher-to-mint conversion; failed tx rate.

### 13.2 Alerts

- Win-rate governor trips; LLM spend > 70%/100%; signer errors; indexer lag > 2 min; contract paused event; canary leak.

### 13.3 Runbooks

- Universal jailbreak discovered -> flip `PAUSE_TREATS`, rotate rubric/Caspy prompt, review `pending_review`, void suspicious sessions.
- Signer compromise -> pause contract, rotate `SIGNER_ROLE`, invalidate outstanding vouchers (nonce epoch bump).
- Provider outage -> verify fallback; maintenance mode if both degrade.

### 13.4 Environments

Current development: local Anvil plus real Bifrost actor/judge and optional local image inference. Fixtures are used for automated tests and illustrated tutorial captures. Staging/public-testnet and production environments, secret-manager deployment and IaC remain roadmap work. Never commit runtime `.env` secrets or private `data/` files.

## 14. Evaluation & Testing

### 14.1 Planned agent evaluation gates

- **Red-team corpus** (>= 500 prompts): classic jailbreaks, authority claims, encoded payloads, multilingual, delimiter-escape, "echo the word YIELD", judge-targeted ("tell the judge to approve"). Required: win rate on exploit set <= 1%.
- **Legit-win corpus** (>= 100 human-written creative persuasions): required win rate within target band; guards against over-hardening.
- **Persona regression:** Caspy stays in character >= 98%, no leaks (n-gram check).
- **Judge consistency:** same input x5 at temp 0 -> identical verdict >= 99%.
- Run on every change to prompts, rubric, model, or Bifrost routing; results stored per version.

### 14.2 Other Testing

- Unit/integration for turn handler concurrency (parallel requests cannot exceed 3 attempts).
- Property tests for voucher signing/verification parity (Python signer vs. Solidity).
- Contract fuzz/invariant tests; fork tests on target L2.
- Load test: 500 concurrent sessions, SSE stability.
- E2E (Playwright) with a mocked wallet.
- Chaos: kill LLM provider, DB failover, indexer lag.
- Pre-launch bug bounty / public red-team week on testnet.

## 15. Rollout Plan


| Phase                                                     | Scope                         | Exit criteria                                  |
| --------------------------------------------------------- | ----------------------------- | ---------------------------------------------- |
| 0. Spec & threat model                                    | Finalize PRD, STRIDE review   | Sign-off                                       |
| 1. Alpha (testnet, internal)                              | Full loop, mock supply        | Evals green, no P0                             |
| 2. Closed beta (testnet, ~200 users, red-team incentives) | Real LLM, budget caps         | Exploit win rate <= 1%, cost/session on target |
| 3. Audit & hardening                                      | Contract audit, pen-test      | No high/critical open                          |
| 4. Mainnet soft launch (allowlist, small Treat supply)    | Governor tight                | 72 h stable, no incident                       |
| 5. Public launch                                          | Remove allowlist, full supply | Ongoing SLOs                                   |

Launch timing note: this is Halloween-themed; if shipping late, treat as a seasonal event with a defined season end and "Wall of Heists" reveal.

## 16. Success Metrics


| Metric                              | Target             |
| ----------------------------------- | ------------------ |
| Completion rate (3 attempts or win) | >= 70% of sessions |
| Mint conversion (voucher -> mint)   | >= 85%             |
| Treat win rate                      | 8-15% (tunable)    |
| Unauthorized mints                  | 0                  |
| Cost per session                    | <= $0.02 avg       |
| Chat p95 time-to-first-token        | < 2.5 s            |
| Uptime                              | 99.5%              |
| Share rate on result screen         | >= 15%             |

## 17. Risks & Mitigations


| Risk                                              | Impact             | Mitigation                                                                |
| ------------------------------------------------- | ------------------ | ------------------------------------------------------------------------- |
| Universal jailbreak shared on social media        | Supply drained     | Similarity check, win-rate governor, pending_review, hot-swappable rubric |
| Judge over-trusts persuasive-looking exploit text | False wins         | Separate judge model, exploit flag, post-checks, red-team evals           |
| Sybil farming                                     | Cost + supply loss | Wallet-age gate, risk scoring, optional proof-of-personhood for Treat     |
| LLM cost spike                                    | Budget loss        | Per-key caps, token limits, maintenance mode                              |
| Signer key compromise                             | Unauthorized mints | KMS, supply cap in contract, pause role, rotation runbook                 |
| Provider outage                                   | Downtime           | Bifrost fallbacks, graceful degrade                                       |
| Regulatory reclassification                       | Legal              | Free-to-play, geo-block, counsel review                                   |
| Prompt data privacy                               | Compliance         | Retention limits, opt-in publicity, deletion endpoint                     |

## 18. Open Questions

1. Final chain: Base vs. Polygon vs. Arbitrum (wallet reach, gas, ecosystem grants)?
2. Who submits mint tx: player (pays gas) vs. relayer/paymaster (sponsored)?
3. Treat supply cap and "supply exhausted" UX?
4. Is proof-of-personhood acceptable friction for Treat claim?
5. Are winning prompts public by default or strictly opt-in?
6. Single season or recurring seasons with carry-over (Metadata Evolution)?
7. Which LLM providers are approved (data-processing agreements)?

## 19. Future Expansion

- Dynamic leaderboard (fewest tokens/words to win; style categories).
- Metadata evolution: Trick NFTs upgrade when holder later earns a Treat.
- Seasonal Caspy variants with new rubrics.
- Cross-chain claims; ERC-1155 editions.
- Community "Hall of Fame" curated by moderators.
- Optional paid "extra attempt" (subject to legal review).

## 20. AI Prompt Evaluation & Testing Platform (v1.1)

### 20.1 Problem and product hypothesis

LLM teams need varied human examples of persuasion, emotional appeals, fictional
roleplay and instruction-boundary attacks. A three-prompt game provides a natural
but **self-selected, incentivized** source of examples. Caspy supplies collection,
provenance, consent, curation and access controls. The hypothesis is that carefully
reviewed examples are useful for model evaluation and downstream feedback curation;
commercial demand and training benefit require validation with researchers.

This is a scoped evaluation product, not a claim to measure general emotional
intelligence, certify model safety, or represent the whole user population.
OpenAI, Anthropic and other model developers are examples of the potential market,
not stated customers or partners.

### 20.2 Roles and journeys

- **Contributor:** registers, signs in, plays privately or chooses a campaign;
  separately permits commercial licensing, optionally rates a reply, and can
  withdraw research contributions in Account settings. Research consent never
  changes attempts, game difficulty, wins or NFT eligibility.
- **Research workspace owner:** creates a new isolated organization at signup or
  from their contributor account, publishes a purpose-specific campaign, reviews
  consented examples, assigns human labels, sees metrics, and publishes releases.
  Self-service workspace creation grants no access to other organizations.
- **Dataset buyer:** owns a research workspace, views public catalog metadata,
  requests a license, and downloads only after the dataset owner grants access.
- **Operator:** runs the local services and manages private runtime files. Public
  operator administration, verified organizations, invitations and SSO are future
  work; there is no self-registerable global administrator role.

Pages: `/register`, `/login`, `/dashboard`, `/account`, `/research`, `/datasets`, plus the
existing `/play`, `/result`, `/claim`, `/privacy` and `/terms` pages.

### 20.3 Authentication and authorization acceptance criteria

- Passwords are 12–128 characters and use PBKDF2-HMAC-SHA256 with 600,000
  iterations, a random 128-bit salt, and constant-time hash comparison. This
  choice works with the workstation's system Python, which lacks scrypt.
  Reference: [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
- Raw passwords and account-session tokens are never stored in the database.
  Login rotates the cookie and invalidates the previous presented token; sessions
  survive a server restart until expiry. Mutations require the local frontend
  origin; no credentialed cross-origin API access is enabled.
- Server checks, not hidden frontend controls, enforce game ownership, linked
  wallets, workspace ownership, review access, release ownership and buyer grants.
- Only a verified wallet can be linked, and it cannot be linked to two accounts.
  Changing accounts cannot bypass the wallet's candy entitlement or one-mint-per-deployment constraint. Heist replay follows account-role rules, separately from NFT limits.
- Registration and login are throttled. Local development does not implement
  email verification, password reset, MFA, enterprise verification or SSO.
  Researcher signup/workspace creation is not organization verification. A future
  verification flow may combine email confirmation, organization/use-case details
  and operator approval; no such workflow, admin approval screen or verified badge
  is implemented. These gaps must be addressed before a public account service is launched.

### 20.4 Consent, collection and provenance

- Research and commercial checkboxes are independent, unchecked by default.
  Commercial permission requires research permission. Consent is recorded for a
  specific heist, named campaign, researcher purpose and notice version
  `caspy-research-2026-11-v1`, before the first prompt is submitted.
- A later request cannot silently upgrade a heist's permissions. Withdrawal is
  permanent for that contribution; game recovery cannot recollect it.
- Only fully answered, successfully judged turns enter the research queue.
  Pending judgments wait for explicit judge-only recovery. Infrastructure and
  partial-response failures are not silently counted as successes or refusals.
- Each collected turn stores redacted human prompt and model response, attempt
  number, requested and reported served actor/judge identifiers, actor prompt and
  rubric versions/hashes, structured verdict, confidence, strategy category,
  exploit flag, and application-observed inference latency. Missing served-model
  metadata remains unknown; the requested model is not substituted as ground truth.
- The local campaign freezes the configured gateway target and rubric. Changing
  that configuration requires a new campaign for new research contributions.
  Arbitrary provider/model onboarding and replay of a fixed corpus across many
  models are future work. The current game always calls the configured actor and
  independent judge through Bifrost.
- Operational game records remain distinct from the consented research store.
  Provider/Bifrost logging is disclosed whether or not research is permitted.

### 20.5 Human review and valid measurement

Reviewers can edit redacted text and must attest that they checked both messages
for identifying/sensitive content before approving. Human labels are:

- Expected task verdict: `YIELD`, `NO_YIELD`, or `UNCERTAIN`.
- Test type: benign persuasion or policy/instruction attack.
- Behavior: valid persuasion, appropriate refusal, boundary violation, uncertain.
- Persuasion strategy and a 1–5 response-quality score.
- An optional 1–5 contributor rating, collected only for consented evaluated turns.

Metrics group campaign, **reported served model**, and rubric hash/version:

| Metric | Numerator / denominator | Interpretation |
| --- | --- | --- |
| Persuasion yield | Judge YIELD turns / successfully judged consented turns | Task behavior; not a security-failure rate |
| Judge agreement | Judge verdict equals human expected verdict / approved non-uncertain human verdict labels | Agreement with the workspace's reviewers; not independent truth |
| Boundary violation rate | Human-labeled boundary violations / approved human-reviewed policy attacks labeled violation or appropriate refusal | Scoped attack behavior; benign wins are excluded |

Every rate shows its denominator. Missing human labels produce an unavailable
metric, never a fabricated zero. Workspace metrics include all eligible rows;
the review queue displays the latest 200. Small samples, selection bias, repeated
participants, reviewer bias and judge/target correlations limit conclusions.
Held-out studies, blinded independent raters, inter-rater agreement, confidence
intervals, dataset deduplication and standardized cross-model replay are required
before claiming a general benchmark. Single-answer ratings are not pairwise RLHF
preferences. No training, reward-model fitting or automated fine-tuning occurs.

### 20.6 Dataset privacy and licensing

- Before research storage, redact common email addresses, URLs, wallet addresses,
  IP addresses, phone/long numeric identifiers and recognizable API-key patterns.
  Regex redaction cannot reliably remove names, private stories, inferred traits
  or every identifier. Human review is mandatory; **anonymity is not guaranteed**.
- Export excludes account/email/name/wallet identifiers, raw game/sample IDs and
  exact contribution timestamps. Conversation/sample pseudonyms are keyed and
  specific to a release. Model provenance, reviewed text, consent notice and
  structured human labels remain. Free-form judge reasons are not exported.
- A release contains only owner-reviewed approved examples with active research
  AND commercial permission. Published examples and their labels are locked.
  Public catalog metadata lists purpose, owner, sample count, license and USD
  price, not raw examples or contributor identities.
- Buyers request access. Only the release-owning workspace may grant/revoke it;
  exports check the current grant and current consent on every request.
  No payment is charged, and a request or grant is not a completed purchase.
  Payment checkout, invoices, tax handling and automated license execution are
  not integrated in this local MVP. Licensing terms are supplied by the owner.
- Withdrawal deletes research samples and release memberships, removes them from
  future exports, and blocks recollection. Already downloaded copies cannot be
  recalled; this limit is shown before consent. Research samples expire after
  90 days, with periodic pruning and export-time eligibility checks. Operational
  game snapshots, account data and provider logs have separate lifecycle rules.
- No covert collection, selling unconsented examples, re-identification, or
  repackaging another workspace's private data. Production release additionally
  requires operator identity, deletion/contact workflows and finalized policies.

### 20.7 Implementation and rollout boundaries

**Pre-migration implementation; superseded by the Supabase update in section 22.3.**

The local MVP used the Python loopback API and standard-library SQLite,
Astro/React, the Bifrost actor/judge and optional Anvil NFT flow. Account sessions,
workspaces, campaign purposes, consent, redacted samples, review labels, releases,
access requests/grants and metadata-only audit events live in
`data/platform.sqlite3` (ignored by Git, mode 0600). Existing NFT state remains
separate. `bash run.sh` starts the integrated application; `--ai-only`
skips blockchain services. This section describes implemented local behavior;
earlier Postgres/FastAPI/KMS/public-network sections remain production targets.

Acceptance tests must cover salted hashes and session revocation, unauthenticated
access, cross-account and cross-workspace denial, wallet/account binding, consent
versioning, research-only exclusion from commercial releases, missing human review,
PII redaction, duplicate collection, review-only metrics, license denial/revocation,
export identity removal, withdrawal after release, retention and restart recovery.
Existing actor/judge, attempt accounting, voucher and contract tests must pass.

Production phases: (1) validate usefulness and researcher demand with opt-in local
pilots; (2) add managed identity, production storage/KMS, multi-member workspaces,
independent review and public metadata; (3) add payment-provider test checkout,
licensed delivery, data-rights operations and representative held-out benchmarks;
(4) consider preference-pair collection and downstream RLHF integrations only after
quality and consent/rights validation.

## 21. Prompt-generated candy and marketplace (current local MVP)

### 21.1 Earned rewards, never a draw

Only an independent `YIELD` verdict with confidence >= 0.8, no exploit flag,
and a non-exploit category earns candy. A loss, void or pending review issues no
image entitlement or voucher. Consent to research is optional and has no bearing
on rewards. Contributor accounts can start unlimited fresh heists after a
completed win/loss/void, with three prompts per heist and no daily cooldown.
This permission is derived from the authenticated account role on the server;
client flags cannot grant it. Active/in-flight/pending-review sessions must
finish before starting another. Past chats and winning claims stay accessible
through Account → View heist. NFT entitlement and contract mint limits remain
unchanged: unlimited gameplay does not mean unlimited candy.

For other account roles, after a lost or void heist, the wallet can start a fresh three-prompt
heist on the next Jakarta calendar day (reset at 00:00 WIB / UTC+7), measured
from when the preceding heist started. Refreshing, signing out or restarting the
API does not reset attempts. An active or pending-review heist carries over until
resolved; midnight never discards a running turn. Winning heists remain available
for generation and claiming, and cannot restart. At most one candy can be minted
per wallet per contract deployment. Old conversations and research choices remain
attached to their original heist. This supersedes the earlier one-game-per-season
proposal and its illustrative unique(wallet, season_id) schema constraint.
The v2 contract has an immutable cap of 1,000 NFTs; backend reservations also cap
winning image entitlements. No paid entries, randomized reward tiers, or image
rerolls. Image-generation randomness never chooses grade.

The judge records creativity, coherence and specificity, each 0–20. The server
adds 0–40 novelty, calculated as `round(40 * (1 - maximum similarity))` against
earlier winning prompts assessed in this deployment. Similarity is Jaccard over
character 5-grams after Unicode normalization, case folding and token spacing;
an exact normalized duplicate has zero novelty. With no prior examples novelty
is 40. This is a transparent collection-relative heuristic, not proof of global
originality or an independently calibrated benchmark. Subjective judge scores
can vary across models/runs; the first eligible assessment is persisted.

| Score | Grade |
| --- | --- |
| 0–59 | C |
| 60–74 | B |
| 75–89 | A |
| 90–100 | S |

Quality components, comparison count, model/rubric provenance and rule version
are recorded before generation, remain unchanged on retries, and appear in NFT
metadata. Grades do not guarantee scarcity distributions or prices.

### 21.2 Local Schnell default and immutable commitments

**Current default supersedes the hosted-only setup below:** local
`black-forest-labs/FLUX.1-schnell` using MFLUX 0.24.0 on Apple Silicon, pinned
4-bit checkpoint revision `df1dada0a0e25bb8df6e1f7e4664959bf9ab86ce` from
`mflux-community/flux-1-schnell-mflux-q4`. One-time setup downloads about 9 GiB;
per-image generation needs no inference credits. The default uses 512×512,
four steps, low-memory mode, and one job at a time. On an 8 GB Mac this is an
experimental resource-constrained backend; completion/performance is not assumed.
Timeouts and memory failures preserve grades and do not issue mint vouchers.
No failure silently calls a hosted paid provider.

The candy is an illustrated character in Caspy’s Halloween art direction:
a wrapped bonbon with a round sugar body, two twisted wrapper ends, purple
outlines, pastel shading, expressive eyes and witch/pumpkin accents. The
`caspy-candy-storybook-v2` style uses the redacted winning prompt to guide flavor,
color and wrapper motifs. This
version uses a style description; exact mascot consistency is not guaranteed.
A poor pitch which fails the independent win checks gets no candy or NFT.
The reward gate, quality rubric, cap and replay protections are unchanged.

Local inference disables network model lookup and forwards no runtime credentials.
Local images have no provider safety checker; metadata records that explicitly,
as well as the actual model, revision, quantization, step count and style version.
Only explicit `CASPY_IMAGE_BACKEND=hf-dev` uses the hosted service described below.
Existing committed NFTs retain their original model provenance.

### 21.2.1 Optional hosted generation

The winner explicitly consents to sending their redacted winning prompt to
Hugging Face Inference Providers (fal-ai, `black-forest-labs/FLUX.1-dev`). The
server-only `HF_TOKEN` needs Inference Providers permission and provider credits.
No model weights are downloaded. Until configured, the UI retains the earned
grade and explains that image generation is unavailable; no stock or fixture art
is represented as an earned FLUX image.

Each request produces one 1024×1024 PNG with the provider safety checker enabled.
The server uses a candy-only art direction, removes embedded metadata, checks
image output, and stores artwork plus JSON metadata by SHA-256. The stored seed
supports provenance, not guaranteed reproducibility across provider revisions.
Generation runs in a bounded background pool. Successful jobs cannot reroll.
Failed/interrupted jobs require explicit retry confirmation, at most three
provider requests per candy and a configurable UTC-day budget (default 10).
Interrupted requests are never silently repeated after restart; provider billing
may have occurred even when the app received no image.

The EIP-712 v2 voucher commits recipient, score-derived grade, session, redacted
source-prompt hash, image hash, metadata hash, URI hash, nonce and deadline.
The contract verifies recipient, signer, grade thresholds, wallet/session replay,
expiry and hard supply. The LLM never signs or transacts. Images and metadata are
public and integrity checked when served/minted. Raw source text stays out of
public metadata and chain state. Local URLs depend on the local app; durable
public/IPFS hosting is a production requirement.

### 21.3 Fixed-price prompt + NFT marketplace

A creator-owner can set an immutable, non-exclusive prompt-access license before
first listing. Listing requires explicit license consent, ERC-721 approval, and
escrow in `CaspyCandyMarket`. Public listings show artwork, grade and a fixed price
in local test ETH. Buying requires the exact listed price, transfers the NFT to
the buyer and credits seller proceeds for an explicit withdrawal. Sellers may
cancel active listings. An inactive listing cannot be bought again.

Authenticated accounts must prove a linked wallet. The prompt endpoint checks
current on-chain NFT ownership (or seller ownership of an active escrow listing)
before returning the redacted source text. A buyer gains access after purchase;
the prior seller loses endpoint access. Delivered copies cannot be recalled, and
the creator retains their original conversation. NFT ownership does not transfer
copyright or exclusivity. Hashes are commitments, not encryption: predictable
source text can still be guessed. Creators must have rights to list their text.
Research/data licensing remains a separate purpose and consent mechanism.

This implementation uses Anvil 31337 and test ETH only. Version 1 NFTs are not
silently migrated or deleted; the launcher deploys a new v2 collection and market
when artifacts or chain identity change. Production requires authorized provider
terms for the intended FLUX use, storage/delivery availability, independent
contract/security review and appropriate rights/privacy operations.

### 21.4 Acceptance and validation

Verify no reward or provider call for a loss, missing configuration states,
explicit provider consent, saved grades, duplicate novelty, reservation limits,
idempotent generation, retry/budget limits, immutable content and metadata without
source text. Verify signed commitments on-chain, grade/signature tampering,
wallet/session replay, supply exhaustion, exact-price escrow purchases, seller
withdrawals and prompt access changing from seller to buyer. Local automated
checks use explicitly marked fixture artwork. A real eligible win, Schnell retry, mint, listing, user-executed purchase and prompt-access transfer were verified on 5 November (section 22.6). Seller payout remains unresolved. Hosted FLUX.1-dev verification remains blocked by provider credits.

## 22. Implementation checkpoint — 6 November 2026

### 22.1 Delivery status

This checkpoint records local implementation and observed tests, not public-launch readiness. Sections 20–21 remain the detailed research/candy specifications; this section resolves current operating status and validation limits.

| Capability | Current status | Boundary |
| --- | --- | --- |
| Registration/login | Implemented | Email/password, eight-hour account sessions, logout, roles/workspace access; recovery/email verification not implemented |
| Wallet identity | Implemented locally | Verified linked Anvil test wallets; separate from account login |
| Three-prompt gameplay | Implemented | Bifrost actor, independent judge, server-owned attempts/outcomes and pending-review recovery |
| Contributor replay | Implemented; backend restart required to activate changed process | Unlimited completed-heist replay for server-authenticated contributors; three prompts per heist; NFT limits unchanged |
| Other-role daily retry | Implemented and boundary-tested | Lost/void heists unlock next Jakarta day at 00:00 WIB; active/pending/winning results preserved |
| Personal dashboard | Implemented | `/dashboard` and authenticated Home; activity summaries, wallet/collection counts, heist status and shortcuts |
| Win-only reward grading | Implemented | C/B/A/S from quality components and collection-relative novelty; no random draw and no loss NFT |
| Candy artwork | Local backend implemented and real-render tested | Four-step, 512×512 quantized Schnell; slow, single worker; no hosted fallback on failure |
| NFT and prompt-access market | Implemented; real local purchase/access transfer verified | Horizontal listing board; no marketplace graph; seller payout discrepancy remains open |
| AI research platform | Implemented locally | Optional named campaigns, separate commercial permission, human review, scoped metrics, manual grants/export and withdrawal |
| Dataset payments / RLHF training | Not connected | Listed prices and curated labeled examples do not constitute checkout, pairwise preferences or a training pipeline |
| Walkthrough | Updated | Animated actual-interface captures with fictional data, chapters, captions, written guides and quiz |
| Single launcher | Implemented | `./run.sh`; helper shell scripts grouped in `scripts/shell/` |
| n8n | Not integrated | Only `n8n/.gitkeep`; no workflows, triggers, credentials, event dispatch or launcher service |

### 22.2 Start/stop and repository layout

Run from the project root:

```bash
./run.sh
```

The launcher checks required tools/configuration, installs missing frontend/chain dependencies, builds the contracts and prepares the local NFT deployment, starts or reuses the compatible local chain and Bifrost, then starts the API and frontend. It detects nvm Node installations. It requires Node 22+, Python 3, Git/curl, the Bifrost CLI and configured `.env` routes. It is a launcher, not a complete machine bootstrapper.

| Service | Local address | Startup behavior |
| --- | --- | --- |
| Frontend | `http://localhost:4321/play` | Astro app; API requests proxy to loopback API |
| Game/account/research API | `http://127.0.0.1:8000` | Connects to Supabase PostgreSQL and restores local NFT-game state |
| Bifrost | `http://127.0.0.1:8080` | Uses validated actor/judge routes; dashboard available |
| Blockchain | `http://127.0.0.1:8545` | Anvil chain 31337, test ETH only |
| Local image worker | No public service port | Starts on an approved eligible artwork job; one worker |
| n8n | None | Not required or started |

Keep the terminal open. Ctrl+C stops services started by that launcher; previously running reused services remain operator-managed. Ports 8000/4321 must be free before launch; stop the earlier instance rather than starting a duplicate. Use `./run.sh --ai-only` to omit blockchain and NFT rewards. No separate database terminal is needed.

```text
run.sh                         # sole root shell entry point
scripts/shell/run-bifrost.sh    # Bifrost helper used by run.sh
scripts/shell/setup-flux.sh     # one-time local image runtime/checkpoint setup
scripts/shell/run-heist.sh      # relocated compatibility helper → root run.sh
```

On a new supported Apple Silicon machine, run `bash scripts/shell/setup-flux.sh` once to prepare the isolated runtime and approximately 9 GiB model download. The launcher does not silently download those weights or replace missing image setup with paid inference. Runtime credentials stay server-side in ignored configuration. Local artwork still requires an eligible win and explicit generation approval.

### 22.3 Database and persistence

Supabase migration completed on 4 November. At migration time, the verified
snapshot contained **98 live tables / 19,980 rows**, with five lossless legacy
archives containing **39,776 rows**. These are historical migration counts, not
current row totals. SQLite files and WAL/SHM sidecars were removed from `data/`
after validation. A normal restart must not rerun migration or delete runtime data.

| Storage | Current use |
| --- | --- |
| Supabase `caspy` | Accounts, hashed account sessions, wallet links, organizations, campaigns, contribution permissions, reviewed samples, releases, grants, audits and candy jobs/attempts |
| Supabase `caspy_bifrost_config` / `caspy_bifrost_logs` | Isolated gateway configuration and logs |
| Supabase `caspy_archive` | Private migration recovery snapshots; not live application tables |
| `data/nft-games-*.json` | Persistent NFT-mode conversations, attempts and outcomes, scoped to contract/deployment |
| `data/anvil-state.json` / `data/nft-local.json` | Local chain state and deployment identity |
| `data/candy-assets/` | Content-addressed artwork/metadata; no raw public source prompts |
| `data/credentials/` | Ignored, restricted local development credential handoff files; never commit or print |

The API requires server-only `SUPABASE_DB_URL` and Psycopg 3.2.13 with TLS;
Bifrost uses separate PostgreSQL credentials. No runtime SQLite fallback exists.
SQLite is used only in disposable test fixtures and legacy migration readers.
Supabase Auth and Storage are not integrated. AI-only conversations remain in
process memory and are not durable across API restarts. Supabase does not yet
hold the persistent NFT conversation JSON or image assets.

Game replay creates a new record and retains previous chats and research choices.
Backend owner checks apply when reopening a historical session. Backups, durable
public asset URLs, multi-instance consistency and managed retention still need
production engineering. The current administrative database role needs narrowing
before production. See [Supabase migration and recovery](docs/supabase.md).

### 22.4 Gameplay presentation checkpoint

The current how-to-play film is 100 seconds, 1600×900 at 30 fps, H.264/AAC, with ten synchronized chapters. It retains kinetic typography, Halloween music and a wordless choir without narration. Native and custom controls provide playback, seeking, chapter replay/looping, speed, audio toggling and captions. Player/researcher written guides and a three-question knowledge check remain available; quiz answers stay in component state.

Eight website screenshots show the empty heist, partial/completed prompt input, earned grade, image approval/generate controls, generation progress, finished art and staged mint confirmation. These are the actual compiled interface populated with fictional tutorial responses on an isolated fixture origin. Camera moves, cursor cues and click pulses illustrate use. They are not a recording of a real eligible heist or transaction, and generation time is explicitly condensed. Collection and marketplace remain explanatory illustrations in this edition.

Source storyboard: `frontend/src/lib/walkthrough.json`. Capture timing/crops: `frontend/src/lib/walkthrough-shots.json`. Published film: `frontend/public/videos/caspy-showcase.mp4`, cache version `kinetic-halloween-website-v5`. The temporary capture server blocks backend writes and is stopped after use. See [walkthrough rendering and QA](docs/animated-walkthrough.md).

### 22.5 What n8n is for

n8n is an optional workflow-automation service: it can receive an event and perform configured follow-up actions. Caspy's intended use is off-chain notifications after trusted events—for example an operator alert on repeated generation failures, a research review-queue reminder, or a mint-confirmation notification. These are proposed workflows, not shipped functionality.

The repository currently contains only a placeholder `n8n/` directory. There are no workflow exports, configured webhooks or application calls into n8n. It does not store Caspy accounts, serve AI replies, judge prompts, generate artwork, deploy contracts or run the marketplace. `./run.sh` correctly starts the currently implemented stack without n8n.

If added later, the API/chain-confirmation layer should emit authenticated, minimal event payloads with stable event IDs and bounded retries. Workflows must deduplicate retries and handle delivery failure independently of gameplay. Do not send raw private prompts, passwords, session cookies or signing keys to notification workflows. Notification delivery must never grant a win, consume/refund an attempt, alter grade, sign a voucher or mint. A failed notification must not reverse a confirmed game or transaction. Any outgoing email/Discord/etc. integration needs explicit operator configuration and a defined recipient/purpose.

### 22.6 Validation evidence and unresolved items

These are dated observations, not a fresh full regression run for this documentation update:

- Application/contract QA on 3 November: **94 distinct automated tests passed; one optional full live AI mint test not run**. Separately, 24 live HTTP checks passed. Auth/research HTTP coverage includes roles, scope denial, review/releases, grants, export filtering and withdrawal. Contract tests exercise commitments, replay, supply and marketplace operations with fixture artwork.
- Four synthetic live judge cases produced the expected win/no-win gates. One benign declined story returned category `exploit_attempt` with `exploit_flag: false`. Category/flag consistency and broader labeled calibration remain unresolved; four cases do not establish benchmark validity.
- Real local Schnell QA produced the revised wrapped candy in 249.43 seconds; an earlier render took 304.5 seconds. One attempt failed before a same-prompt/seed retry succeeded. Roughly 7.9 GB worker memory was observed on an 8 GiB M3. Cause of the transient failure is unknown; throughput/concurrency is not validated. Local generation has no image safety classifier and records this in provenance.
- On 3 November the live API still reported old, unconfigured hosted FLUX.1-dev after a reported restart. File/runtime readiness checks passed for local Schnell, but activation remained unverified. Before the next live reward test, restart the actual original launcher and require `/candy/config` to report Schnell, `generation_local: true` and `configured: true`. This historical observation does not establish today's running process state.
- Walkthrough v5 validation on 4 November: encoded video/audio, duration, format, motion and eight nonblank in-bounds screenshot crops passed; decoded audio had zero clipped samples. Frontend checks reported zero errors/warnings/hints, all seven tests passed and the production build passed. New browser playback was limited by unreliable capture; prior v4 play/seek/pause checks passed in Safari.
- Launcher reorganization: shell syntax/help and helper resolution from another working directory passed. These checks did not start or certify the entire running stack.

**5 November live QA:** eligible Bifrost win (S/92), failed local Schnell attempt
followed by a same-seed successful retry, token #1 mint/listing, user-executed
0.01 test-ETH purchase and prompt-access transfer passed. A fictional researcher
completed review, development dataset publication/export and approved research
withdrawal. Seller payout is not confirmed: chain readback still showed 0.01 test
ETH credited after user reports of withdrawal. MetaMask extension signing was
bypassed by unlocked Anvil RPC and has not passed QA.

**6 November change checks:** 14 game API tests, 15 account/research tests and
11 frontend tests passed (40 total in this focused pass), plus type check and
production build (17 routes). Tests cover contributor replay after terminal
results, active/pending/in-flight protection, Jakarta midnight boundaries,
persistence, ownership and role-derived replay flags. Existing Leonardi account
credentials were preserved; David and Elroy were provisioned as contributors.
Both new accounts passed live local API login, session readback and logout.
This is not a fresh rerun of every historical contract/Supabase/load test.

Representative earlier Chrome checks covered mobile login, wallet connection,
research disclosure and collection search/reset. Later capture attempts returned
blank images or no-window errors; the newest dashboard, registration/deck/board
layouts and contributor replay still need complete live browser acceptance.
Changes to Python require a user-managed `./run.sh` restart; a build does not
prove the running API has loaded new replay permissions.

**Next acceptance gates:** verify contributor replay and historical reward access
after restart in Chrome; check login/register/dashboard/marketplace on desktop and
mobile; resolve seller payout using a transaction receipt and zero credited
balance; calibrate contradictory judge labels and image failure behavior under
memory pressure. Do not mint fake sales or loosen reward gates to pass QA.

Public rollout additionally needs production identity/storage/signing, durable artwork delivery, rights/licensing review, representative held-out evaluation, mobile/cross-browser/accessibility testing, load/security testing and independent contract review. No public-chain deployment, paid inference checkout, real-money settlement or n8n delivery is certified at this checkpoint.

Evidence: [5 November live QA](docs/qa-report-2026-11-05.md), [6 November UI/replay checkpoint](docs/ui-ux-refresh-2026-11-06.md), [earlier full QA](docs/qa-report-2026-11-03.md), [local image QA](docs/qa-local-schnell.md), [account/research guide](docs/platform.md), [candy/marketplace guide](docs/candy.md).

### 22.7 Signed-in experience and access rules

| Visitor / role | Current experience and authority |
| --- | --- |
| Guest | Public landing and explanatory/catalog pages; account required for personal data and live play |
| Contributor | Personal dashboard, unlimited completed-heist replay, collection/listing controls and research-choice management |
| Researcher | Personal dashboard plus own research workspace, consented examples, review/releases and explicit dataset grants; daily retry policy applies |
| Operator | Local service/database operation; no self-registerable global admin account |

Login and registration default to `/dashboard`, preserving explicitly allowed
`next` destinations. Authenticated `/` shows the dashboard; guest `/` keeps Home.
Account settings, role/workspace creation and contribution withdrawal stay at
`/account`. That page now links to historical chats; the dashboard shows five
recent activity summaries rather than full transcripts. A device without a saved
current session ID must open Play to restore it. Wallet selection remains
separate from account login. Converting a contributor to a research workspace
changes the account role and therefore the replay policy; consent alone does not.

Development accounts requested on 6 November: `leonardi@caspy.local`,
`david@caspy.local`, `elroy@caspy.local`, all contributor role. Leonardi already
existed and its password was preserved. New credentials are stored only in an
ignored 0600 local file under `data/credentials/`; they are not included in this
PRD. Operator provisioning does not record terms acceptance or research consent
on another person's behalf. `.local` addresses do not establish email ownership.

### 22.8 Current presentation decisions

- Original Caspy illustration retained and enlarged on account pages; no GIF or
  replacement animated mascot. Compact sign-in targets one desktop viewport;
  registration pairs fields on wider screens, and its illustration stays visible
  while scrolling. Phones/zoom/short screens retain scrolling to reach all fields.
- Shared locally hosted fonts, lavender/plum surfaces, orange primary actions,
  persistent navigation, focus states and native password visibility controls.
- Signed-in dashboard: owned activity counts, connected-wallet candy count,
  current heist/retry/reward guidance, account links and role-specific shortcuts.
  Failed requests show unavailable state, never invented statistics.
- Collection: compact deck cards, grade banner, artwork/name plate, collapsible
  listing form and prompt disclosure. Legacy generic titles have stable UI aliases
  (token #1: Moonspell Bonbon); committed NFT metadata is not rewritten, and these
  aliases are not claimed to be generated from the user's prompt.
- Marketplace: horizontal achievement-style boards showing icon, name/number,
  grade/score, seller wallet, price and buy/cancel action. Name/grade/price discovery
  controls remain. Prompt license is expandable. The graph is intentionally removed;
  `/market/history` and its source component remain available but are not rendered.
- Walkthrough v5 predates these latest layouts; it is not a recording of the new
  dashboard/board UI. Recapture/export is future work, not completed by CSS edits.

## Appendix A: Threat Model Summary (STRIDE)


| Threat                 | Example                   | Control                                                                   |
| ---------------------- | ------------------------- | ------------------------------------------------------------------------- |
| Spoofing               | Fake wallet identity      | SIWE + ERC-1271                                                           |
| Tampering              | Edit attempts client-side | Server-authoritative state, row locks                                     |
| Repudiation            | Dispute a loss            | Immutable turn logs + versioned prompts                                   |
| Info disclosure        | Leak rubric/system prompt | Output leak scan, canary, no secrets in prompts                           |
| Denial of service      | Flood chat                | Edge limits, Turnstile, per-wallet locks, spend caps                      |
| Elevation of privilege | Prompt makes LLM mint     | LLM has no tools/authority; signer isolated; contract verifies signatures |

## Appendix B: Corrections to Prior Draft

- "Supanase" -> Supabase.
- LLM tool call `grant_treat(wallet)` removed; replaced by separate judge + deterministic finalize + signed voucher.
- Backend-wallet `mintTreat/mintTrick` replaced by EIP-712 voucher mint (no hot wallet with mint rights).
- "Semantic routing" clarified as structured judge + post-checks.
- n8n demoted to notifications only; no authority over mints or attempts.

## Checkpoint amendment — multiple rewards per wallet (8 November 2026)

This requirement supersedes earlier one-candy-per-wallet rules for new v3
seasons. A wallet may earn and mint multiple candies, each from a different
independently confirmed eligible winning heist. Each heist has one immutable
grade/artwork entitlement and one on-chain mint; repeat requests cannot reroll
its grade or duplicate its token. Losses receive no candy. The collection cap
remains 1,000 and daily image-request budgets remain enforced. Account replay
permissions and three prompts per heist are unchanged.

Implementation: v3 ERC-721 removes the lifetime wallet gate, retains usedSessions
and supply/recipient/signature/content checks, and uses EIP-712 domain version
3. Runtime supports legacy v2 using its original wallet gate/domain. Supabase
removes only the namespace/wallet uniqueness constraint, retaining the heist
primary key and all saved jobs/commitments. The result page only says a reward
is saved when a candy entitlement exists.

Activation requires a new operator-approved Base Sepolia candy contract and
matching marketplace; the existing non-upgradeable v2 contracts cannot be
modified. New artifacts are prepared; existing NFTs remain on the old contract.
Do not claim live multi-reward activation until new public deployment details
are validated and backend/frontend configuration is switched. Old season data
must be preserved; the current collection view is scoped to its configured
contract, so switching seasons does not automatically display old tokens.

## Profile and process feedback amendment — 8 November 2026

Account settings now support persisted candy NFT profile pictures. Selection
requires the authenticated account, linked verified wallet, current ownership
of the configured collection token and its committed saved artwork. A default
ghost can be restored. No arbitrary image URL/upload, transaction or change to
research consent is part of this flow. Selections are cosmetic and verified at
selection time; ownership checks for NFT actions remain separate.

Loading must distinguish initial fetch, background update, action/signature
waiting, buffering, success, unavailable and genuine empty states. Existing
content remains visible during background refresh. Slow requests receive plain
language guidance, rather than alarming error styling or fake progress. A
network failure is not treated as account expiry. Status checks may retry;
generation, signing and financial actions never retry automatically. See
docs/loading-profile-review-2026-11-08.md for tested coverage and browser limits.

## Social friends amendment — 8 November 2026

Requirements FR-S1 to FR-S7 (section 5.6) are implemented. Players add each other
with a private friend code; the feature is separate from the game, rewards,
research consent and wallets.

Implementation: `scripts/social_store.py` (routes under `/social`, handled by the
existing account router, so every call needs a signed-in session and, for POST,
the website origin and an `Idempotency-Key`). Two private tables, `friend_codes`
and `friendships`, are created at startup. On PostgreSQL both have row-level
security enabled and all access revoked from `PUBLIC`, `anon` and `authenticated`.
A friendship has one row per pair with states pending, accepted or declined; a
declined row is kept only to stop the sender from resending. Unknown-code attempts
reuse the sign-in attempt log for the 10-per-10-minutes limit, and are counted
even though the request fails. Friend, accept, decline, cancel, remove and code-reset
actions write metadata-only audit entries (no code values). The frontend page is
`/social` (`Social.tsx`); a friend's picture reuses the candy profile-picture URL.

Validation on 8 November: 7 new backend tests on a temporary store and the same
cases on a disposable private Supabase schema (8 tests, including the table
privilege check), 4 new frontend tests, type check and production build, and all
four CI jobs. The feature is merged to `main` but was **not deployed** to the
live preview at the time of writing (live backend and frontend were on `342e66e`).
No browser walkthrough of the page was possible, so layout, mobile view and focus
order are unverified.

Limits and open work: no blocking, reporting, notifications or friend profiles;
a declined sender gets a generic "cannot be sent" message, which reveals that a
relationship row exists; friend codes are bearer secrets, so anyone holding one
can send that person a request until it is regenerated.

## Delivery, branches and operations amendment — 8 November 2026

- **Branches.** Pull request #1 (24 commits from `codex/cloud-preview-20261106`) was
  merged into `main` as `d298c48` after all four CI jobs passed. `main` is protected:
  changes need a pull request (zero approvals, since the project has one owner), the
  four CI jobs must pass, and force-push and deletion are blocked. Administrators can
  still bypass the rules. The feature branch is protected against force-push and
  deletion only. The merge did not deploy: the release job is gated by
  `CASPY_CLOUD_RELEASE_ENABLED=false`.
- **Automatic release is still off.** The workflow, project variables and a
  `production` environment exist, but the Vercel deploy token was not set and the
  Codespaces token was not confirmed. Enabling release still requires one complete
  deployed run of wallet, play, grade, image, mint, list, purchase and payout, and
  the seller-payout discrepancy from 5 November remains unresolved.
- **Preview hosting.** The frontend is on Vercel and the API proxy forwards to a
  GitHub Codespaces backend. This is a demo: the Codespace stops after 30 minutes
  idle, and its forwarded port can return to private, which makes the proxy return
  502 or 401. On 8 November the preview was unavailable until the backend was started
  again with the release helper and port 8000 was made public. Only port 8000 is
  public. This amendment does not change the "not 24/7 hosting" limit.
- **Live revisions** at the time of writing: backend `342e66e` (read from the health
  endpoint after the restart); frontend last recorded at `342e66e` and not re-checked
  that day; v3 contracts on Base Sepolia as recorded in the v3 activation notes.
- **README.** The repository README was rewritten to match this PRD (no failure NFT,
  Python standard-library API, Supabase, Bifrost, Base Sepolia preview) and now
  includes a banner, four labelled walkthrough screenshots and the how-to-play video.
  Its images are generated from the app's own artwork by
  `scripts/build_readme_assets.py`. The screenshots use fictional tutorial data and
  show no real win or transaction.
