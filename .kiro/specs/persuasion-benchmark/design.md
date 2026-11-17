# Design: Caspy Bench — Persuasion Benchmark & Red-Team Evaluation

## Overview

Bench is a new store module beside the existing research platform. It reads
approved samples, copies them into frozen evaluation sets, replays them through
the Bifrost gateway on a dedicated virtual key, and stores per-item results and
aggregate metrics. It follows the patterns already used by `candy_store.py` and
`social_store.py`: one class, tables created at startup, a single-worker thread
pool, and routes dispatched from `heist_api.py`.

Requirements are in [requirements.md](requirements.md).

## Architecture

```
            Research UI (PlatformPages.tsx, "Benchmarks" tab)
                              |
                       heist_api.py routes
                              |
   platform_store.py  <--  benchmark_store.py  -->  benchmark_metrics.py (pure)
   (samples, consent,        |        |
    orders, audit)           |        +--> BenchmarkRunner (1 worker thread)
                             |                    |
                       Postgres / SQLite     Bifrost gateway, key `vk-bench`
                                                  |
                                       allowlisted candidate routes
```

### New and changed files

| File | Change |
| --- | --- |
| `scripts/benchmark_store.py` | New. Evaluation sets, runs, results, access checks |
| `scripts/benchmark_metrics.py` | New. Pure functions: agreement, kappa, Wilson interval, confusion matrix |
| `scripts/platform_store.py` | Notice v2 constant and acceptance; withdrawal and purge call into Bench; `orders` gains an item kind |
| `scripts/heist_api.py` | Routes under `/research/benchmarks`; gateway call with `vk-bench` |
| `scripts/runtime_config.py` | `CASPY_BENCH_ENABLED`, `CASPY_BENCH_DAILY_LIMIT`, `CASPY_BENCH_RUNS_PER_DAY`, `CASPY_BENCH_MODELS_JSON` |
| `bifrost.config.example.json`, `scripts/bifrost_setup.py` | New virtual key `vk-bench`, budget and rate limit, candidate routes |
| `frontend/src/components/PlatformPages.tsx` | Benchmarks tab, run confirmation, report view; notice v2 text |
| `frontend/src/components/App.tsx` | Consent text for notice v2 and provider list |
| `scripts/test_benchmark_store.py`, `scripts/test_benchmark_metrics.py` | New tests |

## Data model

All tables are created by `BenchmarkStore.__init__`. On Postgres, row-level
security is enabled and access revoked from `anon` and `authenticated`, as for
`profiles` and `candy_blobs`.

```sql
CREATE TABLE IF NOT EXISTS eval_sets(
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
  title TEXT NOT NULL, purpose TEXT NOT NULL, version INTEGER NOT NULL,
  rubric_hash TEXT NOT NULL, actor_hash TEXT NOT NULL, rubric TEXT NOT NULL,
  dropped_duplicates INTEGER NOT NULL, dropped_capped INTEGER NOT NULL,
  listed INTEGER NOT NULL DEFAULT 0, license TEXT, price_cents INTEGER,
  created INTEGER NOT NULL, UNIQUE(org_id,title,version));

CREATE TABLE IF NOT EXISTS eval_items(
  id TEXT PRIMARY KEY, set_id TEXT NOT NULL REFERENCES eval_sets(id),
  sample_id TEXT NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL, reply TEXT NOT NULL, turn INTEGER NOT NULL,
  gold_verdict TEXT NOT NULL, test_kind TEXT NOT NULL, safety_label TEXT,
  strategy TEXT, providers TEXT NOT NULL, raters INTEGER NOT NULL DEFAULT 1,
  raters_agree INTEGER, UNIQUE(set_id,sample_id));

CREATE TABLE IF NOT EXISTS bench_runs(
  id TEXT PRIMARY KEY, set_id TEXT NOT NULL REFERENCES eval_sets(id),
  org_id TEXT NOT NULL, track TEXT NOT NULL, model_id TEXT NOT NULL,
  provider TEXT NOT NULL, state TEXT NOT NULL, reason TEXT,
  item_count INTEGER NOT NULL, withdrawn_after INTEGER NOT NULL DEFAULT 0,
  metrics TEXT, created INTEGER NOT NULL, finished INTEGER);

CREATE TABLE IF NOT EXISTS bench_results(
  run_id TEXT NOT NULL REFERENCES bench_runs(id),
  item_id TEXT NOT NULL REFERENCES eval_items(id) ON DELETE CASCADE,
  state TEXT NOT NULL, verdict TEXT, confidence REAL, category TEXT,
  exploit_flag INTEGER, served_model TEXT, latency_ms INTEGER,
  output TEXT, created INTEGER NOT NULL, PRIMARY KEY(run_id,item_id));

CREATE TABLE IF NOT EXISTS bench_calls(run_id TEXT NOT NULL, created INTEGER NOT NULL);
```

Notes:

