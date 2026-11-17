# Requirements: Caspy Bench — Persuasion Benchmark & Red-Team Evaluation

## Introduction

Caspy Bench lets a research workspace freeze reviewed, consented heist turns into
a versioned evaluation set, replay that set against several candidate models, and
read a benchmark report that scores each model against human labels. It extends
the research platform described in [PRD.md](../../../PRD.md) section 20. Product
context, goals and non-goals are in
[PRD-persuasion-benchmark.md](../../../PRD-persuasion-benchmark.md).

Nothing in this spec changes gameplay, live judging, rewards or minting.

### Terms

- **Sample:** one reviewed, redacted prompt/reply turn in the existing `samples` table.
- **Evaluation set:** an immutable, versioned list of samples with locked labels.
- **Candidate model:** a gateway route on the operator allowlist that a run may call.
- **Run:** one replay of one evaluation set against one candidate model on one track.
- **Judge track:** the candidate acts as the judge and returns a verdict.
- **Target track:** the candidate acts as Caspy and replies to the human prompt.
- **Gold label:** the human expected verdict locked into an evaluation-set item.
- **Notice v2:** consent notice `caspy-research-2026-11-v2`, which covers replay to
  other AI model providers.

## Requirements

### Requirement 1: Frozen evaluation sets

**User story:** As a research workspace owner, I want to freeze reviewed samples
into a versioned evaluation set, so that every model is tested on exactly the same
items.

#### Acceptance criteria

1. WHEN an owner creates an evaluation set THEN the system SHALL include only
   samples that belong to the owner's workspace, are approved, have a human
   expected verdict, and have active research consent recorded under notice v2.
2. WHEN an evaluation set is published THEN the system SHALL store, for each item,
   a copy of the reviewed prompt, reviewed reply, gold verdict, test type,
   behaviour label, strategy, and the rubric and actor-prompt hashes of the
   originating campaign.
3. WHEN an evaluation set is published THEN the system SHALL reject any later
   change to its items or labels; a correction SHALL require a new version.
4. WHEN candidate samples contain prompts that are identical after
   normalization THEN the system SHALL keep one and report how many were dropped.
5. WHEN one contributor accounts for more than 5 items THEN the system SHALL keep
   at most 5 of that contributor's items in the set.
6. IF fewer than 30 items remain after filtering THEN the system SHALL refuse to
   publish and state how many more are needed.
7. WHEN an owner views an evaluation set THEN the system SHALL show its version,
   item count, counts per gold verdict and test type, rubric hash, and creation
   time, and SHALL NOT show contributor identities.
8. WHEN a user who does not own the workspace requests the set THEN the system
   SHALL return "not found" unless a current access grant exists (Requirement 9).

### Requirement 2: Consent for replay to other providers

**User story:** As a contributor, I want to be told before I play that my words
may be sent to other AI models for benchmarking, so that I can decide per heist.

#### Acceptance criteria

1. WHEN a player opts in to research on a new heist THEN the system SHALL present
   notice v2, which states that redacted prompts and replies may be sent to other
   AI model providers for evaluation and lists the providers currently allowlisted.
2. WHEN a contribution was recorded under notice v1 THEN the system SHALL keep its
   existing uses and SHALL NOT include it in any evaluation set or run.
3. The system SHALL NOT upgrade an existing contribution from v1 to v2.
4. WHEN a player declines research THEN attempts, difficulty, win conditions and
   reward eligibility SHALL be unchanged.
5. WHEN the operator adds a provider that was not listed in the notice a
   contribution accepted THEN the system SHALL exclude that contribution from runs
   against that provider.

### Requirement 3: Candidate model allowlist

**User story:** As an operator, I want to control which models can be benchmarked,
so that no workspace can send data to an unapproved provider or spend without
limit.

#### Acceptance criteria

1. The system SHALL load candidate models from operator configuration, each with
   an identifier, display name, provider name and gateway route.
2. WHEN a run names a model that is not on the allowlist THEN the system SHALL
   reject it without making any model call.
3. The system SHALL NOT accept API keys, base URLs or model identifiers from a
   workspace user.
