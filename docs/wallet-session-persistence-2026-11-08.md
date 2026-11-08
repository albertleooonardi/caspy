# Wallet session persistence — 8 November 2026

Wallet sign-in previously stored its six-hour proof only in the API process.
Codespaces shutdown erased it while the separate account session remained in
Supabase. The UI correctly refused to trust a remembered wallet address alone.

Runtime NFT startup now binds the wallet authenticator to the application's
Supabase adapter. `caspy.wallet_sessions` stores SHA-256 token digests, verified
addresses, absolute expiry and a chain/contract/deployment scope. Raw bearer
tokens, signatures and private keys are not stored. The table has RLS enabled
and grants revoked from PUBLIC, anon and authenticated. Challenges remain
short-lived and in memory; an interrupted signature flow must be restarted.

An unexpired HttpOnly cookie can restore wallet authentication after an API
restart. Six-hour expiry remains; refresh does not extend it. Wallet disconnect
and account logout revoke the database session. A fresh successful signature
rotates the token and revokes its predecessor. Existing account/wallet ownership
checks remain enforced. In-memory sessions lost before this release cannot be
recovered; connect and sign once after deployment. Email/password sign-in alone
does not prove wallet ownership or recreate a revoked wallet session.

Checks: four isolated persistence/security tests; five real PostgreSQL tests
in disposable private Supabase schemas, including table permissions; 15 game
tests; three isolated HTTP account/authorization tests; three disposable Anvil
NFT integration tests passed (one optional live-AI case skipped). No public-chain
transaction or player heist was created by these tests.

This fixes persistence, not backend availability. GitHub Codespaces cannot be
made an always-on server: idle timeout is at most four hours and the documented
maximum lifetime is 12 hours. No keepalive loop or quota-bypass workflow is added.
Continuous hosting requires another backend host or a continuously running
user-managed machine. See GitHub's lifecycle documentation:
https://docs.github.com/en/codespaces/about-codespaces/understanding-the-codespace-lifecycle
