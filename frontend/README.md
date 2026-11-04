# Caspy’s Prompt Heist — frontend

Astro, React, TypeScript, and viem. Built from the supplied PRD and Caspy artwork, with responsive desktop/mobile layouts.

## Run locally

```sh
npm install
npm run dev
```

Open http://localhost:4321. `npm run build` outputs the static site to `dist/`; `npm run preview` serves the production build.

## Accounts and research

The launcher connects the local account API automatically. Register at `/register`,
sign in at `/login`, manage contributions at `/account`, create/review campaigns
at `/research`, and request/download licensed datasets at `/datasets`. Account
sessions and permissions are enforced by the server. See
[the platform guide](../docs/platform.md) for the complete opt-in workflow.

## Screens

- `/` — landing, how to play, collectibles, FAQ
- `/play` — streaming chat, three candy attempt counters, 500-character limit
- `/how-to-play` — 100-second kinetic typography film, interactive chapters, player/researcher guides, and a knowledge check
- `/result` — Treat, Trick, pending-review, and unavailable states
- `/claim` — approval, pending, confirmed, retry, and transaction explorer states
- `/gallery` — season-locked Wall of Heists with optional, clearly labeled illustrative examples and filters
- `/rules`, `/privacy`, `/terms` — gameplay FAQ and frontend-preview disclosures

## Demo mode

For the full **local NFT game**, run `bash run.sh` from the root.
Connect the local test wallet, play against the Bifrost actor/judge, then mint
the server-confirmed result on Anvil (31337). The launcher provides
`PUBLIC_NFT_ENABLED=true`, `PUBLIC_CONTRACT_ADDRESS` and `PUBLIC_NFT_SEASON` to
Astro. No browser extension or private key is needed. See
[the local NFT guide](../docs/nft-local.md).

For AI-only gameplay without NFT claims, run `bash run.sh --ai-only`
from the repository root. Or run `python3 scripts/heist_api.py` from the root
alongside Bifrost, set `PUBLIC_LOCAL_AI=true` in `frontend/.env`, and restart
`npm run dev`. The same-origin `/api` development proxy connects to port 8000.
Local AI mode skips wallet authentication and disables all claims. It stores
sessions in API memory for up to six hours; the provider receives your prompts
and Bifrost can retain logs. Use the dev server, since the static build/preview
does not provide this development proxy. Unset the flag for the modes below.

No configuration is required. Without `PUBLIC_API_URL`, the app uses a **scripted, browser-local demo**. Start a demo heist and send three prompts. Select Treat or Trick before the first prompt to preview either outcome. Claiming is simulated: no signatures, transactions, NFTs, live AI, or actual wallet connection occur. Reloading restores the demo session. Use Privacy → Clear my demo data to remove it.

The supplied `logo-transparent.png` is copied to `public/images/logo-transparent.png` and used in the header, footer, hero, game, and Treat result. The existing `logo.jpg` is used for the collectible preview and sharing metadata. Originals outside this directory are untouched.

## Backend integration

Copy `.env.example` to `.env` and configure `PUBLIC_API_URL` plus `PUBLIC_CONTRACT_ADDRESS`. These are public frontend values; never put signer keys or service secrets here. Rebuild after changing them.

The live adapter uses cookie credentials and idempotency keys. The backend must allow this frontend origin with credentialed CORS and provide the PRD's server-side auth, game, judge, voucher, and mint status services. Enforce all eligibility, attempt limits, opt-in records, and results on the server.

Expected payloads:

- `POST /auth/nonce` receives `{address, chain_id}`, returns `{nonce}`.
- `POST /auth/verify` receives `{message, signature}`, sets the session cookie.
- `POST /game/session` receives `{public_opt_in}`, returns a `Session`.
- `GET /game/session/{id}` returns `{id, status, attempts_remaining, messages, minted?, tx_hash?}`. `messages` is an array of `{role: "user" | "caspy", text}`.
- `POST /game/turn` receives `{session_id, prompt}` and streams JSON SSE events: `token` with `{token}`, then `final` with `{attempts_remaining, status}`. `delta`/`done` aliases are also supported. SSE comments and fragmented Unicode are supported. After streaming, session state is fetched again. An interrupted stream triggers recovery instead of inventing a result.
- `POST /game/voucher` receives `{session_id}`, returns the signed voucher defined in `src/lib/wallet.ts`.
- `GET /mint/status/{id}` returns `{status, tx_hash?, minted?}`. Status `confirmed` completes the claim; `failed` permits retry.

`wallet.ts` supports SIWE and the contract's six-argument `mintWithVoucher`
function using the shared ABI in `src/lib/contract.ts`. Local NFT mode uses
Anvil's unlocked third test account; the existing external-backend mode uses
an injected wallet on Base. The configured chain, contract, recipient, tier
and expiry are checked and the mint is simulated before submission. Only
server-confirmed session outcomes expose a claim. Local confirmation checks
the contract event and displays the token ID, with no Base explorer link.

Not implemented in this frontend-only scope: FastAPI/Postgres/Redis, AI actor and judge, on-chain contract deployment, indexing, Turnstile, WalletConnect mobile QR/deep links, ERC-1271 backend verification, ENS resolution, real season/supply data, server-generated OG cards, or finalized live legal/operator details. The UI documents browser-wallet support without claiming those integrations exist.

## Verification

```sh
npm run check
npm test
npm run build
```

Tests cover multiline SSE, CRLF framing, split UTF-8, interrupted streams, invalid server attempt counts, and both full three-turn demo outcomes with persisted transcripts. Desktop presentation was inspected in Safari. Mobile breakpoints and the full browser click-through still need browser verification. Layouts include keyboard focus styles, semantic controls, native dialog focus management, disclosure labels, and reduced-motion support. Performance and accessibility targets from the PRD still need a production audit with the live integrations.

## Animated walkthrough

The homepage and `/how-to-play` use a 100-second, 1600×900, 30 fps H.264/AAC
film with ten chapters. Large kinetic typography, swipe reveals, illustrated
workflow cards, floating Caspy artwork, bat silhouettes, drifting stars and candy
counters guide accounts, consent, prompts, judging, results, local NFT claims
and the research workspace. It is an illustrated walkthrough, not a recording
of a real account, AI evaluation, purchase or mint.

Audio is an original Halloween score with bells, organ, wind and a synthesized
wordless ghost choir. There is **no narration or spoken voiceover**. The player
starts muted and does not autoplay; use its sound button to enable the score.

Interactive controls include chapter seeking, previous/next, replay, chapter
looping, playback speed, native fullscreen/captions, and contextual action links.
The full guide offers player/researcher routes, replay links from written steps,
and a three-question local knowledge check. Quiz answers stay in component state
and are never submitted. Reduced-motion preferences are respected by page
animations and chapter scrolling; video only plays on a user action.

`src/lib/walkthrough.json` is the shared storyboard and timing source for the
renderer, player, captions and tests. Website media use `public/videos/caspy-showcase*`
with a new cache version. Original `caspy-walkthrough*` media remain for older
links. See [the animation guide](../docs/animated-walkthrough.md) to regenerate
and verify the motion film and music-only soundtrack.
