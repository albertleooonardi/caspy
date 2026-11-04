> Current v2: only winning prompts earn FLUX-generated graded candies; losses mint nothing. See [candy setup](../docs/candy.md) and PRD section 21. Treat/Trick v1 commands below are historical; use `bash run.sh` for v2.

# Caspy's Heist Smart Contracts

Solidity contracts for the Caspy's Prompt Heist NFT game. Implements ERC-721 with EIP-712 signed vouchers for secure, authorized minting.

## Overview

- **CaspyHeist.sol**: Main ERC-721 contract with access control, pausing, and EIP-712 voucher verification
- **Security Model**: LLM never holds mint authority; all mints authorized by signed backend vouchers
- **Tier System**: Two NFT tiers (Treat and Trick) with configurable supply caps
- **One Mint Per Session**: Replay protection via session ID tracking

## Caspy game integration

From the repository root, run `bash run.sh` and open
<http://localhost:4321/play>. Connect the local test wallet, play the heist,
and claim the server-confirmed Treat or Trick. See the
[local NFT integration guide](../docs/nft-local.md).

The launcher pins OpenZeppelin 4.9.6 and Solidity 0.8.28, installs the test
library, and deploys to local Anvil (31337). The signer is an unlocked local
test account; no private key is needed by the application.

## Quick Start

### Prerequisites

- Node.js 22+ (the pinned npm packages provide Forge and Anvil)

### Setup

```bash
cd blockhain

# Install dependencies
npm ci
git clone --depth 1 --branch v1.9.7 https://github.com/foundry-rs/forge-std.git lib/forge-std

# Build
npm run build

# Run tests
npm run test:verbose
```

## Architecture

### CaspyHeist Contract

**Key Functions:**

- `mintWithVoucher(to, tier, sessionId, nonce, deadline, signature)` — Mint by providing EIP-712 signed voucher
- `setBaseURI(newURI)` — Update metadata base URI
- `setSigner(address)` — Rotate signer role
- `pause() / unpause()` — Emergency pause

**Tiers:**

- `TIER_TREAT (0)`: Rare NFT, supply-capped
- `TIER_TRICK (1)`: Common NFT, unlimited

## Testing

```bash
# All tests
npm test

# Specific test
npm exec -- forge test --match-test test_Deploy_InitialState -vv

# Python voucher signer tests
cd utils
pytest test_voucher_signer.py -v
```

## License

MIT
