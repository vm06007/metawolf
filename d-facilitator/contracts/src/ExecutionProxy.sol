// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title ExecutionProxy - Executes arbitrary signed data with access control
/// @notice This contract can execute arbitrary calls but only when called by the authorized SettlementReceiver
contract ExecutionProxy {
    // The authorized SettlementReceiver contract address
    address public immutable authorizedCaller;

    // Events
    event ExecutionSucceeded(
        address indexed caller,
        address indexed target,
        bytes data,
        uint256 value,
        bool success,
        bytes result
    );
    
    event ExecutionFailed(
        address indexed caller,
        address indexed target,
        bytes data,
        uint256 value,
        string reason
    );

    // Custom errors
    error UnauthorizedCaller(address caller, address expected);
    error ExecutionReverted(bytes reason);

    /// @notice Constructor sets the authorized caller (SettlementReceiver)
    /// @param _authorizedCaller The SettlementReceiver contract address
    constructor(address _authorizedCaller) {
        if (_authorizedCaller == address(0)) {
            revert UnauthorizedCaller(address(0), _authorizedCaller);
        }
        authorizedCaller = _authorizedCaller;
    }

    /// @notice Executes arbitrary signed data
    /// @dev Only callable by the authorized SettlementReceiver contract
    /// @param target The target address to call
    /// @param data The calldata to send to the target
    /// @param value The amount of ETH to send with the call
    /// @return success Whether the execution succeeded
    /// @return result The return data from the execution
    function execute(
        address target,
        bytes calldata data,
        uint256 value
    ) external returns (bool success, bytes memory result) {
        // Only authorized caller (SettlementReceiver) can execute
        if (msg.sender != authorizedCaller) {
            revert UnauthorizedCaller(msg.sender, authorizedCaller);
        }

        // Validate target address
        if (target == address(0)) {
            emit ExecutionFailed(
                msg.sender,
                target,
                data,
                value,
                "ExecutionProxy: target address is zero"
            );
            return (false, "");
        }

        // Execute the call
        (success, result) = target.call{value: value}(data);

        if (success) {
            // Emit success event
            emit ExecutionSucceeded(
                msg.sender,
                target,
                data,
                value,
                true,
                result
            );
        } else {
            // Try to decode the revert reason
            string memory reason = "Unknown error";
            if (result.length > 0) {
                // Check if it's a custom error or a revert string
                if (result.length < 68) {
                    // Likely a revert string
                    assembly {
                        result := add(result, 0x04)
                    }
                    reason = string(result);
                } else {
                    // Custom error - extract the selector and data
                    reason = "Custom error";
                }
            }

            // Emit failure event
            emit ExecutionFailed(
                msg.sender,
                target,
                data,
                value,
                reason
            );
        }

        return (success, result);
    }

    /// @notice Executes arbitrary signed data with custom error handling
    /// @dev Only callable by the authorized SettlementReceiver contract
    /// @param target The target address to call
    /// @param data The calldata to send to the target
    /// @param value The amount of ETH to send with the call
    /// @return success Whether the execution succeeded
    /// @return result The return data from the execution
    function executeWithRevert(
        address target,
        bytes calldata data,
        uint256 value
    ) external returns (bool success, bytes memory result) {
        // Only authorized caller (SettlementReceiver) can execute
        if (msg.sender != authorizedCaller) {
            revert UnauthorizedCaller(msg.sender, authorizedCaller);
        }

        // Validate target address
        if (target == address(0)) {
            revert ExecutionReverted("ExecutionProxy: target address is zero");
        }

        // Execute the call
        (success, result) = target.call{value: value}(data);

        if (!success) {
            // Revert with the original error
            if (result.length > 0) {
                assembly {
                    let returndata_size := mload(result)
                    revert(add(32, result), returndata_size)
                }
            } else {
                revert ExecutionReverted("ExecutionProxy: call failed");
            }
        }

        // Emit success event
        emit ExecutionSucceeded(
            msg.sender,
            target,
            data,
            value,
            true,
            result
        );

        return (success, result);
    }

    /// @notice Receives ETH
    receive() external payable {
        // Allow contract to receive ETH for executing calls with value
    }
}

