# Quick Start: CaspyHeist Smart Contract

Get up and running in 5 minutes.

## 1. Prerequisites

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install Python (if using voucher signer)
python3 --version  # 3.9+

# Check Node.js (for linting, optional)
node --version
```

## 2. Setup Local Development

```bash
cd blockhain

# Copy environment
cp .env.example .env
# Edit .env with your private key (for testing, use Anvil's default)

# Install dependencies
forge install OpenZeppelin/openzeppelin-contracts

# Build
forge build

# Start Anvil in another terminal
anvil
```

## 3. Run Tests

```bash
# All tests
forge test

# Verbose output
forge test -vv

# Single test
forge test -k "test_MintWithVoucher_AsPlayer" -vv

# With gas report
forge test --gas-report
```

## 4. Deploy Locally

```bash
# In another terminal with Anvil running
forge script script/Deploy.s.sol \
  --rpc-url http://localhost:8545 \
  --broadcast

# Copy the deployed contract address
# It will be in the output as "CaspyHeist deployed at: 0x..."
```

## 5. Test Voucher Signer

```bash
cd utils

# Install Python dependencies
pip install -r ../requirements.txt

# Create and verify a voucher
python3 voucher_signer.py \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb476cad3623065be2f4ac1e9c84d \
  --contract <DEPLOYED_CONTRACT_ADDRESS> \
  --chain-id 31337 \
  --recipient 0xabababababababababababababababababababab \
  --tier 0 \
  --session-id 0x0000000000000000000000000000000000000000000000000000000000000001 \
  --verify \
  --json
```

## Common Commands

### Build
```bash
forge build              # Compile
forge clean              # Clear artifacts
forge fmt                # Format code
```

### Test
```bash
forge test               # Run all tests
forge test -k <name>    # Run matching test
forge test -vv          # Verbose output
forge test --gas-report # Gas usage
forge coverage           # Coverage report
```

### Deploy
```bash
# Compile only
forge build

# Simulate (dry run)
forge script script/Deploy.s.sol --rpc-url <RPC>

# Deploy (broadcast)
forge script script/Deploy.s.sol --rpc-url <RPC> --broadcast

# Deploy with verification
forge script script/Deploy.s.sol --rpc-url <RPC> --broadcast --verify
```

---

**Ready to go?** Start with `forge test -vv` and deploy to testnet when tests pass! 🚀