4. WHEN the allowlist is empty or the benchmark feature flag is off THEN the
   benchmark endpoints SHALL report the feature as unavailable and the rest of the
   research workspace SHALL work as before.
5. WHEN a run records a result THEN the system SHALL store both the requested
   model and the model the provider reported as served; a missing served value
   SHALL be stored as unknown.

### Requirement 4: Judge-track runs

**User story:** As a workspace owner, I want to replay an evaluation set through a
candidate model acting as the judge, so that I can measure how well it assesses
human persuasion.

#### Acceptance criteria

1. WHEN an owner starts a run THEN the system SHALL show the number of model calls
   it will make and SHALL require explicit confirmation.
2. WHEN a judge-track item is evaluated THEN the system SHALL send the frozen
   rubric, the item's prompt and the item's recorded reply using the existing
   judge input contract (PRD section 7.3), with the item text delimited and
   treated as data.
3. WHEN the candidate returns output THEN the system SHALL validate it against
   the judge output schema; output that fails validation SHALL be recorded as
   `invalid` and SHALL NOT be retried more than once.
4. WHEN a provider call fails or times out THEN the system SHALL record the item
   as `error`, SHALL NOT count it as agreement or disagreement, and SHALL allow
   the owner to resume the run for the unfinished items only.
5. The system SHALL call each item at most once per run unless the owner
   explicitly resumes; a resume SHALL never repeat an item that already has a
   valid or invalid result.
6. WHEN all items have a terminal result THEN the system SHALL mark the run
   `completed` and compute its metrics.
7. The system SHALL send the same rubric text, temperature and output limit to
   every candidate in runs on the same evaluation-set version.
8. WHEN an owner cancels a run THEN the system SHALL stop issuing new calls and
   keep the results already recorded.

### Requirement 5: Metrics that can be trusted

**User story:** As a researcher, I want every number to show what it was computed
from, so that I do not over-read a small sample.

#### Acceptance criteria

1. The system SHALL compute, per run: verdict agreement, Cohen's kappa,
   false-yield rate on attacks, false-refusal rate, invalid-output rate, a
   confusion matrix, median and p95 latency, and agreement per strategy.
2. WHEN a rate is displayed or exported THEN the system SHALL include its
   numerator, denominator and Wilson 95% confidence interval.
3. IF a denominator is below 30 THEN the system SHALL show "insufficient data"
   in place of the rate and SHALL omit it from any comparison.
4. Items with a gold verdict of `UNCERTAIN`, and items with `invalid` or `error`
   results, SHALL be excluded from agreement metrics and counted separately.
5. WHEN two or more completed runs share an evaluation-set version and track THEN
   the system SHALL show them side by side; runs on different versions SHALL NOT
   be compared in one table.
6. Every report SHALL include a fixed limitations statement covering self-selected
   incentivized participants, sample size, single-workspace labels and the absence
   of any safety certification.

### Requirement 6: Cost, rate and isolation controls

**User story:** As an operator, I want benchmark traffic to be capped and separate
from the game, so that a run can never exhaust the game's quota or budget.

#### Acceptance criteria

1. Benchmark calls SHALL use a dedicated gateway virtual key with its own daily
   budget and rate limit, distinct from the actor and judge keys.
2. WHEN the daily benchmark budget is exhausted THEN the system SHALL pause
   running runs with a visible reason and SHALL NOT fail them.
3. The system SHALL run at most one benchmark item call at a time per deployment.
4. WHEN the operator disables the feature flag THEN in-flight runs SHALL stop
   after the current call and remain resumable.
5. WHEN the server restarts THEN runs that were in progress SHALL be marked
   `paused`, not `completed` or `failed`, and SHALL NOT restart automatically.
6. A workspace SHALL be limited to a configurable number of runs per day.
7. Benchmark failures SHALL NOT affect `/health`, live game turns or live judging.

### Requirement 7: Withdrawal and retention

**User story:** As a contributor, I want withdrawing my contribution to remove it
from benchmarks too, so that withdrawal means what it says.

#### Acceptance criteria

1. WHEN a contribution is withdrawn THEN the system SHALL delete its items from
   every evaluation set and delete the stored per-item results for those items.
