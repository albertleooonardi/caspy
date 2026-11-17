# Implementation plan: Caspy Bench

Tasks are ordered so each one leaves the application working. Phase 0 and 1 are
the minimum useful release; phases 2 and 3 are optional follow-ons. Requirement
numbers refer to [requirements.md](requirements.md); design details are in
[design.md](design.md).

## Phase 0 — Consent notice v2

- [ ] 1. Introduce notice v2 in the platform store
  - Change `NOTICE` to `caspy-research-2026-11-v2`; add nullable
    `contributions.providers`; store the accepted provider list on new contributions
  - Keep existing v1 rows readable and exportable in existing releases
  - Tests: new contribution records v2 and providers; a v1 row is not upgraded;
    stale `consent_version` is rejected as today
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 2. Show notice v2 and the provider list before the first prompt
  - `GET /campaigns` returns the allowlisted providers; consent panel in
    `App.tsx` and the privacy page state replay to other AI providers and the
    limits of withdrawal
  - Verify declining research leaves attempts and rewards unchanged
  - _Requirements: 2.1, 2.4, 7.6_

## Phase 1 — Evaluation sets and judge-track runs

- [ ] 3. Add configuration and the gateway key
  - `CASPY_BENCH_ENABLED`, `CASPY_BENCH_DAILY_LIMIT`, `CASPY_BENCH_RUNS_PER_DAY`,
    `CASPY_BENCH_MODELS_JSON` in `runtime_config.py` and `.env.example`
  - `vk-bench` virtual key, budget, rate limit and candidate routes in
    `bifrost.config.example.json` and `bifrost_setup.py`
  - Tests: allowlist parsing, empty allowlist disables the feature, malformed JSON
    fails at startup with a clear message
  - _Requirements: 3.1, 3.4, 6.1_

- [ ] 4. Implement the pure metrics module
  - `benchmark_metrics.py`: `wilson`, `kappa`, confusion matrix, `summarize`
  - Tests with hand-computed fixtures, the 29/30 threshold, single-class input,
    exclusion of `UNCERTAIN`, `invalid` and `error`
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 5. Create the benchmark store and schema
  - `benchmark_store.py` with `eval_sets`, `eval_items`, `bench_runs`,
    `bench_results`, `bench_calls`; row-level security on Postgres
  - Startup marks `running`/`queued` runs `paused`
  - _Requirements: 6.5, 7.1_

- [ ] 6. Freeze evaluation sets
  - Eligibility filter, normalized-prompt dedupe, per-contributor cap of 5,
    minimum of 30, versioning, immutability, audit event
  - Return exclusion counts by reason for the UI
  - Tests: each filter, cap, shortfall, version increment, cross-workspace 404
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [ ] 7. Add the benchmark gateway call
  - `benchmark(model_route, messages)` in `heist_api.py` using `vk-bench`; reuse
    the live judge message builder and output validator with the set's rubric
  - Record requested and served model; fixed temperature and output limit
  - _Requirements: 3.2, 3.3, 3.5, 4.2, 4.3, 4.7_

- [ ] 8. Implement the run lifecycle
  - Estimate-then-confirm start, single-worker runner, per-item commit, one retry
    for invalid output, `error` handling, pause on budget or 5 consecutive errors,
    resume, cancel, completion with stored metrics, runs-per-day limit
  - Skip items whose contributor did not accept the run's provider
  - Tests with a fake gateway for every state transition; assert one call per item
  - _Requirements: 2.5, 4.1, 4.4, 4.5, 4.6, 4.8, 6.2, 6.3, 6.4, 6.6, 6.7_

- [ ] 9. Apply withdrawal and retention to sets and results
  - Confirm `ON DELETE CASCADE` removes items and results on withdrawal and purge
    in both SQLite and Postgres; mark finished runs with `withdrawn_after`; lock
    sets below 30 items
  - Tests: withdraw mid-run, withdraw after completion, purge expiry
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 10. Expose the API routes
  - `/research/benchmarks`, `/sets`, `/runs`, `/runs/{id}`, `/resume`, `/cancel`
    with session, origin and workspace checks; 503 when disabled
  - HTTP tests for authentication, ownership and the feature flag
  - _Requirements: 1.8, 3.4, 4.1, 8.1_

- [ ] 11. Build the report and aggregate export
  - Report payload with metrics, comparison of runs on the same set version,
    partial-run label and the fixed limitations statement; JSON export with
    aggregates only
  - Tests: no item text or identifiers in report or export
  - _Requirements: 5.5, 5.6, 8.1, 8.2, 8.3, 8.4_

- [ ] 12. Add the Benchmarks tab to the research workspace
  - Sets table and freeze form, run confirmation with call count and providers,
    report view with "insufficient data" states and side-by-side comparison
  - Check keyboard access, contrast and the 650px mobile layout
  - _Requirements: 1.7, 4.1, 5.2, 5.3, 5.5, 8.1_

- [ ] 13. Verify end to end and document
  - Run the full Python suite and the frontend checks; run one fake-gateway
    benchmark through the UI locally
  - Update `PRD.md` (new section and API table), `.kiro/steering/project.md` and
    `docs/cloud-deployment.md` with what was built and what was not verified
  - _Requirements: all phase 1_

## Phase 2 — Catalog and second reviewer

- [ ] 14. List evaluation sets and reports in the catalog
  - `orders.kind`; listing requires commercial consent on every item; request,
    grant and revoke through existing endpoints; audit events
  - _Requirements: 9.1, 9.2, 9.3, 9.5, 9.6_

- [ ] 15. Granted evaluation-set export
  - Per-request grant and consent check, release-specific pseudonyms, lapsed
    items omitted
  - _Requirements: 9.4, 7.5_

- [ ] 16. Second-reviewer labels and inter-rater agreement
  - Depends on workspace membership (not yet built); `sample_labels` table,
    blind second label, disagreement becomes `UNCERTAIN`, kappa in the report
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

## Phase 3 — Target (red-team) track

- [ ] 17. Target-track replay with a fixed reference judge
  - Turn-1 only, frozen Caspy system prompt, reference judge identical across
    candidates, candidate replies stored under retention
  - _Requirements: 11.1, 11.2, 11.5_

- [ ] 18. Human spot-check and target-track report
  - Sampling of at least 10% (minimum 20) for review; separate benign-yield and
    attack-yield metrics; reference-judge agreement shown
  - _Requirements: 11.3, 11.4_
