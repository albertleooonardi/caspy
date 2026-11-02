# Prompt-generated candy

Run `bash run-heist.sh` from the project root. It starts the frontend on
http://localhost:4321, Python API, Bifrost and local Anvil blockchain.
Node/npm are loaded from nvm when available. No real ETH is used.

1. Install hosted-image dependencies once:
   ```sh
   python3 -m venv .venv
   .venv/bin/python -m pip install -r scripts/requirements-candy.txt
   ```
2. Add `HF_TOKEN` to root `.env` (never frontend env), with Hugging Face
   Inference Providers permission and provider credits. The model is
   `black-forest-labs/FLUX.1-dev`, routed through fal-ai. Account/provider access
   and current service terms must permit your intended use.
3. Register/sign in and connect an available local test wallet before playing.
4. Win by persuading Caspy within three prompts. Open the result, inspect its
   grade, and explicitly authorize sending the redacted winning prompt to the
   provider. No win means no image entitlement or NFT.
5. Generate one candy, then mint that exact artwork. Image creation uses provider
   credits; minting uses local test ETH. The app saves jobs so you can return later.
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

HF missing: earned grade remains saved, with a configuration message. Provider
failure: grade remains fixed; an explicit retry may incur another charge. At most
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
A real FLUX image smoke test is pending HF_TOKEN and credits. The adapter enables
provider safety checking and strips image metadata. This local implementation is
not a public-chain deployment or a guarantee of production readiness.

Sources: [HF task documentation](https://huggingface.co/docs/inference-providers/tasks/text-to-image),
[FLUX.1-dev model card](https://huggingface.co/black-forest-labs/FLUX.1-dev),
[model license](https://huggingface.co/black-forest-labs/FLUX.1-dev/blob/main/LICENSE.md).
Model/weights rights and generated-output rights differ; check current hosted
provider authorization and applicable terms before commercial deployment.