- `eval_items` copies the reviewed text so a later edit to a sample cannot change
  a published set (Requirement 1.3). The foreign key with `ON DELETE CASCADE`
  makes withdrawal and retention purges remove items and results automatically
  (Requirement 7.1, 7.4); `platform_store` already deletes `samples` rows on
  withdrawal and purge.
- `eval_items.providers` is the JSON list of providers named in the notice the
  contributor accepted (Requirement 2.5).
- `bench_results.state` is one of `valid`, `invalid`, `error`. `output` holds the
  candidate reply for the target track only; judge-track free-form reasons are
  not stored (Requirement 8.3).
- `bench_runs.state` is one of `queued`, `running`, `paused`, `completed`,
  `cancelled`. `metrics` is the JSON aggregate written at completion, so a report
  survives later item deletion (Requirement 7.2).
- `bench_calls` is the daily budget ledger, the same approach as `candy_attempts`.
- Second-reviewer labels (Requirement 10) need a `sample_labels(sample_id,
  reviewer_id, …)` table. It is added in phase 2 with workspace membership; until
  then every item has `raters=1`.

### Consent changes

- `NOTICE` becomes `caspy-research-2026-11-v2`. `associate_game` accepts only the
  current notice for new contributions; rows already stored keep `v1`.
- The consent request body gains `providers`, echoed from `GET /campaigns`, and it
  is stored with the contribution so the accepted provider list is provable.
  This needs one new nullable column, `contributions.providers`.
- Eligibility for a set is
  `contributions.notice = v2 AND research = 1 AND withdrawn = 0`, plus
  `commercial = 1` when the set is listed.

## Components

### BenchmarkStore

```python
class BenchmarkStore:
    def __init__(self, platform, gateway, models, enabled, daily_limit, runs_per_day)
    def models(self)                         # allowlist for the UI, with providers
    def create_set(self, user, body)         # filter, dedupe, cap, freeze
    def sets(self, user)                     # own workspace + granted
    def start_run(self, user, body)          # validates, returns estimate or queues
    def resume_run(self, user, ident)
    def cancel_run(self, user, ident)
    def report(self, user, ident)            # aggregates only
    def export_set(self, user, ident)        # grant + consent checked per request
    def list_set(self, user, ident, body)    # catalog listing
    def handle(self, handler, body=None)     # route dispatch, as platform_store
```

Authorization reuses `Platform.researcher(user)` and compares `org_id` on every
read and write. A missing or foreign object returns 404, not 403, so identifiers
cannot be probed.

**Freezing a set** (`create_set`), in one transaction:

1. Select eligible samples for the workspace and campaign.
2. Drop exact duplicates on the existing `normalized()` prompt form; keep the
   earliest.
3. Cap items per contributor at 5, by `contributions.user_id`. The user id is
   used only for the cap and is not stored on the item.
4. Refuse if fewer than 30 remain.
5. Insert the set with the next version for that title, then the item copies.
6. Write an audit event.

### BenchmarkRunner

A `ThreadPoolExecutor(max_workers=1)` owned by the store, mirroring `CandyStore`.
One worker gives the "one call at a time" guarantee (Requirement 6.3) and suits a
single Render instance.

```
start/resume -> state=running -> for each item without a result:
    check feature flag, run state, daily budget   (else pause and stop)
    skip if item no longer exists or provider not in item.providers
    insert bench_calls row, call gateway with vk-bench
    validate output -> insert bench_results (valid | invalid | error)
-> all items terminal -> compute metrics -> state=completed
```

- Each result is committed on its own, so a restart loses at most one call.
- At startup, `running` and `queued` runs are set to `paused` with reason
  "server restarted" (Requirement 6.5). Nothing restarts automatically, matching
  the candy store rule of never silently repeating a provider request.
- `error` results are deleted on resume so those items are retried; `valid` and
  `invalid` are kept (Requirement 4.5).
- Schema-invalid output is retried once within the same item, then stored as
  `invalid`.

### Gateway call

`heist_api.py` already wraps Bifrost in `call(key, messages, …)` with an
`x-bf-vk` header. Bench adds a `benchmark(model_route, messages)` method that
uses `vk-bench` and passes the candidate route. The judge-track message list is
built by the same function the live judge uses, with the rubric taken from the
evaluation set instead of the live configuration, so a later rubric change does
not alter an existing set (Requirement 4.7). Temperature is fixed at 0 and the
output limit matches the live judge.

Candidate output is parsed with the live judge's validator. It is never executed,
rendered as HTML or fed back into another prompt.

### Metrics (`benchmark_metrics.py`)

Pure functions over a list of `(gold, verdict, state, test_kind, strategy,
latency_ms)` tuples, with no database access, so they can be unit-tested against
hand-computed fixtures.

- `wilson(successes, n)` returns `(low, high)`; `n < 30` returns
  `{"available": false, "n": n}`.
- `kappa(matrix)` for the 2×2 `YIELD`/`NO_YIELD` table; returns unavailable when
  one marginal is zero.
