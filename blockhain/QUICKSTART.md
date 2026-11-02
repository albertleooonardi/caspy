# Quick Start: CaspyHeist Smart Contract

Get up and running quickly.

## Setup

```bash
cd blockhain

# Copy environment
cp .env.example .env

# Install dependencies
forge install OpenZeppelin/openzeppelin-contracts

# Build
forge build
```

## Run Tests

```bash
# Solidity tests
forge test -vv

# Python tests
cd utils
pip install -r ../requirements.txt
pytest test_voucher_signer.py -v
```

## Deploy Locally

```bash
# Start Anvil in another terminal
anvil

# Deploy
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
```

## Deploy to Testnet

```bash
forge script script/Deploy.s.sol \
  --rpc-url https://sepolia.base.org \
  --broadcast
```

---

**Ready?** Run `forge test -vv` first! 🚀
