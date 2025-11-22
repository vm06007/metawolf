# Forwarder Address Utilities

Utility functions for smart contract deployment and testing with CRE forwarder addresses per chain.

## Overview

CRE uses different forwarder addresses for:
- **Simulation**: MockKeystoneForwarder addresses for local testing (`cre workflow simulate --broadcast`)
- **Production**: KeystoneForwarder addresses for deployed workflows

This package provides utilities to get the correct forwarder address based on the chain and environment.

## Files

### Solidity

1. **`src/utils/ForwarderAddresses.sol`** - Library with forwarder addresses for all CRE-supported networks
2. **`test/utils/ForwarderHelper.sol`** - Test helper contract with common forwarder addresses
3. **`script/Deploy.s.sol`** - Deployment script that uses forwarder addresses

### TypeScript

4. **`script/utils/forwarderAddresses.ts`** - TypeScript utilities for deployment scripts

## Usage

### Solidity - In Contracts

```solidity
import {ForwarderAddresses} from "./utils/ForwarderAddresses.sol";

// Get simulation forwarder for Sepolia
address forwarder = ForwarderAddresses.getSimulationForwarder("ethereum-testnet-sepolia");

// Get production forwarder
address forwarder = ForwarderAddresses.getProductionForwarder("ethereum-testnet-sepolia");

// Get based on environment
bool isSimulation = true; // or false for production
address forwarder = ForwarderAddresses.getForwarder("ethereum-testnet-sepolia", isSimulation);
```

### Solidity - In Tests

```solidity
import {ForwarderHelper} from "./utils/ForwarderHelper.sol";

contract MyTest is Test {
    ForwarderHelper helper = new ForwarderHelper();
    
    function testSomething() public {
        // Get forwarder for a specific chain
        address forwarder = helper.getSimulationForwarder("ethereum-testnet-sepolia");
        
        // Or use common constants
        address sepoliaForwarder = ForwarderHelper.SEPOLIA_SIMULATION_FORWARDER;
    }
}
```

### TypeScript - In Deployment Scripts

```typescript
import { getForwarder, getSimulationForwarder, getProductionForwarder } from "./script/utils/forwarderAddresses";

// Get forwarder for deployment
const chainName = "ethereum-testnet-sepolia";
const isSimulation = process.env.NODE_ENV === "development";
const forwarder = getForwarder(chainName, isSimulation);

// Or use specific functions
const simForwarder = getSimulationForwarder("ethereum-testnet-sepolia");
const prodForwarder = getProductionForwarder("ethereum-testnet-sepolia");

// Common forwarders for quick access
import { COMMON_FORWARDERS } from "./script/utils/forwarderAddresses";
const sepoliaSim = COMMON_FORWARDERS.sepolia.simulation;
```

### Deployment Script

Use the provided `Deploy.s.sol` script:

```bash
# Set environment variables
export CHAIN_NAME="ethereum-testnet-sepolia"
export IS_SIMULATION=true
export PRIVATE_KEY="your-private-key"

# Deploy
forge script script/Deploy.s.sol:Deploy --broadcast --rpc-url $RPC_URL
```

Or modify the script to set your workflow configuration:

```solidity
// Update these constants in Deploy.s.sol
address constant DEFAULT_EXPECTED_AUTHOR = address(0x...);
bytes10 constant DEFAULT_EXPECTED_WORKFLOW_NAME = "d-settlement";
bytes32 constant DEFAULT_EXPECTED_WORKFLOW_ID = bytes32(...);
```

## Supported Networks

### Mainnets
- Arbitrum One: `ethereum-mainnet-arbitrum-1`
- Avalanche: `avalanche-mainnet`
- Base: `ethereum-mainnet-base-1`
- BNB Smart Chain: `binance_smart_chain-mainnet`
- Ethereum: `ethereum-mainnet`
- OP Mainnet: `ethereum-mainnet-optimism-1`
- Polygon: `polygon-mainnet`

### Testnets
- Arbitrum Sepolia: `ethereum-testnet-sepolia-arbitrum-1`
- Avalanche Fuji: `avalanche-testnet-fuji`
- Base Sepolia: `ethereum-testnet-sepolia-base-1`
- BSC Testnet: `binance_smart_chain-testnet`
- Ethereum Sepolia: `ethereum-testnet-sepolia`
- OP Sepolia: `ethereum-testnet-sepolia-optimism-1`
- Polygon Amoy: `polygon-testnet-amoy`

## Important Notes

1. **Always use simulation addresses for local testing** - Use `getSimulationForwarder()` when running `cre workflow simulate --broadcast`

2. **Use production addresses for mainnet** - Use `getProductionForwarder()` when deploying to production

3. **Update forwarder in contract when switching environments** - If you deploy with simulation forwarder, update it to production forwarder before going to mainnet

4. **Forwarder addresses are different per chain** - Each network has its own forwarder address

## Example: Deploying SettlementReceiver

```solidity
// In your deployment script
import {ForwarderAddresses} from "../src/utils/ForwarderAddresses.sol";

string memory chainName = "ethereum-testnet-sepolia";
bool isSimulation = true; // Set to false for production

address forwarder = ForwarderAddresses.getForwarder(chainName, isSimulation);

SettlementReceiver receiver = new SettlementReceiver(
    expectedAuthor,
    expectedWorkflowName,
    forwarder,
    expectedWorkflowId
);
```

## Testing

The test utilities make it easy to use the correct forwarder:

```solidity
contract SettlementReceiverTest is Test {
    using ForwarderHelper for address;
    
    function test_WithCorrectForwarder() public {
        address forwarder = ForwarderHelper.SEPOLIA_SIMULATION_FORWARDER;
        // ... test with forwarder
    }
}
```

## References

- [CRE Supported Networks Documentation](https://docs.chain.link/cre/guides/workflow/using-evm-client/supported-networks)
- [Onchain Write Overview](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write)
- [Configuring Permissions](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/building-consumer-contracts#configuring-permissions)

