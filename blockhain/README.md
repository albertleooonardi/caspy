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
- Node.js (for Solhint linting, optional)

### Setup

```bash
cd blockhain

# Install dependencies
forge install OpenZeppelin/openzeppelin-contracts

# Build
forge build

# Run tests
forge test -vv

# Coverage report
forge coverage
```

## Deployment

### Local (Anvil)

```bash
# Start anvil in one terminal
anvil

# Deploy to local network
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb476cad3623065be2f4ac1e9c84d \
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
```

### Base Sepolia (Testnet)

```bash
export PRIVATE_KEY=<your-private-key>
export SIGNER_ADDRESS=<backend-signer-address>

forge script script/Deploy.s.sol \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  --verify
```

### Base Mainnet

```bash
export PRIVATE_KEY=<your-private-key>
export SIGNER_ADDRESS=<backend-signer-address>
export ETHERSCAN_API_KEY=<basescan-api-key>

forge script script/Deploy.s.sol \
  --rpc-url https://mainnet.base.org \
  --broadcast \
  --verify
```

## Architecture

### CaspyHeist Contract

**Key Functions:**

- `mintWithVoucher(to, tier, sessionId, nonce, deadline, signature)` — Mint by providing EIP-712 signed voucher
- `setBaseURI(newURI)` — Update metadata base URI (until frozen)
- `freezeBaseURI()` — Permanently lock metadata URI
- `setSigner(address)` — Rotate signer role
- `setTreatSupply(uint256)` — Update Treat supply cap
- `pause() / unpause()` — Emergency pause

**Tiers:**

- `TIER_TREAT (0)`: Rare NFT, supply-capped (default 1,000)
- `TIER_TRICK (1)`: Common NFT, unlimited

## Testing

```bash
# All tests
forge test

# Specific test
forge test -k "test_MintWithVoucher_AsPlayer" -vv

# With gas report
forge test --gas-report

# Coverage
forge coverage --report lcov
```

## Security Checklist

- [ ] Contract verified on Basescan
- [ ] All tests passing with 100% coverage
- [ ] Admin roles assigned to multisig (not EOA)
- [ ] Base URI set and frozen
- [ ] Signer key in KMS (not in env)
- [ ] Incident response runbook created

## License

MIT
