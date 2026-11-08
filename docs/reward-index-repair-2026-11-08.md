# Migrated wallet index repair — 8 November 2026

The live v3 reward insert was blocked by the old standalone unique index
`caspy.candy_jobs_migrated_0(namespace,wallet)`. The earlier v3 migration removed
only the native constraint `candy_jobs_namespace_wallet_key`; it did not cover
the SQLite-to-PostgreSQL migration's index naming. The generic integrity-error
handler incorrectly described this as an existing reward for the same heist.

Startup now inspects PostgreSQL index key columns and removes only unique,
non-primary, non-expression, non-partial keys on exactly namespace and wallet,
handling both constraint-backed and standalone indexes. Identifiers are quoted.
The heist primary key and unrelated indexes remain; no reward, grade, artwork,
account or snapshot is deleted. Legacy v2 keeps its explicit server wallet gate.
Unexpected integrity failures now say reservation is temporarily unavailable,
without falsely claiming a duplicate heist reward.

Verification: real disposable-Supabase fixture with both old index forms and an
unrelated wallet lookup index passed. Existing reward assessment stayed equal;
a second reward for the same wallet succeeded; primary key and unrelated index
survived. All 12 candy-store regressions passed. This repair does not generate an
image or submit a mint transaction.
