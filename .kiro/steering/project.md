# Caspy's Prompt Heist — Project Steering

This file gives Kiro the project context it needs when working in this repo.

## Overview

Caspy's Prompt Heist is a skill-based social-engineering game. Players chat with Caspy (a ghost) and get 3 prompts to persuade him. Success mints a rare **Treat** NFT; failure mints a common **Trick** NFT. The full product spec is in #[[file:PRD.md]].

## Golden rule

The LLM may influence the outcome, but **must never hold mint authority.** All value-bearing decisions pass through deterministic, auditable server-side code. Never wire an LLM tool/function to sign, mint, or write `won` to the DB.

## Repo layout

- `frontend/` — Astro + islands UI (wagmi/viem, Reown). SSE chat island.
- `blockhain/` — Solidity + Foundry. `CaspyHeist` ERC-721 with EIP-712 voucher mint.
- `n8n/` — Off-chain notification workflows only (no authority over mints/attempts).
- `bifrost/` — Local clone of maximhq/bifrost (LLM gateway). Excluded from git; do not commit it.

## Tech stack

- Frontend: Astro, React/Solid islands, TypeScript, wagmi, viem, Reown
- API: FastAPI (async), Pydantic v2 for all LLM I/O
- LLM gateway: BiFrost (primary + fallback, budgets, retries)
- DB: Supabase Postgres (RLS on, service-role server-only)
- Cache: Redis (Upstash)
- Signing: Cloud KMS secp256k1
- Chain: Base (default)
- Contracts: Solidity + Foundry, OpenZeppelin ERC-721 + EIP-712

## Conventions

- Server-authoritative state only. The UI must render only server-returned `attempts_remaining` and `status`; never trust client state.
- Mutating API calls require an `Idempotency-Key` header.
- Win decision = separate judge call (temp 0, strict JSON), never Caspy's own text, never a tool call.
- Deterministic post-checks (denylist, embedding similarity, win-rate governor, supply cap) gate every win.
- All prompts/rubrics are versioned and stored per turn.
- Accessibility target: WCAG 2.2 AA.

## Build / dev / test

- Frontend: `cd frontend && npm run dev` (dev), `npm run build` (build)
- Contracts: `cd blockhain && forge build`, `forge test`
- Never run dev servers / watchers from the agent; tell the user to run them manually.

## Secrets

No secrets in the repo. Use `.env.example` as templates; real `.env` files are gitignored. Signer keys live in KMS, never in app env.
