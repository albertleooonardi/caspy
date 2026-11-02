# Caspy’s Prompt Heist — frontend

Astro, React, TypeScript, and viem. Built from the supplied PRD and Caspy artwork, with responsive desktop/mobile layouts.

## Run locally

```sh
npm install
npm run dev
```

Open http://localhost:4321. `npm run build` outputs the static site to `dist/`; `npm run preview` serves the production build.

## Screens

- `/` — landing, how to play, collectibles, FAQ
- `/play` — streaming chat, three candy attempt counters, 500-character limit
- `/how-to-play` — 56-second animated, narrated demo explainer, chapter links, and written instructions
- `/result` — Treat, Trick, pending-review, and unavailable states
- `/claim` — approval, pending, confirmed, retry, and transaction explorer states
- `/gallery` — season-locked Wall of Heists with optional, clearly labeled illustrative examples and filters
- `/rules`, `/privacy`, `/terms` — gameplay FAQ and frontend-preview disclosures

## Demo mode

For actual AI responses through the local Bifrost gateway, run `bash run-heist.sh`
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

`wallet.ts` provides injected browser-wallet sign-in through SIWE, Base network switching, and a voucher claim adapter. **Validate the tuple fields and Solidity types against the final deployed contract ABI before enabling live claims**; the PRD doesn't supply an audited ABI. The configured contract address and connected recipient are checked before requesting a transaction. Only server-confirmed session outcomes expose a claim.

Not implemented in this frontend-only scope: FastAPI/Postgres/Redis, AI actor and judge, on-chain contract deployment, indexing, Turnstile, WalletConnect mobile QR/deep links, ERC-1271 backend verification, ENS resolution, real season/supply data, server-generated OG cards, or finalized live legal/operator details. The UI documents browser-wallet support without claiming those integrations exist.

## Verification

```sh
npm run check
npm test
npm run build
```

Tests cover multiline SSE, CRLF framing, split UTF-8, interrupted streams, invalid server attempt counts, and both full three-turn demo outcomes with persisted transcripts. Desktop presentation was inspected in Safari. Mobile breakpoints and the full browser click-through still need browser verification. Layouts include keyboard focus styles, semantic controls, native dialog focus management, disclosure labels, and reduced-motion support. Performance and accessibility targets from the PRD still need a production audit with the live integrations.

## Animated walkthrough

The homepage includes the tutorial video, and the navigation and play screen link
to `/how-to-play`. The guide has native video controls, chapter shortcuts, English
WebVTT captions, a poster, a download link, and a written alternative. It does not
autoplay. The animated explainer combines Caspy artwork, motion graphics, and recorded
demo UI. It includes energetic English narration, an original Halloween soundtrack,
typed chat bubbles, candy counters,
cursor highlights, and smooth transitions. It does not demonstrate live AI,
wallet authorization, or real minting.

The 56-second, 24 fps H.264/AAC showcase and related assets use the
`caspy-showcase` prefix in `public/videos/` (about 16.8 MB total). Instructions
are also burned into the video, with a WebVTT caption track and a written guide.
The original `caspy-walkthrough` files remain for existing download links.
Update the video and its seven chapter times together when gameplay changes.

The Halloween audio edit uses a brighter Eddy voice, celesta/bell arpeggios,
soft organ and bass, and airy textures. Automatic music ducking keeps narration
clear. The video keeps its 56-second animation, captions, and chapter timing.
