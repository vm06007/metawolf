# Settlement Receiver Contract

A secure consumer contract for receiving settlement reports from Chainlink CRE workflows.

## Security Features

This contract implements the **most secure recommended pattern** with multiple layers of validation:

1. **Forwarder Address Validation**: Only accepts reports from the trusted Chainlink KeystoneForwarder contract
2. **Workflow ID Validation**: Only accepts reports from a specific workflow instance
3. **Workflow Owner Validation**: Validates the workflow owner address (from IReceiverTemplate)
4. **Workflow Name Validation**: Validates the workflow name (from IReceiverTemplate)

## Contract Structure

```
contracts/
├── src/
│   ├── keystone/
│   │   ├── IERC165.sol          # ERC165 interface
│   │   ├── IReceiver.sol         # Receiver interface
│   │   └── IReceiverTemplate.sol # Base template with validation
│   └── SettlementReceiver.sol    # Main consumer contract
└── test/
    └── SettlementReceiver.t.sol  # Comprehensive tests
```

## Deployment

**📖 For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md)**

### Quick Start

1. **Setup environment:**
   ```bash
   cp .env.example .env
   # Add your ALCHEMY_API_KEY and PRIVATE_KEY to .env
   ```

2. **Deploy using the script:**
   ```bash
   # Ethereum Sepolia
   ./deploy.sh eth_sepolia ethereum-testnet-sepolia
   
   # Ethereum Mainnet
   ./deploy.sh eth_mainnet ethereum-mainnet
   
   # Base Sepolia
   ./deploy.sh base_sepolia ethereum-testnet-sepolia-base-1
   ```

### Deployed Contracts

#### Ethereum Sepolia (Chain ID: 11155111)

**Deployment Date:** 2025-01-22  
**Deployer:** `0x46e0d7556C38E6b5Dac66D905814541723A42176`

| Contract | Address | Transaction Hash |
|----------|---------|------------------|
| **SettlementReceiver** | [`0xA02539DFb35bF1561d19061F5975bBfAC85b2031`](https://sepolia.etherscan.io/address/0xA02539DFb35bF1561d19061F5975bBfAC85b2031) | [`0xe3699ebace0d8bb4f3ad0ddbc49ca5f754d4da412abd4205d9995c20cb95fa87`](https://sepolia.etherscan.io/tx/0xe3699ebace0d8bb4f3ad0ddbc49ca5f754d4da412abd4205d9995c20cb95fa87) |
| **ExecutionProxy** | [`0xdDc178F24094480Fa2f20efE0a05cB6687456Fab`](https://sepolia.etherscan.io/address/0xdDc178F24094480Fa2f20efE0a05cB6687456Fab) | [`0x079563dc0685f9a7968281407185f3d72b9d862c30f28c4bddc2d57eac2adfca`](https://sepolia.etherscan.io/tx/0x079563dc0685f9a7968281407185f3d72b9d862c30f28c4bddc2d57eac2adfca) |

**Configuration:**
- **Forwarder Address:** `0x15fC6ae953E024d975e77382eEeC56A9101f9F88` (Chainlink KeystoneForwarder for Ethereum Sepolia Simulation)
- **Expected Author:** `0x1234567890123456789012345678901234567890` (⚠️ Update this to your actual CRE workflow owner)
- **Expected Workflow Name:** `d-settle`
- **Expected Workflow ID:** `0x1234567890123456789012345678901234567890123456789012345678901234` (⚠️ Update this to your actual workflow ID)

**Gas Costs:**
- SettlementReceiver deployment: 1,941,866 gas (~0.00000234 ETH)
- ExecutionProxy deployment: 733,852 gas (~0.00000088 ETH)
- **Total:** 2,675,718 gas (~0.00000322 ETH)

**⚠️ Important:** After deployment, update the workflow configuration in `d-settlement/config.staging.json`:
```json
{
  "settlementReceiverAddress": "0xA02539DFb35bF1561d19061F5975bBfAC85b2031",
  "executionProxyAddress": "0xdDc178F24094480Fa2f20efE0a05cB6687456Fab"
}
```

### Configuration

The contracts use **array-based configuration** - all parameters are added via setter functions after deployment:

- `addKeystoneForwarder(address)` - Add authorized forwarder
- `addExpectedWorkflowId(bytes32)` - Add authorized workflow ID
- `addExpectedAuthor(address)` - Add authorized workflow owner
- `addExpectedWorkflowName(bytes10)` - Add authorized workflow name

This allows multiple forwarders, workflow IDs, authors, and names to be authorized.

## Supported Networks

### Testnets
- **Ethereum Sepolia** (Chain ID: 11155111)
- **Base Sepolia** (Chain ID: 84532)

### Mainnets
- **Ethereum Mainnet** (Chain ID: 1)

### KeystoneForwarder Addresses

See [ForwarderAddresses.sol](./src/utils/ForwarderAddresses.sol) for all supported networks and addresses.

## Workflow Integration

In your CRE workflow, use the `cre.report()` function to send data to this contract:

```typescript
// In your workflow
const reportData = abi.encode(
    payerAddress,
    payeeAddress,
    amount,
    success
);

runtime.report(reportData);
```

## Customization

To implement your settlement logic, modify the `_processReport` function in `SettlementReceiver.sol`:

```solidity
function _processReport(bytes calldata report) internal override {
    // Decode your report data
    (address payer, address payee, uint256 amount, bool success) = 
        abi.decode(report, (address, address, uint256, bool));
    
    // Your settlement logic here
    // e.g., update balances, emit events, etc.
    
    emit SettlementProcessed(payer, payee, amount, success);
}
```

## Testing

Run the test suite:

```bash
forge test
```

Run with verbose output:

```bash
forge test -vvv
```

## Security Considerations

1. **Never deploy with zero addresses** - The constructor validates the forwarder address
2. **Keep workflow ID secret** - Only share it with trusted parties
3. **Verify workflow owner** - Ensure the expectedAuthor matches your CRE account
4. **Test thoroughly** - Use the provided test suite before mainnet deployment

## Building

```bash
forge build
```

## License

MIT
