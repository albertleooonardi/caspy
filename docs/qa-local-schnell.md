# Local FLUX.1-schnell QA — 2026-11-03

## Setup verified

- Apple M3, 8 GiB unified memory.
- Isolated `.venv-flux`, Python 3.14, MFLUX 0.24.0, MLX 0.32.4.
- Public quantized checkpoint: `mflux-community/flux-1-schnell-mflux-q4`, revision
  `df1dada0a0e25bb8df6e1f7e4664959bf9ab86ce`, approximately 8.95 GiB.
- All 17 selected checkpoint/tokenizer files downloaded. `ready.json` records
  expected file sizes; missing files cannot be reported as configured.
- Root `.env` selects `CASPY_IMAGE_BACKEND=local-schnell`.
- Generation uses the local checkpoint, four steps, 512×512, low-memory mode,
  a 0.5 GB MLX cache limit and a single job worker. No paid provider fallback.

## Real image test

The first offline render succeeded in 304.5 seconds. It produced a valid 512×512
PNG and a provenance report in ignored `data/qa/local-schnell-qa.json`.
Its cartoon outline/palette matched the requested general direction, but visual
review found a ghost silhouette instead of an edible candy. That sample is QA
material, not a game reward, grade, voucher or NFT.

The revised `caspy-candy-storybook-v2` art direction leads with a wrapped bonbon,
a round sugar body and two visible twisted wrapper ends. The fictional winning
story supplies flavor, colors and wrapper motifs. It retains purple outlines,
pastel shading, expressive eyes and a small witch hat. The source story appears
early enough to fit Schnell's short text context; the revised sample was measured at 204 tokens against a 256-token context.

Revised visual result: **passed**. The successful v2 sample is a round wrapped
candy with two purple twisted wrapper ends, an expressive face, a small purple
witch hat and pastel storybook shading. It took 249.43 seconds (about 4 minutes
9 seconds) at 512×512. The PNG SHA-256 is
`5ffde1c4dfe4bd097f29b59b8f754b1cb90906a3a8b3e06c880dcf741e5edb6d`.
Preview: ignored `data/qa/caspy-candy-preview.png`; detailed report:
`data/qa/local-schnell-qa-caspy-candy-storybook-v2.json`.

One earlier v2 attempt failed after 28.92 seconds without producing an image;
a retry of the same prompt/seed succeeded. The exact cause of that transient
worker failure was not established. The worker was observed using roughly
7.9 GB of memory during this experiment, so resource sensitivity is material.
This is a verified local demo path, not a latency or availability guarantee.

Exact likeness to the original Caspy mascot is not guaranteed: this version uses
text conditioning, not a trained reference LoRA. The 8 GB machine experiences
substantial memory pressure; observed first-render latency is about five minutes,
not an interactive image service. No claim is made that this hardware can serve
many simultaneous players.

## Checks

- Authentication, win/attempt limits, grades, commitments and local-chain
  marketplace integration passed the Python regression suite (58 tests,
  3 optional checks skipped before the final normalization tests were added).
- Local adapter tests verify fixed local model settings, offline Hub flags,
  removal of credentials including PRIVATE_KEY, no paid fallback, and missing
  checkpoint detection.
- PNG validation tests verify dimensions, nonblank content and removal of
  embedded prompt metadata.
- Frontend type checks, unit tests and production build passed during this work.
- These image QA renders do not create winning game state or mint NFTs.
  Real rewards still require an eligible independent win; failed, exploited,
  pending or void heists cannot generate a candy or obtain a voucher.

Local generation has no provider safety classifier. Metadata accurately records
`safety_checker: false`; it does not claim hosted safety filtering. Existing win
and exploit checks plus candy-only art direction remain in force.

## Run

Model setup is already complete in this workspace. Restart the user-managed app
with `bash run.sh` to load the new backend selection and code. On another
Apple Silicon Mac, first run `bash scripts/shell/setup-flux.sh`. To generate a separate visual
QA sample without creating a game reward, run `python3 scripts/qa_local_schnell.py`.
