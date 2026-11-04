> Storage update: both Bifrost stores now target Supabase PostgreSQL using dedicated private schema roles. `./run.sh` checks these connections. See [database migration](supabase.md); earlier SQLite instructions below are historical.

# Caspy's Bifrost gateway

Bifrost is the third-party gateway in the ignored `bifrost/` clone. Caspy's
configuration and tooling live in the root repository so a fresh checkout can
reproduce the setup without changing upstream code. The frontend supports a
local AI playground through `scripts/heist_api.py`. Run `bash run.sh --ai-only`
from the root and open <http://localhost:4321/play>. The production FastAPI
game API and production signing/deployment remain separate work. For wallet
sign-in and NFT claims on local Anvil, use `bash run.sh`; see the
[local NFT guide](nft-local.md).

## Local setup

Requires Python 3 and the `bifrost` executable (`npm install -g @maximhq/bifrost`).
Go is only needed when building upstream Bifrost from source.
The initializer pins `BIFROST_TRANSPORT_VERSION=v2.4.0`, the version verified by
live QA, unless you already supply a version.

```bash
python3 scripts/bifrost_setup.py init
# Fill OPEN_ROUTER_API_KEY in the root .env.
python3 scripts/bifrost_setup.py check
bash scripts/shell/run-bifrost.sh
```

The initializer generates missing setup/admin credentials and separate actor and
judge tokens. It preserves existing non-empty credentials and provider settings
in `.env`, migrates `BIFROST_TOKENS` to `BIFROST_SETUP_TOKEN`, and writes secrets
with file permissions `0600`. It reads dotenv assignments as data without
executing shell expressions. Quote values containing whitespace or `#`; multiline
values and variable expansion are unsupported. Non-empty process variables take
precedence over `.env`.

The launcher works from any directory, validates the configuration, and binds to
`127.0.0.1:8080`. Open <http://127.0.0.1:8080> and log in with
`BIFROST_ADMIN_USERNAME` and `BIFROST_ADMIN_PASSWORD` from `.env`.

Both the dashboard and inference API require authentication. The setup token
provides first-admin setup proof if you use the dashboard setup flow; it is not
the password or an inference key. Never put these credentials or provider keys in
Astro `PUBLIC_*` variables. The browser should call the game API, which calls
Bifrost from the server.

## Routes and limits

| Agent / virtual key ID | Primary | Fallback | Daily budget |
| --- | --- | --- | --- |
| Actor / `vk-caspy` | `openrouter/nvidia/nemotron-3.5-lightning:free` | `openrouter/nvidia/nemotron-3-ultra-550b-a55b:free` | $5 |
| Judge / `vk-judge` | `openrouter/nvidia/nemotron-3.5-super-vl:free` | `openrouter/dots-studio/dots-3-note-preview:free` | $10 |

Each key has its own 10-request/minute limit and an explicit model allowlist.
Virtual-key scoped routing selects the primary and ordered fallback. Both keys
belong to team `caspy`. A global wildcard model limit scoped to OpenRouter owns
the shared $20/hour and $200/day budgets across both keys and their fallbacks.
These values are development defaults to review before launch. The per-agent
daily budgets apply alongside the shared caps; they do not add to them.

Budget names do not create enforcement: every budget must be attached to its
owning model limit or key. The installed Bifrost v2.4.0 migrates per-key limits
into virtual-key-scoped wildcard model limits; legacy team-owned budgets were
left unbound during live QA. The configuration therefore declares shared caps
as `governance.model_configs` with a global `*` model and `provider: openrouter`.
That scope also covers OpenRouter calls from other teams. Runtime logs must show
`global-hourly` and `global-daily` alongside the agent budget in `budget_ids`.

All routes and provider-key model allowlists use explicit OpenRouter `:free`
variants. The validator rejects paid models in both routes and virtual-key
allowlists. Provider retries are disabled to conserve free-tier quota, with a
60-second timeout per attempt and an ordered free fallback. Judge calls use
temperature zero and strict JSON, separately from actor streaming; smoke tests
disable optional reasoning to keep the response within the output token cap.

Model IDs, zero prompt/completion prices, and judge structured-output capability
were checked against OpenRouter's public model catalog on November 1, 2026.
The four selected models also returned successful synthetic responses with
reported cost zero. Free endpoints remain subject to shared capacity and
[OpenRouter's free-tier limits](https://openrouter.ai/collections/free-models),
so a valid key can still receive HTTP 429. These shared gateway budgets do not
increase upstream free-tier quotas. Old Groq or other provider rows retained in
an existing database are outside these scoped key allowlists.

The IDs `vk-caspy` and `vk-judge` are not bearer tokens. The backend must send the
corresponding secret value (`BIFROST_CASPY_VK` or `BIFROST_JUDGE_VK`) in `x-bf-vk`.
The OpenAI-compatible endpoint is `POST /v1/chat/completions`, with the primary
`provider/model` string from the table above as `model`.

## Verify a running gateway

In a second terminal after starting the gateway:

```bash
# Health and rejection of anonymous inference.
python3 scripts/bifrost_setup.py smoke

# Also test streamed actor text and a strict JSON judge result using free models.
python3 scripts/bifrost_setup.py smoke --inference
```

The smoke test uses fixed synthetic input, refuses redirects, bypasses proxies,
and never prints tokens, prompts, completions, or provider error bodies. It
checks that the actor stream ends and has content, and validates judge fields,
types, confidence range, and reason length. It tests connectivity and output
shape only; it does not evaluate persuasion, enforce game rules, or mint NFTs.
Fallbacks are declared but are not forced by this test.

Offline regression checks need no provider access:

```bash
python3 -m unittest discover -s scripts -p 'test_*.py' -v
bash -n scripts/shell/run-bifrost.sh
```

## Update and recovery

`init` leaves an existing `data/config.json` untouched. To apply the tracked
template after reviewing it, stop your gateway and run:

```bash
python3 scripts/bifrost_setup.py init --update-config
python3 scripts/bifrost_setup.py check
bash scripts/shell/run-bifrost.sh
```

This backs up the existing JSON to `data/config.<random>.backup.json`, replaces
it with the template, and resolves SQLite paths against this checkout. It does
not edit the SQLite files. Bifrost reconciles the configuration into its store
at its next startup. The default split reconciliation mode preserves unrelated
dashboard resources; inspect those resources if using an existing database.
To restore the previous file, stop the gateway and copy the backup over
`data/config.json`. File restoration does not undo changes already reconciled
into SQLite; use your database backup for a complete runtime rollback.

## Next integration step

Build the FastAPI server adapter that sends actor and judge calls with their
respective virtual keys. That API must own attempts, idempotency, sessions,
per-wallet/session cost accounting, prompt versions, and deterministic
post-checks. Shared gateway budgets do not enforce the PRD's $0.05/session cap or
automatically switch the UI to "Caspy is napping". Map gateway limit/errors to
that API behavior explicitly. LLM output must never directly authorize a win or
a mint.
