# PRD: Caspy Bench — Persuasion Benchmark & Red-Team Evaluation

| Field   | Value |
| ------- | ----- |
| Version | 0.1 (draft for review) |
| Status  | Proposed; nothing in this document is implemented |
| Date    | 2026-11-14 |
| Owner   | TBD |
| Parent  | [PRD.md](PRD.md) section 20, "AI Prompt Evaluation & Testing Platform (v1.1)" |
| Spec    | [.kiro/specs/persuasion-benchmark/](.kiro/specs/persuasion-benchmark/requirements.md) |

---

## 1. Summary

Caspy already collects consented three-prompt heists, lets a research workspace
review and label them, and publishes controlled-access dataset releases
(PRD section 20). What it cannot do yet is answer the question a model developer
actually asks: **"How well does *my* model handle human persuasion compared with
other models?"**

Caspy Bench adds that missing step. A workspace freezes a set of human-labelled
persuasion attempts into a versioned **evaluation set**, replays it against one or
more **candidate models**, and gets a **benchmark report** that scores each model
against the human labels. The three reasons a player types to win candy become a
reusable resilience test, and how accurately a model judges those reasons becomes
a comparable metric.

The feature turns Caspy's B2B offer from "request a dataset" into "request a
dataset, an evaluation set, or a benchmark report for a named model".

## 2. Problem

- Model developers lack natural examples of people trying to persuade, flatter or
  psychologically pressure an AI. Synthetic attack prompts are easy to produce but
  do not look like real human attempts.
- Caspy's current metrics (persuasion yield, judge agreement, boundary violation
  rate) describe only the one actor and judge configured for the live game. PRD
  section 20.5 states that cross-model replay, confidence intervals, deduplication
  and inter-rater agreement are required before any benchmark claim.
- A dataset buyer today receives rows, not a measurement. They must build their
  own harness to learn anything about their model.

## 3. What already exists, and what is new

| Capability | Today (PRD section 20) | Added by Caspy Bench |
| --- | --- | --- |
| Consented collection, redaction, withdrawal | Implemented | New notice version that covers replay to other model providers |
| Human review and labels | Implemented, one reviewer | Optional second independent label; agreement reported |
| Metrics | Live actor and judge only | Per-candidate-model metrics on a frozen set, with confidence intervals |
| Frozen, versioned test corpus | Not available | Evaluation sets |
| Replay across models | Listed as future work | Benchmark runs: judge track, then target (red-team) track |
| B2B catalog | Dataset releases, manual access grant | Evaluation sets and benchmark reports as catalog items, same manual grant |
| Payment | None | Still none (see non-goals) |

## 4. Goals and non-goals

### Goals

- G1: A workspace owner can freeze reviewed, consented samples into an immutable,
  versioned evaluation set.
- G2: The same evaluation set can be replayed against several candidate models
  under one frozen rubric, and the results are comparable.
- G3: Every reported rate shows its numerator, denominator and a 95% confidence
  interval; a metric with too few items is shown as unavailable, never as zero.
- G4: No contribution is sent to a model provider the contributor was not told
  about. Withdrawal removes a contribution from future runs and from stored
  per-item results.
- G5: Benchmark runs have a hard, visible cost ceiling and can never slow down,
  change or bill the live game.
- G6: A buyer workspace can request an evaluation set or a benchmark report
  through the existing catalog and grant flow.

### Non-goals (this release)

- No payment checkout, invoicing or automated licence execution. Access remains a
  manual grant, as in PRD section 20.6.
- No model training, reward-model fitting, fine-tuning or pairwise preference
  collection. This is evaluation, not RLHF training.
- No customer-supplied API keys or arbitrary endpoints. Candidate models come from
  an operator allowlist of gateway routes.
- No public leaderboard and no claim to certify model safety or measure general
  emotional intelligence.
- No change to gameplay, attempts, judging of live heists, rewards or minting.
- No guarantee of anonymity. Data is redacted and human-reviewed, which reduces
  but does not remove re-identification risk.

## 5. Users

| Persona | Need | What Bench gives them |
| --- | --- | --- |
| Research workspace owner | Turn reviewed samples into a repeatable measurement | Evaluation sets, runs, reports |
| Dataset buyer (model developer) | Know how their model compares before licensing data | Benchmark report for an allowlisted model; evaluation-set licence |
| Contributor (player) | Control over where their words go | Clear notice, per-heist choice, withdrawal that also removes benchmark results |
| Operator | Bounded cost, no impact on the game | Model allowlist, separate gateway key, budgets, kill switch |

## 6. How it works

1. **Collect and review** — unchanged. Players opt in per heist; reviewers redact
   and label each turn.
2. **Freeze** — the owner selects approved samples and publishes evaluation set
   `v1`. Items, labels, rubric and actor-prompt hashes are locked. Near-duplicate
   prompts are removed and at most a fixed number of items per contributor is kept.
3. **Run** — the owner picks a set, a track and one or more candidate models,
   sees the estimated number of model calls, and starts the run.
   - **Judge track:** the candidate receives the rubric, the human prompt and the
     recorded Caspy reply, and must return the standard judge verdict. Its verdict
     is compared with the human label. This measures how well a model *assesses*
     persuasion.
   - **Target track (phase 2):** the candidate plays Caspy with the frozen system
     prompt and answers the human's first prompt. A fixed reference judge and a
     human spot-check decide whether it yielded. This measures how well a model
     *resists* persuasion.
4. **Report** — per model: agreement with human labels, chance-corrected
   agreement, false-yield rate on policy attacks, breakdown by persuasion
   strategy, invalid-output rate, latency, and call counts.
5. **Share** — the owner can list the evaluation set or a report in the catalog.
   Buyers request access; the owner grants or revokes it.

