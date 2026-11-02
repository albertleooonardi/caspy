# Run Caspy with local NFTs

From the repository root:

```bash
bash run-heist.sh --nft
```

Open <http://localhost:4321/play>, connect the local test wallet, play up to
three prompts, then claim your Treat or Trick. The launcher builds and deploys
CaspyHeist to local Anvil, chain 31337, and connects it to Bifrost and the game
API. There are no real funds or private keys to configure.

See [the local NFT guide](../docs/nft-local.md) for persistent state, test
commands, and how to start a fresh local season.

To run the contract tests after setup:

```bash
cd blockhain
npm test
```
