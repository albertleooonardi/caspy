# Supabase database

Caspy now requires server-side PostgreSQL at runtime. `SUPABASE_DB_URL` belongs
in the ignored root `.env`; it must never use a `PUBLIC_` name or be copied into
frontend configuration. This is a database migration, not a switch to Supabase
Auth: existing Caspy passwords, sessions and account/workspace authorization stay
with the application. NFT chain state and candy artwork files remain local.

## Start

```sh
./run.sh
```

The launcher installs the pinned Psycopg driver in `.venv` if needed and checks
all three database connections before starting services. It refuses missing
Supabase configuration or Bifrost stores that would recreate SQLite. No automatic
fallback to a file database is allowed. Stop an earlier launcher before starting.

## Private schemas

- `caspy`: accounts, sessions, linked wallets, research permissions/data and candy
  jobs. Browser/API Supabase roles have no schema access. Application tables have
  row-level security enabled; the server uses the configured database connection
  and continues enforcing account/organization ownership.
- `caspy_bifrost_config`: migrated Bifrost configuration, routing and governance.
- `caspy_bifrost_logs`: migrated Bifrost request logs.
- `caspy_archive`: lossless JSONB recovery snapshots of every legacy SQLite
  database, including old pre-QA copies. Not exposed through the browser API.

Bifrost gets separate login roles, each with its own schema/search path. Their
server-only credentials are generated into `CASPY_BF_CONFIG_*` and
`CASPY_BF_LOGS_*` in `.env`. Do not change these schemas to the Supabase public
schema or grant access to `anon` / `authenticated`.

Connections require TLS. The root administrative database URL currently performs
Caspy application operations; a production rollout should provision a narrower
application-only database role with separately managed migration privileges.
Psycopg prepared statements are disabled for pooler compatibility. A database
transaction advisory lock preserves the local application's serialized read/write
quota checks across API processes; this is conservative, not a throughput claim.

## Migration and recovery

Run the migration only with Caspy and Bifrost stopped:

```sh
.venv/bin/python scripts/migrate_supabase.py
.venv/bin/python scripts/migrate_supabase.py --apply
```

The first command inventories files. Applying first creates lossless, hashed
archives, then imports native PostgreSQL tables, indices, keys and identity
sequences. SQLite/GORM booleans, timestamps and quoted defaults are converted.
Every native table's row count/content digest is verified. Existing target data
is compared on retries rather than overwritten. The tool refuses unexpected
schemas or snapshots and never prints connection URLs or row bodies.

`data/supabase-migration-state.json` retains private role credentials needed for
an interrupted migration. `data/supabase-migration-report.json` records counts and
hashes. `data/supabase-migration-recovery.json` is a private non-SQLite recovery
export, in addition to the verified remote snapshots. All are ignored by Git;
the recovery/state files contain sensitive data and must remain private.

After verification, `--apply --delete-sqlite` rechecks quiescence and source
hashes before removing original database files and their WAL/SHM sidecars.
Never delete files manually to fix a failed migration. Migration snapshots are
recovery material, not live tables and not an automatically synchronized backup.
Configure scheduled Supabase backups and test restoration separately.

## Validation

Adapter units and the existing regression tests remain available. SQLite is
supported only when a test explicitly passes a disposable file path; the runtime
API always requires `SUPABASE_DB_URL`.

For real PostgreSQL regression using fictional data in disposable private schemas:

```sh
CASPY_RUN_SUPABASE_TESTS=1 CASPY_RUN_HTTP_TESTS=1 \
  .venv/bin/python -m unittest discover -s scripts -p 'test_supabase.py' -v
```

These tests remove only their generated `caspy_test_*` schemas. They do not use
or delete the live `caspy` schema or call AI, image or blockchain providers.
`check_supabase.py` is a read-only connection/schema preflight, not an end-to-end
Bifrost startup certification. A post-migration launcher run is still needed to
verify the pinned Bifrost runtime against the imported gateway schema.

## Completed checkpoint — 4 November 2026

The three active databases were imported into the private live schemas and
verified table by table. Five legacy databases (including two old pre-QA copies)
were preserved in lossless private JSONB archives: **39,776 archived rows** in
total. The active imports contain **98 tables** across Caspy and both gateway
stores; exact counts/digests are in the private migration report.

Validation passed across 25 live PostgreSQL regression cases (9 candy tests and
16 account/research/HTTP tests), 3 adapter unit checks, 4 migration safeguard
checks, 13 Bifrost setup checks, and existing local store/candy regressions.
Browser database roles cannot use the private schemas; application table RLS
and separation between dedicated gateway roles were checked. All three
connection preflights passed.

The migration sets full floating-point output precision (`extra_float_digits=3`)
so pricing values verify exactly. It also provisions the gateway's PostgreSQL-only
`bifrost_safe_jsonb` helper: SQLite had recorded the same migration as a no-op.
The application uses an explicit insertion sequence for review ordering instead
of SQLite's hidden rowid.

This checkpoint verifies migration/data and database-backed functionality. The
agent did not restart user-managed development servers; run `./run.sh` to perform
the first full gateway/frontend startup against the migrated schemas.

Final cleanup verified: the five original SQLite databases and their WAL/SHM
sidecars were removed. A fresh header scan found **zero SQLite database files
under `data/`**. The native imports contain **19,980 live rows in 98 tables**;
SQLite internal sequence metadata is preserved in archives rather than copied
as an application table. All three read-only database preflights passed again
after deletion. Private recovery JSON/state/report files have mode 0600.