- `summarize(rows)` returns the JSON stored in `bench_runs.metrics` and shown in
  reports. Every rate is `{"numerator", "denominator", "rate", "low", "high"}`.

### API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/research/benchmarks` | Feature state, model allowlist, own sets and runs |
| POST | `/research/benchmarks/sets` | Freeze a new evaluation set or version |
| POST | `/research/benchmarks/sets/{id}/list` | List or unlist in the catalog |
| GET | `/research/benchmarks/sets/{id}/export` | Owner or granted buyer export |
| POST | `/research/benchmarks/runs` | Estimate (`confirm` absent) or start (`confirm: true`) |
| POST | `/research/benchmarks/runs/{id}/resume`, `/cancel` | Control a run |
| GET | `/research/benchmarks/runs/{id}` | Report (aggregates only) |

Catalog requests and decisions reuse `/datasets/{id}/request` and
`/research/orders/{id}/decision`. `orders` gains a `kind` column
(`release` | `eval_set` | `report`, default `release`) so existing rows and code
paths are unchanged.

All mutating routes keep the existing origin check and session requirement.

### Frontend

A "Benchmarks" tab in the research workspace page:

1. **Sets** — table of versions with counts; "Freeze new set" form showing how
   many samples qualify and why others were excluded (notice v1, not approved,
   no verdict, duplicate, capped).
2. **Run** — choose set, track and models; a confirmation step states the number
   of calls and which providers will receive the text.
3. **Report** — metric cards with numerator/denominator and interval, a confusion
   matrix, a strategy table, side-by-side comparison for runs on the same set
   version, and the limitations block. "Insufficient data" replaces any rate with
   a small denominator.

The consent panel in `App.tsx` shows notice v2 text and the provider list from
`GET /campaigns`.

## Error handling

| Condition | Behaviour |
| --- | --- |
| Feature disabled or allowlist empty | `GET /research/benchmarks` returns `enabled: false`; mutating routes return 503 |
| Model not allowlisted | 400, no gateway call |
| Fewer than 30 eligible items | 409 with the shortfall |
| Daily budget reached | Run `paused`, reason shown; resumes on request next day |
| Provider 429 or 5xx | Item `error`; after 5 consecutive errors the run pauses |
| Schema-invalid candidate output | One retry, then `invalid` |
| Item deleted mid-run | Skipped; `withdrawn_after` incremented if the run had finished |
| Export without current grant or with lapsed consent | 404; lapsed items omitted |

## Security and privacy

- Workspace users cannot supply keys, URLs or model names (Requirement 3.3).
- `vk-bench` has its own budget and a lower rate limit than `vk-judge`; the live
  game cannot be starved by a run (Requirement 6.1).
- Reports and report exports contain aggregates only. Set exports contain
  reviewed text and labels with release-specific pseudonyms, never user, wallet,
  session or raw sample identifiers.
- Audit events are metadata-only, as today.
- Evaluation items are attacker-influenced text. They are sent only inside the
  delimited judge contract and their effect on a candidate is the thing being
  measured, not a trusted instruction.

## Testing strategy

- **Metrics:** fixtures with hand-computed agreement, kappa and Wilson bounds;
  boundary at `n = 29` and `n = 30`; all-one-class input.
- **Store:** eligibility filter (v1 excluded, withdrawn excluded, unapproved
  excluded), dedupe, per-contributor cap, immutability, versioning, cross-workspace
  404, withdrawal cascade, purge cascade, minimum-size lock.
- **Runner:** fake gateway returning valid, invalid, error and timeout; resume
  repeats only `error` items; restart marks runs paused; budget pause; cancel;
  provider-not-consented skip; one call per item.
- **HTTP:** authentication, origin check, feature flag off, estimate-then-confirm.
- **Regression:** existing research, consent and export tests pass with notice v2;
  a v1 contribution still exports in existing releases.

No test calls a real provider.

## Decisions and alternatives

| Decision | Alternative considered | Reason |
| --- | --- | --- |
| Copy text into `eval_items` | Reference `samples` rows | Sets must be immutable; cascade delete still removes the copy |
| One worker thread, checkpoint per item | Queue service or n8n workflow | Single Render Free instance; no new infrastructure; restarts are expected |
| Operator allowlist | Buyer brings an API key | Avoids handling third-party secrets and unbounded data egress in v1 |
| New notice version | Reuse v1 consent | Sending text to new providers is a new use the v1 notice does not describe |
| Turn 1 only on the target track | Replay all three turns | Turns 2 and 3 were written in response to a different reply |
| Manual grants, no payment | Checkout integration | Demand is unvalidated; parent PRD keeps payment a non-goal |

## Open design questions

1. Whether `eval_items` should outlive the 90-day sample retention. The cascade
   design assumes they do not.
2. Whether the estimate should include a currency cost. Provider prices are not
   in the repository; call counts are exact, costs would be an operator-maintained
   table.
3. The reference judge for the target track: the live judge route, or a pinned
   stronger model that is never also a candidate.
