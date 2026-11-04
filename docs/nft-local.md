> Current v2: only winning prompts earn FLUX-generated graded candies; losses mint nothing. See [candy setup](candy.md) and PRD section 21. Treat/Trick v1 commands below are historical; use `bash run.sh` for v2.

# Caspy local NFT integration

The NFT work from `origin/dev-dapit` is connected to the Bifrost game. This
configuration is restricted to Anvil on loopback, chain **31337**. It does not
deploy to Base, spend real funds, or accept a production signer key.

## Run

Requires Python 3, Node 22+ and a root `.env` that passes
`python3 scripts/bifrost_setup.py check`. Stop an existing heist launcher or
frontend on ports 8000/4321, then run from the repository root:

```bash
bash run.sh
```

The launcher installs the pinned local contract tools if needed, builds the
contract, starts or reuses Anvil on `127.0.0.1:8545`, deploys or reuses the NFT
contract, and starts Bifrost, the game API, and Astro. First-time setup needs
network access to npm, GitHub and the Solidity compiler distribution.

Open <http://localhost:4321/play>:

1. Create or sign in to your Caspy account at `/register` or `/login`.
2. Choose **Connect wallet**, select an available test account, then **Connect local test wallet**.
3. Choose **Start my heist** and send up to three prompts.
4. If judging is temporarily unavailable, use **Check judge again**. This
   retries judging the saved reply without another actor call or attempt.
5. Open your result, choose **Claim your Treat/Trick**, then **Mint local
   collectible**.
6. The confirmation displays your token ID and contract address after checking
   the contract's `MintWithVoucher` event.

The wallet picker offers Anvil's unlocked accounts starting with its third account, excluding wallets linked to other Caspy accounts. Anvil's first account
deploys the contract; its second account holds `SIGNER_ROLE`. There are no
private keys in the frontend, API configuration or model input. These unlocked
development accounts are exclusively for the local chain.

Ctrl+C stops the services started by the launcher. An existing Bifrost/Anvil
instance is left running. The default starts all four services. Use
`bash run.sh --ai-only` for the separate AI playground without blockchain
or NFT claims. `--nft` remains an alias for the default.

## What is connected

`Frontend → wallet sign-in → game API → Bifrost actor → separate judge →
server-owned outcome → EIP-712 voucher → CaspyHeist → confirmed mint event`.

- SIWE nonces expire after five minutes, are single-use, and bind to the wallet,
  origin and chain. Authentication cookies are rotated at sign-in and expire
  after six hours. Sign in again after an API restart to recover your game.
- One durable heist is allowed per wallet and contract deployment. Attempts
  are recorded before inference. Concurrent turns are rejected. An interrupted
  actor call with no response refunds the attempt; partial replies close the
  game without a claim. Completed replies with unavailable judging remain
  pending and can be reviewed again.
- Only finished `won`/`lost` sessions can get vouchers. The server chooses the
  recipient and tier: **Treat = 0, Trick = 1**. Client fields cannot change them.
- EIP-712 uses the deployed contract name, version `1`, chain ID, verifying
  contract, and the Solidity `uint256` voucher fields. The frontend calls the
  contract's six-argument `mintWithVoucher`, rather than the previous tuple ABI.
- The contract enforces expiry, recipient, signature, used-session protection,
  pause status and Treat cap. Mint accounting precedes the receiver callback,
  with a reentrancy guard. A judge result cannot invoke the signer or contract.
- Mint status is derived from verified contract events, not a browser success
  flag. A transaction must target this contract, wallet and session to be
  attached to a game. Reverted claims can be retried.

## Local state

All runtime files are ignored by Git:

- `data/anvil-state.json`: chain state, periodically saved and restored.
- `data/nft-local.json`: public local deployment settings; no signing key.
- `data/nft-games-*.json`: private game transcripts, outcomes, idempotency keys,
  vouchers and mint state, written atomically with mode 0600.

The deployment block hash identifies a local season, so a reset chain can start
a new season even if a contract address repeats. To reset, stop the launcher,
back up and move `data/anvil-state.json` out of the way, and run the launcher
again. Keep Bifrost's SQLite/config files intact. Old game snapshots remain as
local history. Bifrost/provider request logs have their own retention.

Local token metadata is served at `/api/metadata/treat/{tokenId}` or
`/api/metadata/trick/{tokenId}`, using Caspy's artwork. These localhost URLs are
for development; durable public metadata is a separate deployment task.

## Verify

```bash
cd blockhain
npm test
cd ..
python3 -m unittest discover -s scripts -p 'test_*.py'
CASPY_RUN_CHAIN_TESTS=1 python3 -m unittest discover -s scripts -p test_nft_integration.py -v
cd frontend
npm run check
npm test
PUBLIC_NFT_ENABLED=true npm run build
```

The opt-in suite starts a temporary Anvil instance on port 18545 and exercises
signed wallet authentication, both game outcomes, voucher tampering/replay,
wallet isolation, confirmed mints and durable game recovery. Add
`CASPY_LIVE_AI_TEST=1` to also play through the real configured Bifrost models
and mint its resulting collectible. That test requires a running Bifrost and
available provider quota; other game tests use deterministic AI fixtures.

The optional Python signer can be checked separately:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r blockhain/requirements.txt
.venv/bin/python -m pytest blockhain/utils/test_voucher_signer.py
```

Running the chain suite with `.venv/bin/python` additionally verifies that a
voucher from dev-dapit's Python signer is accepted by the Solidity contract.
The local application itself uses the shared viem typed-data definition.

Public deployment still requires a production API/storage design, isolated
KMS signer, wallet/network configuration, public metadata, and the remaining
production eligibility and abuse controls described in the PRD.
