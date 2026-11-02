# Caspy's Heist Smart Contracts

Solidity contracts for the Caspy's Prompt Heist NFT game. Implements ERC-721 with EIP-712 signed vouchers for secure, authorized minting.

## Overview

- **CaspyHeist.sol**: Main ERC-721 contract with access control, pausing, and EIP-712 voucher verification
- **Security Model**: LLM never holds mint authority; all mints authorized by signed backend vouchers
- **Tier System**: Two NFT tiers (Treat and Trick) with configurable supply caps
- **One Mint Per Session**: Replay protection via session ID tracking

## Quick Start

### Prerequisites

- Foundry ([install](https://book.getfoundry.sh/getting-started/installation))

### Setup

```bash
cd blockhain

# Install dependencies
forge install OpenZeppelin/openzeppelin-contracts

# Build
forge build

# Run tests
forge test -vv
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
forge test

# Specific test
forge test -k "test_Deploy_InitialState" -vv

# Python voucher signer tests
cd utils
pytest test_voucher_signer.py -v
```

## License

MIT
