# Multiple candies per wallet — 8 November 2026

Requested behavior: separate eligible winning heists can reward the same wallet
multiple times. Each heist still has one entitlement, one immutable assessment
and one mint. Losses receive nothing. Supply remains 1,000 per deployed season;
image budgets, consent and replay permissions are unchanged.

The source contract is now v3, with EIP-712 domain version 3. The wallet's
`mintedWallet` flag remains a historical indicator for ABI compatibility; it no
longer blocks minting. `usedSessions`, signed recipient/grade/content commitments,
expiry, supply, pause and signer role checks remain enforced. The bridge reads
the deployed version and supports v2's original gate/domain and v3's new policy.

The PostgreSQL migration drops only the old automatically named
`candy_jobs_namespace_wallet_key` constraint. Existing rows and the per-heist
primary key are retained. Legacy v2 deployments retain an explicit wallet gate
because their immutable contract would reject a second mint. Reward status text
now distinguishes a saved win from an actually reserved candy.

Verification: 14 Solidity tests (including fuzz coverage), 12 candy-store cases,
four disposable Anvil integration cases (one separate opt-in AI case skipped),
one live disposable-Supabase migration case, 27 frontend tests, type checks and
production build passed. The integration minted two different winning-heist
candies to one fixture wallet and rejected replay. No public-chain transaction
was submitted. UI changes add no new effects or background requests; deployment
remains an explicit user action and refreshes public artifacts without caching.

## Activation boundary

The existing Base Sepolia candy and marketplace contracts remain v2 and cannot
be upgraded in place. `/deploy-testnet` prepares v3 artifacts using the existing
voucher signer. The operator must approve two new Base Sepolia deployments and
download their public configuration before the server/frontend can switch to
the new season. Never overwrite the active config with unconfirmed addresses.

Old tokens, old rewards and old marketplace contracts remain intact. The current
UI is contract-scoped; switching to v3 will not automatically show v2 tokens or
move old listings. Preserve the old public config and database namespace for
recovery. Migrating old winning heists or aggregating old collections is separate
work and must not silently generate duplicate entitlements.
