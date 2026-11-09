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