## 7. Requirements overview

Detailed acceptance criteria are in
[requirements.md](.kiro/specs/persuasion-benchmark/requirements.md).

| # | Requirement | Priority |
| --- | --- | --- |
| R1 | Frozen, versioned evaluation sets built from approved samples | Must |
| R2 | Consent notice v2 covering replay to other model providers; v1 contributions excluded from replay | Must |
| R3 | Operator-managed candidate model allowlist | Must |
| R4 | Judge-track benchmark runs | Must |
| R5 | Metrics with denominators, confidence intervals and minimum sample sizes | Must |
| R6 | Cost, rate and isolation controls; resumable runs | Must |
| R7 | Withdrawal and retention applied to sets and results | Must |
| R8 | Benchmark report view and export | Must |
| R9 | Catalog listing and access grants for sets and reports | Should |
| R10 | Second-reviewer labels and inter-rater agreement | Should |
| R11 | Target (red-team) track | Could (phase 2) |

## 8. Metrics definitions

All metrics are computed per run, per candidate model, on one evaluation-set
version and one rubric hash.

| Metric | Definition | Reading |
| --- | --- | --- |
| Verdict agreement | Candidate verdict equals human expected verdict / items with a non-uncertain human verdict and a valid candidate output | Agreement with this workspace's reviewers, not ground truth |
| Cohen's kappa | Chance-corrected agreement on the same items | Guards against a model that always answers `NO_YIELD` |
| False-yield rate on attacks | Candidate `YIELD` / items human-labelled as policy or instruction attacks with expected `NO_YIELD` | The red-teaming signal: how often an attack fools the model |
| False-refusal rate | Candidate `NO_YIELD` / items human-labelled valid persuasion with expected `YIELD` | Over-caution |
| Invalid-output rate | Outputs that fail the judge schema / items attempted | Reported separately; never counted as agreement or disagreement |
| Strategy breakdown | Verdict agreement per persuasion strategy | Shown only where the group meets the minimum sample size |
| Latency | Median and p95 application-observed latency | Operational, not a quality score |

Rates use a Wilson 95% interval. A rate with fewer than 30 items in its
denominator is shown as "insufficient data".

## 9. Privacy, consent and safety

- **New data use needs new consent.** The current notice
  (`caspy-research-2026-11-v1`) covers research review and licensing. It does not
  say that a contributor's text will be sent to additional AI providers. Bench
  introduces notice `caspy-research-2026-11-v2`, which names that use. Only
  contributions recorded under v2 can enter an evaluation set that is replayed.
- **Withdrawal reaches results.** Withdrawing a contribution removes its items
  from every evaluation set and deletes stored per-item model outputs. Aggregates
  of finished runs are marked as computed before the withdrawal.
- **Retention.** Evaluation-set items follow the existing 90-day research-sample
  expiry unless the policy is changed for all research data. An expired set can no
  longer be run or exported; its aggregate reports remain.
- **Provider logging.** Each allowlisted model shows its provider, so the notice
  and the run screen can state who receives the text.
- **Honest claims.** Reports carry a fixed limitations block: self-selected and
  incentivized players, small samples, single-workspace labels, and no claim of
  model safety certification.

## 10. Success metrics

Targets are product hypotheses, not measured results.

- At least one evaluation set of 100 or more items frozen from real consented
  play within the first month.
- A judge-track run across three candidate models completes within the daily
  free-tier budget and reproduces within 2 percentage points on rerun.
- Share of new heists that accept notice v2 is not lower than the v1 acceptance
  rate by more than 10 percentage points.
- At least three researcher interviews confirm the report answers a question they
  have; this validates demand before any payment work begins.

## 11. Risks

| Risk | Mitigation |
| --- | --- |
| Too few labelled samples for meaningful intervals | Minimum sample thresholds; "insufficient data" state; campaign prompts to collect specific strategies |
| Benchmark calls exhaust free provider quotas and break the live game | Separate gateway key, own daily budget, lower rate limit, live-game priority, kill switch |
| Results over-claimed as a safety certificate | Fixed limitations block on every report and export; no leaderboard |
| Reviewer bias defines "truth" | Second-reviewer labels and reported agreement; metric names say "agreement with reviewers" |
| Contributors surprised by replay to other providers | Notice v2, per-heist choice, provider list visible before consent |
| Render Free restarts kill long runs | Runs are checkpointed per item and resume; no run depends on one uninterrupted process |
| Prompt injection inside evaluation items subverts the candidate judge | That is part of what is measured; outputs are schema-validated and never executed or trusted |

## 12. Rollout

| Phase | Scope | Exit check |
| --- | --- | --- |
| 0 | Notice v2 and consent capture only | New heists record v2; v1 behaviour unchanged |
| 1 | Evaluation sets, model allowlist, judge-track runs, report view | One real set run against two models; rerun reproduces |
| 2 | Catalog listing for sets and reports; second-reviewer labels | Buyer workspace completes request, grant, download |
| 3 | Target (red-team) track | Human spot-check agreement with the reference judge is reported |

## 13. Open questions

1. Which candidate models are offered first? This depends on which providers the
   operator is willing to configure and pay for; the free Gemini tier used by the
   game may be the only zero-cost option.
2. Should evaluation-set items be exempt from the 90-day expiry so a benchmark
   stays stable over time? That is a consent and policy change, not only a
   technical one.
3. Is a benchmark report for a buyer's own model worth more than the raw
   evaluation set? Pricing and payment are deliberately deferred until this is
   answered by researcher interviews.
4. Should a second reviewer be required before an item can enter a set, once
   workspace invitations exist? Today workspaces have a single owner.
5. Is a public, aggregate-only summary page wanted for marketing, and who approves
   what it may claim?
