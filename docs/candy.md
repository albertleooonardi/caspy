# Prompt-generated candy

Run `bash run.sh` from the project root. It starts the frontend on
http://localhost:4321, Python API, Bifrost and local Anvil blockchain.
Node/npm are loaded from nvm when available. No real ETH is used.

1. Run the one-time local setup on an Apple Silicon Mac:
   ```sh
   bash scripts/shell/setup-flux.sh
   ```
   This installs an isolated MFLUX 0.24.0 runtime and downloads the pinned public
   `mflux-community/flux-1-schnell-mflux-q4` checkpoint (~9 GiB). It requires Python
   3.11+ (the setup uses 3.14 via uv), roughly 12 GiB free for initial model setup,
   and additional free space for macOS swap. It never calls a paid image API.
2. Set root `.env` to `CASPY_IMAGE_BACKEND=local-schnell` (already selected for
   this workspace), then restart the app. Images are generated offline at
   512×512, four steps, one job at a time with low-memory mode. No HF inference
   credits are required. An 8 GB Mac may take several minutes per image or run
   out of memory; close other heavy apps. A failed generation earns no mintable
   image and preserves its recorded grade. The image is not upscaled and
   represented as a native 1024-pixel result.

   Optional hosted alternative: explicitly select `CASPY_IMAGE_BACKEND=hf-dev`,
   install `.venv/bin/python -m pip install -r scripts/requirements-candy.txt`,
   and configure HF_TOKEN plus provider credits. There is **no automatic paid
   fallback** if local generation fails.
3. Register/sign in and connect an available local test wallet before playing.
4. Win by persuading Caspy within three prompts. Open the result, inspect its
   grade, and explicitly authorize sending the redacted winning prompt to the
   selected generator. No win means no image entitlement or NFT.
5. Generate one candy, then mint that exact artwork. Image creation uses
   compute locally (or credits only in explicit hosted mode); minting uses local test ETH. The app saves jobs so you can return later.
6. Open Collection, reveal your prompt, choose a fixed test-ETH price and review
   the prompt license. Confirm license, approve NFT escrow, and list.
7. A different registered account with its own linked test wallet can buy from
   Marketplace. The source prompt becomes available to that verified NFT owner.
   The seller withdraws credited proceeds from Collection or Marketplace.

## Rules and state

One NFT per wallet and session per deployment. Hard cap 1,000. The judge assesses
creativity/coherence/specificity, each 0–20; the server adds collection-relative
text novelty 0–40. C <60, B 60–74, A 75–89, S 90–100. No grade is drawn randomly.
The score is an experimental assessment, not a universal originality measure.

Local setup missing: the earned grade stays saved with a setup message. Generation
failure: the grade stays fixed; an explicit local retry uses local compute. Hosted
retries may incur another charge. At most
three requests per candy and `CASPY_FLUX_DAILY_LIMIT` per UTC day (default 10).
A successful artwork cannot be rerolled. Interrupted requests are not retried
automatically. Check the saved result after returning to the page.

Public artwork/metadata live in ignored `data/candy-assets`; private redacted
source prompts/jobs live in ignored `data/platform.sqlite3`. Preserve both with
the local chain state. Metadata and token hashes commit the exact image, prompt,
score and manifest; source text is not published on-chain. Local HTTP token URIs
need the running app and are not durable public NFT hosting. Back up data before
resetting Anvil. Old v1 collectibles are preserved but not imported into v2.

Prompt access is non-exclusive; downloaded text cannot be recalled. NFT ownership
does not transfer copyright. Research dataset consent and licensing are separate.
The provider receives the redacted source for generation; automated redaction
cannot guarantee anonymity. Do not submit confidential information.

## Validation

```sh
export PATH="$HOME/.nvm/versions/node/v24.13.1/bin:$PATH"
.venv/bin/python -m unittest discover -s scripts -p 'test_*.py'
npm run test --prefix blockhain
.venv/bin/python -m pytest blockhain/utils/test_voucher_signer.py
CASPY_RUN_CHAIN_TESTS=1 .venv/bin/python -m unittest discover -s scripts -p test_nft_integration.py -v
npm run check --prefix frontend
npm run test --prefix frontend
npm run build --prefix frontend
```

Tests inject explicitly marked fixture PNGs; they never call a paid provider.
The hosted FLUX.1-dev smoke test returned HTTP 402 (billing). Local Schnell
verification is tracked separately in docs/qa-local-schnell.md. The hosted adapter
enables provider safety checking; the local adapter records that it has no such
classifier. Both strip embedded image metadata. This local implementation is
not a public-chain deployment or a guarantee of production readiness.

Sources: [HF task documentation](https://huggingface.co/docs/inference-providers/tasks/text-to-image),
[FLUX.1-dev model card](https://huggingface.co/black-forest-labs/FLUX.1-dev),
[model license](https://huggingface.co/black-forest-labs/FLUX.1-dev/blob/main/LICENSE.md).
Model/weights rights and generated-output rights differ; check current hosted
provider authorization and applicable terms before commercial deployment.

## Caspy candy art direction

`caspy-candy-storybook-v2` requires an edible bonbon body with two visible twisted wrapper ends, a small
witch hat and face, with rounded
dark-purple outlines, cream/lavender pastel shading, expressive eyes, a tiny
witch hat and pumpkin accents. The winning user prompt supplies the candy’s
shape, flavor, wrapper and accessory theme. The fixed style prompt aims to match
the Caspy brand; it is text conditioning, not a trained mascot LoRA or a guarantee
of exact visual consistency. It does not replace a win gate or grading rule.

Local Schnell has no provider image safety classifier. The independent win/exploit
gate and candy-only art direction remain in place, and metadata accurately records
`safety_checker: false`. Public deployment needs an appropriate content-review
process. No claim of hosted safety checking is made for local images. PNG prompt
metadata is stripped before the content is stored publicly. Model/checkpoint
revision, quantization, actual step count and art-style version are recorded.

The local runtime runs with Hub/Transformers offline flags and telemetry disabled.
Runtime credentials are removed from its child environment; user prompts do not
go to a hosted image service. Model download is a separate, networked setup step.
