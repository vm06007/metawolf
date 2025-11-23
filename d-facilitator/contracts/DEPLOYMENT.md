# Deployment Guide

This guide explains how to deploy the SettlementReceiver and ExecutionProxy contracts to various networks.

## Prerequisites

1. **Environment Setup**
   - Copy `.env.example` to `.env`
   - Add your `ALCHEMY_API_KEY` to `.env`
   - Add your `PRIVATE_KEY` to `.env` (the account that will deploy the contracts)

2. **Required Environment Variables**
   ```bash
   ALCHEMY_API_KEY=your-alchemy-api-key-here
   PRIVATE_KEY=your-private-key-here
   CHAIN_NAME=ethereum-testnet-sepolia  # Optional, can be overridden
   IS_SIMULATION=true  # Optional, can be overridden
   ```

## Quick Start

### Option 1: Using the Deployment Script (Recommended)

The `deploy.sh` script automatically loads environment variables from `.env` and constructs the correct RPC URLs.

**Deploy to Ethereum Sepolia:**
```bash
cd contracts
./deploy.sh eth_sepolia ethereum-testnet-sepolia
```

**Deploy to Ethereum Mainnet:**
```bash
./deploy.sh eth_mainnet ethereum-mainnet
```

**Deploy to Base Sepolia:**
```bash
./deploy.sh base_sepolia ethereum-testnet-sepolia-base-1
```

### Option 2: Manual Deployment

1. **Load environment variables:**
   ```bash
   source .env
   ```

2. **Set chain-specific variables:**
   ```bash
   export CHAIN_NAME="ethereum-testnet-sepolia"  # or "ethereum-mainnet" or "ethereum-testnet-sepolia-base-1"
   export IS_SIMULATION=true  # false for mainnet
   ```

3. **Run deployment:**
   ```bash
   # Ethereum Sepolia
   forge script script/Deploy.s.sol:Deploy \
     --rpc-url "https://eth-sepolia.g.alchemy.com/v2/$ALCHEMY_API_KEY" \
     --broadcast

   # Ethereum Mainnet
   forge script script/Deploy.s.sol:Deploy \
     --rpc-url "https://eth-mainnet.g.alchemy.com/v2/$ALCHEMY_API_KEY" \
     --broadcast

   # Base Sepolia
   forge script script/Deploy.s.sol:Deploy \
     --rpc-url "https://base-sepolia.g.alchemy.com/v2/$ALCHEMY_API_KEY" \
     --broadcast
   ```

## Dry-Run (Simulation)

To test deployments without broadcasting, run without the `--broadcast` flag:

```bash
# Test Ethereum Sepolia
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "https://eth-sepolia.g.alchemy.com/v2/$ALCHEMY_API_KEY"

# Test Ethereum Mainnet
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "https://eth-mainnet.g.alchemy.com/v2/$ALCHEMY_API_KEY"

# Test Base Sepolia
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "https://base-sepolia.g.alchemy.com/v2/$ALCHEMY_API_KEY"
```

## Network Configuration

### Supported Networks

| Network | Chain ID | Chain Name | Forwarder Address (Simulation) |
|---------|----------|------------|-------------------------------|
| Ethereum Sepolia | 11155111 | `ethereum-testnet-sepolia` | `0x15fC6ae953E024d975e77382eEeC56A9101f9F88` |
| Ethereum Mainnet | 1 | `ethereum-mainnet` | `0x0b93082D9b3C7C97fAcd250082899BAcf3af3885` |
| Base Sepolia | 84532 | `ethereum-testnet-sepolia-base-1` | `0xF8344CFd5c43616a4366C34E3EEE75af79a74482` |

### Expected Gas Costs (Dry-Run Estimates)

| Network | Chain ID | Gas Used | Estimated Cost | Status |
|---------|----------|----------|----------------|--------|
| Ethereum Sepolia | 11155111 | ~3,933,993 | ~0.0000045 ETH (~$0.01) | ✅ Tested |
| Ethereum Mainnet | 1 | ~3,934,008 | ~0.00083 ETH (~$2.50) | ✅ Tested |
| Base Sepolia | 84532 | ~3,934,008 | ~0.000027 ETH (~$0.10) | ✅ Tested |

