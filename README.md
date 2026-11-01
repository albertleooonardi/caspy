# Caspy's Prompt Heist 👻🍬

> Meet Caspy! This adorable AI ghost is guarding rare Web3 candy. You have three chances to use your prompt engineering tricks to convince his LLM brain to yield. Outsmart him to earn a sweet **Treat** NFT minted to your wallet, or fail and get a cursed **Trick** NFT! A cozy Halloween prompt heist built with Astro.js and Bifrost.

## What is it?

Caspy's Prompt Heist is a skill-based social-engineering game. Players chat with **Caspy**, a stubborn ghost guarding a candy basket. They get **3 prompts** to persuade him. Success mints a rare **Treat** NFT; failure mints a common **Trick** NFT.

The product is, by design, an adversarial prompt-injection target with real on-chain consequences. The central engineering principle: **the LLM may influence the outcome, but must never hold mint authority.** All value-bearing decisions pass through deterministic, auditable server-side code.

## How it works

1. Connect wallet and sign a SIWE (EIP-4361) message to prove ownership.
2. The server creates a session (one per wallet per season) with 3 attempts.
3. The player submits a prompt; the server atomically decrements attempts **before** calling the LLM.
4. Caspy replies (streamed). A separate **judge** returns a structured verdict.
5. On a `YIELD` verdict, the session closes as won and the server issues a signed mint voucher for a **Treat**.
6. After 3 attempts without a win, the session closes as lost and the server issues a **Trick** voucher.
7. The player (or relayer) submits the voucher on-chain; the indexer updates the DB.

The win decision is made by a **separate judge call** — never by Caspy's own text and never by a tool call from Caspy. No agent has tools in v1, so prompt injection can never directly trigger a value-bearing action.

## Tech stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Frontend | Astro + React/Solid islands | SSE chat island; wagmi + viem; Reown |
| API | FastAPI (async) | Pydantic v2 models for all LLM I/O |
| LLM gateway | BiFrost | Primary + fallback, budgets, retries, per-key spend caps |
| Database | Supabase Postgres | RLS enabled; service-role key server-only |
| Cache / limits | Redis (Upstash) | Sliding-window limits, distributed locks |
| Signing | Cloud KMS (secp256k1) | Key never in app env |
| Chain | Base (default) | Cheap gas, wide wallet support |
| Contracts | Solidity + Foundry, OpenZeppelin ERC-721 + EIP-712 | |
| Workflows | n8n | Off-chain notifications only; no authority |
| Observability | OpenTelemetry, Langfuse/Helicone, Sentry, Grafana | |

## Project structure

```
caspy/
├── .kiro/            # Kiro config, steering, and hooks (tracked)
├── frontend/         # Astro + islands frontend (wagmi/viem)
├── blockhain/        # Solidity + Foundry: CaspyHeist ERC-721 contract
├── n8n/              # Off-chain notification workflows
├── PRD.md            # Product requirements document
└── README.md         # You are here
```

> `bifrost/` is the third-party [maximhq/bifrost](https://github.com/maximhq/bifrost) LLM gateway, kept as a local clone (it is the stack the API uses). It is intentionally excluded from this repo via `.gitignore`.

## Getting started

### Prerequisites

- Node.js (LTS)
- A wallet (MetaMask, Rabby, or any WalletConnect-compatible wallet)

### Frontend (Astro)

```bash
cd frontend
cp .env.example .env   # fill in values
npm install
npm run dev
```

### LLM gateway (Bifrost)

```bash
python3 scripts/bifrost_setup.py init
# Fill OPEN_ROUTER_API_KEY in the root .env; configured models are free.
python3 scripts/bifrost_setup.py check
bash run-bifrost.sh
```

The gateway runs at <http://127.0.0.1:8080> with separate actor/judge virtual
keys, free fallback routes, and shared OpenRouter budgets. See [the Bifrost guide](docs/bifrost.md)
for credentials, smoke tests, configuration updates, and current integration gaps.

### Smart contracts (Foundry)

```bash
cd blockhain
forge build
forge test
```

## Security model

- **No LLM tools / authority in v1.** Tool-calling `grant_treat()` is rejected because it lets prompt injection directly trigger a value-bearing action.
- Mints are authorized by **EIP-712 signed vouchers** from a backend signer; the contract verifies the signature. The backend never holds a hot wallet with mint rights.
- Deterministic post-checks (denylist, embedding similarity, win-rate governor, supply cap) gate every win.
- The signer is reachable only from the API's `finalize_session` code path.

See [`PRD.md`](./PRD.md) for the full specification, threat model, and rollout plan.

## Disclaimer

NFTs have no promised financial value. This is a free-to-play, skill-based game; gas fees only.