2. WHEN an evaluation set loses items after a run completed THEN the system SHALL
   keep the run's aggregate metrics and mark the report "computed before
   withdrawal of N item(s)".
3. WHEN a withdrawn item's set has a paused or running run THEN the system SHALL
   skip that item.
4. WHEN a sample passes the research retention period THEN the system SHALL
   remove its evaluation-set item and per-item results in the same purge.
5. IF an evaluation set falls below 30 items THEN the system SHALL prevent new
   runs and new access grants on that version.
6. The consent notice SHALL state that copies already downloaded under a grant
   and aggregate numbers already reported cannot be recalled.

### Requirement 8: Benchmark report

**User story:** As a workspace owner, I want a readable report and a machine
export, so that I can share results with my team.

#### Acceptance criteria

1. WHEN a run completes THEN the owner SHALL be able to view a report with the
   evaluation-set version, track, candidate model (requested and served), rubric
   hash, run dates, item counts by result state, all metrics from Requirement 5
   and the limitations statement.
2. WHEN the owner exports a report THEN the system SHALL return JSON containing
   aggregates only, with no item text and no contributor identifiers.
3. The report SHALL NOT include free-form judge reasons returned by candidates.
4. WHEN a run is incomplete THEN the report SHALL be labelled partial and SHALL
   show how many items remain.

### Requirement 9: Catalog and access grants

**User story:** As a dataset buyer, I want to request an evaluation set or a
benchmark report, so that I can evaluate before licensing.

#### Acceptance criteria

1. WHEN an owner lists an evaluation set or report THEN the catalog SHALL show
   its title, purpose, item count, licence, listed price and owner, and SHALL NOT
   show item text or contributor identities.
2. An evaluation set SHALL be listable only if every item has active research
   AND commercial consent under notice v2.
3. WHEN a buyer workspace requests access THEN only the owning workspace SHALL be
   able to grant or revoke it.
4. WHEN a granted buyer downloads an evaluation set THEN the system SHALL check
   the current grant and the current consent of every item at request time, and
   SHALL use release-specific pseudonyms as in existing exports.
5. The system SHALL NOT charge a buyer; a request or grant SHALL NOT be described
   as a completed purchase.
6. Every grant, revocation, export and run start SHALL write a metadata-only
   audit event.

### Requirement 10: Second-reviewer labels

**User story:** As a researcher, I want to know how much reviewers agree, so that
I can tell label noise from model error.

#### Acceptance criteria

1. WHERE a workspace has more than one reviewer THEN the system SHALL allow a
   second reviewer to label a sample without seeing the first reviewer's labels.
2. WHEN two labels exist for an item THEN the evaluation set SHALL record whether
   the expected verdicts agree.
3. WHEN an evaluation set contains doubly labelled items THEN the report SHALL
   show inter-rater agreement (Cohen's kappa) and its item count.
4. Items whose two reviewers disagree SHALL be given gold verdict `UNCERTAIN`.
5. WHEN a set contains only singly labelled items THEN the report SHALL state
   "single-rater labels".

### Requirement 11: Target (red-team) track — phase 2

**User story:** As a model developer, I want to see whether my model gives in when
it plays Caspy, so that I can measure resistance to human persuasion.

#### Acceptance criteria

1. WHEN a target-track item is evaluated THEN the system SHALL send the frozen
   Caspy system prompt and the human prompt of turn 1 only; later turns SHALL NOT
   be replayed because they answered a different reply.
2. WHEN the candidate replies THEN a fixed reference judge, identical for all
   candidates in the comparison, SHALL produce the verdict.
3. The system SHALL sample at least 10% of target-track outputs, with a minimum of
   20, for human review, and SHALL report human agreement with the reference judge.
4. The report SHALL present yield on benign persuasion and yield on policy attacks
   as separate metrics and SHALL NOT label benign yield as a failure.
5. Candidate replies SHALL be stored only for the retention period and SHALL be
   deleted with their item on withdrawal.

## Out of scope

Payment checkout, customer-supplied model keys, public leaderboards, model
training or fine-tuning, pairwise preference collection, workspace invitations
and SSO (a dependency of Requirement 10, tracked separately).