*Note: Actual costs may vary based on current gas prices. All networks have been tested with dry-run deployments.*

### Dry-Run Results Summary

All three networks have been successfully tested with dry-run deployments:

**Ethereum Sepolia:**
- SettlementReceiver: `0x5555859AF999C900cfcCA05CdfBA3a4d70E2805A`
- ExecutionProxy: `0x2fA488978495a34a5d8FF4A80407b1261428B221`

**Ethereum Mainnet:**
- SettlementReceiver: `0x1687d4BDE380019748605231C956335a473Fd3dc`
- ExecutionProxy: `0xDF3201eB257FB75E57E394b53AA1A215025230Dc`

**Base Sepolia:**
- SettlementReceiver: `0x9b01CB34Ed5eea990f3FCF0cdedfb79fB974D090`
- ExecutionProxy: `0x5E0ec0c8Fa772f6B738A0Eceb4a0Ee210143F879`

*Note: These are simulated addresses from dry-run. Actual addresses will differ when broadcasting.*

## Deployment Steps

The deployment script performs the following steps:

1. **Deploy SettlementReceiver**
   - Deploys with no constructor parameters
   - Owner is set to the deployer address

2. **Configure SettlementReceiver**
   - Adds KeystoneForwarder address
   - Adds ExpectedWorkflowId
   - Adds ExpectedAuthor
   - Adds ExpectedWorkflowName

3. **Deploy ExecutionProxy**
   - Deploys with SettlementReceiver as authorized caller

4. **Link Contracts**
   - Sets ExecutionProxy address in SettlementReceiver

## Contract Addresses

After deployment, the script outputs:

```
=== Deployment Summary ===
SettlementReceiver: 0x...
ExecutionProxy: 0x...
Forwarder: 0x...
Chain: ethereum-testnet-sepolia
Environment: Simulation
==========================

=== Configuration for workflow ===
settlementReceiverAddress: 0x...
================================
```

Save these addresses for your workflow configuration.

## Verification (Optional)

To verify contracts on Etherscan, add verification flags:

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "https://eth-sepolia.g.alchemy.com/v2/$ALCHEMY_API_KEY" \
  --broadcast \
  --verify \
  --etherscan-api-key YOUR_ETHERSCAN_API_KEY
```

## Post-Deployment Configuration

After deployment, you may need to:

1. **Update workflow configuration** with the deployed `settlementReceiverAddress`
2. **Add additional authorized forwarders** if needed:
   ```solidity
   settlementReceiver.addKeystoneForwarder(newForwarderAddress);
   ```
3. **Add additional workflow IDs** if needed:
   ```solidity
   settlementReceiver.addExpectedWorkflowId(newWorkflowId);
   ```
4. **Transfer ownership** if needed:
   ```solidity
   settlementReceiver.transferOwnership(newOwnerAddress);
   ```

## Troubleshooting

### Error: ALCHEMY_API_KEY not set
- Ensure `.env` file exists and contains `ALCHEMY_API_KEY`
- Or export it: `export ALCHEMY_API_KEY="your-key"`

### Error: PRIVATE_KEY not set
- Add `PRIVATE_KEY` to `.env` file
- Or export it: `export PRIVATE_KEY="your-key"`

### Error: Insufficient funds
- Ensure your deployer account has enough ETH to cover gas costs
- Check the estimated costs in the dry-run output

### Error: Network not found
- Verify the RPC URL is correct
- Check that `ALCHEMY_API_KEY` is valid
- Ensure the network is accessible

## Security Notes

- **Never commit `.env` file** - It's already in `.gitignore`
- **Use separate keys for testnet and mainnet**
- **Verify all contract addresses** before using in production
- **Test thoroughly on testnets** before mainnet deployment

