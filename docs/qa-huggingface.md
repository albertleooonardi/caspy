# Hugging Face and browser QA — 2026-11-03

Status: configuration/authentication verified; real image generation blocked by
Hugging Face HTTP 402 (billing). No FLUX image or NFT was created in this run.

## Environment

Existing user-started local stack: Astro frontend on port 4321, game API on
8000, Bifrost on 8080, Anvil chain 31337. The API reports NFT mode enabled,
HF_TOKEN configured, a 1,000-candy cap and a daily generation limit of 10.
Credentials were read only server-side and are not included in this report.

The browser access host was unavailable, so browser QA used native Safari
accessibility inspection and screenshots through the computer-use tool rather
than a DOM scraping connector. HTTP/API checks supplemented browser observations.

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| Token authentication | Pass | Hugging Face identity endpoint accepted the fine-grained token. |
| Requested model availability | Pass | Model API lists FLUX.1-dev as live for text-to-image through fal-ai. |
| Real hosted inference | Blocked | One fictional lighthouse-candy request returned HTTP 402; no output PNG exists. No automatic retry was made. |
| Existing account session | Pass | Safari showed the signed-in local account. The login form was not exercised during this run. |
| Local wallet sign-in | Pass | Wallet selection loaded; signing in returned a verified wallet in the header. |
| Live Bifrost chat | Pass for transport | Three original fictional prompts streamed real replies. Remaining attempts moved 3 → 2 → 1 → 0. |
| Win gate | Enforced | The judge did not confirm an eligible win; the result page offered no image generation or mint. The candy job table remained empty. |
| Collection | Pass | Connected wallet loaded an empty collection without invented artwork. |
| Marketplace | Pass for empty state | Loaded the collection cap and “No candy is listed yet.” No live trade was made. |
| Tutorial playback | Pass | Safari native/custom controls changed to Pause; chapter seeking moved to 1:02; time advanced to 1:05; Pause stopped the film. |
| Complete real image → mint → sale | Not verified | No eligible win in this run, and provider billing blocks real image generation. Earlier fixture-chain tests are separate evidence, not a live FLUX end-to-end pass. |

The provider-only smoke request is explicitly separate from gameplay and did not
create a winning verdict, grade, image entitlement, voucher or NFT. Its safe
status record is in ignored `data/qa/hf-flux-smoke.json`.

## Judge observation

Caspy's replies agreed to share candy, while the separate judge classified the
fictional persuasion as `exploit_attempt`. One evaluation returned `YIELD` with
that category while `exploit_flag` was false; a later evaluation marked the flag
true. Server checks rejected these as eligible wins. This is a model/rubric
consistency and calibration concern; conversational agreement does not establish
a valid win. No outcome, attempt counter, judge decision or mint gate was bypassed
to make the test pass. Further judge-quality evaluation is needed before claiming
a calibrated persuasion benchmark.

## Fixes made during QA

- Worker errors now expose only allowlisted categories and an HTTP status, never
  provider response bodies, request URLs or credentials.
- HTTP 402 has a specific provider-credits/billing message; authentication,
  permission and rate-limit failures also have actionable messages. Earned grades
  remain saved when generation fails. Restart the API to load these backend
  message changes; the token itself was already detected by the running stack.
- The pre-heist hint recognizes an already-connected test wallet.
- Loss copy explains that the independent judge did not confirm eligibility,
  rather than asserting that Caspy's conversational reply declined.
- Regression coverage verifies sanitized status handling and that billing failure
  preserves the grade while creating no artwork/metadata.

## Operator next step

Enable billing or add Inference Providers credits at
[Hugging Face billing](https://huggingface.co/settings/billing). Do not create a
new token solely for this 402: the configured token authenticated successfully.
After billing is ready, restart `bash run.sh` and run one explicit image
request. A full real candy mint/sale QA pass also needs a legitimately eligible
winning heist. All blockchain operations remain local test assets.
