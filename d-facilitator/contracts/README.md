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

### Constructor Parameters

```solidity
constructor(
    address expectedAuthor,           // Your workflow owner address
    bytes10 expectedWorkflowName,      // Your workflow name (e.g., "d-settle")
    address _keystoneForwarderAddress, // KeystoneForwarder address
    bytes32 _expectedWorkflowId        // Your specific workflow ID
)
```

### Example Deployment

```solidity
// Sepolia Testnet
address keystoneForwarder = 0x15fC6ae953E024d975e77382eEeC56A9101f9F88;
address workflowOwner = 0xYourWorkflowOwnerAddress;
bytes10 workflowName = "d-settle";
bytes32 workflowId = 0xYourWorkflowId;

SettlementReceiver receiver = new SettlementReceiver(
    workflowOwner,
    workflowName,
    keystoneForwarder,
    workflowId
);
```

## KeystoneForwarder Addresses

- **Ethereum Sepolia**: `0x15fC6ae953E024d975e77382eEeC56A9101f9F88`
- **Other networks**: Check Chainlink CRE documentation

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
