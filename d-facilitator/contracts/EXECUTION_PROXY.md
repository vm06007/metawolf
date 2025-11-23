# ExecutionProxy Contract

A secure contract for executing arbitrary signed data with access control restricted to the SettlementReceiver contract.

## Overview

The `ExecutionProxy` contract provides a secure way to execute arbitrary calls on any target contract, but only when called by the authorized `SettlementReceiver` contract. This ensures that execution only happens after all security validations have passed in the SettlementReceiver.

## Security Features

1. **Access Control**: Only the authorized `SettlementReceiver` contract can call `execute()`
2. **Event Logging**: Emits events for both successful and failed executions
3. **Error Handling**: Gracefully handles execution failures and emits error events
4. **ETH Support**: Can receive and forward ETH with calls

## Contract Structure

```
ExecutionProxy
├── authorizedCaller (immutable) - The SettlementReceiver address
├── execute() - Main execution function
├── executeWithRevert() - Alternative execution that reverts on failure
└── receive() - Allows contract to receive ETH
```

## Functions

### `execute(address target, bytes calldata data, uint256 value)`

Executes an arbitrary call and returns success status without reverting.

**Parameters:**
- `target`: The target contract address to call
- `data`: The calldata to send
- `value`: The amount of ETH to send (in wei)

**Returns:**
- `success`: Boolean indicating if execution succeeded
- `result`: The return data from the execution

**Events:**
- `ExecutionSucceeded`: Emitted on both success and failure
- `ExecutionFailed`: Emitted only on failure with error reason

### `executeWithRevert(address target, bytes calldata data, uint256 value)`

Executes an arbitrary call and reverts if execution fails.

**Parameters:**
- Same as `execute()`

**Returns:**
- `success`: Always true (reverts on failure)
- `result`: The return data from the execution

**Events:**
- `ExecutionSucceeded`: Emitted only on success

## Events

### `ExecutionSucceeded`
```solidity
event ExecutionSucceeded(
    address indexed caller,
    address indexed target,
    bytes data,
    uint256 value,
    bool success,
    bytes result
);
```
Emitted for every execution attempt, regardless of success or failure.

### `ExecutionFailed`
```solidity
event ExecutionFailed(
    address indexed caller,
    address indexed target,
    bytes data,
    uint256 value,
    string reason
);
```
Emitted only when execution fails, includes the error reason.

## Usage Example

### In SettlementReceiver

```solidity
function _processReport(bytes calldata report) internal override {
    // Decode report containing execution data
    (address target, bytes memory data, uint256 value) = 
        abi.decode(report, (address, bytes, uint256));
    
    // Execute through ExecutionProxy
    (bool success, bytes memory result) = executeSignedData(target, data, value);
    
    if (!success) {
        // Handle failure
    }
}
```

## Deployment

1. Deploy `SettlementReceiver` first
2. Deploy `ExecutionProxy` with SettlementReceiver address:
   ```solidity
   ExecutionProxy proxy = new ExecutionProxy(address(settlementReceiver));
   ```
3. Set ExecutionProxy in SettlementReceiver (owner only):
   ```solidity
   settlementReceiver.setExecutionProxy(address(proxy));
   ```

## Security Considerations

1. **Immutable Authorization**: The `authorizedCaller` is set at deployment and cannot be changed
2. **Zero Address Check**: Validates target address is not zero
3. **Event Logging**: All executions are logged for monitoring and auditing
4. **Error Handling**: Failures don't revert the entire transaction, allowing for graceful handling

## Testing

Run the test suite:

```bash
forge test --match-contract ExecutionProxyTest -vv
```

All 8 tests pass, covering:
- Constructor validation
- Unauthorized caller rejection
- Zero address handling
- Successful execution
- Execution with ETH value
- Execution failures
- Return value handling
- ETH receiving

## Integration with SettlementReceiver

The ExecutionProxy is designed to be called from `SettlementReceiver._processReport()`, which ensures:

1. ✅ Report came from KeystoneForwarder
2. ✅ Workflow ID matches
3. ✅ Workflow owner matches
4. ✅ Workflow name matches
5. ✅ Only then can execution happen

This multi-layer validation ensures maximum security for executing arbitrary signed data.

