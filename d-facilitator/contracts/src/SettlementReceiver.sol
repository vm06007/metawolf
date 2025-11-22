// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { IReceiverTemplate } from "./keystone/IReceiverTemplate.sol";
import { Ownable } from "./utils/Ownable.sol";
import { ExecutionProxy } from "./ExecutionProxy.sol";

/// @title SettlementReceiver - Secure consumer contract for Chainlink CRE settlement reports
/// @notice This contract implements the most secure pattern with:
///   - Forwarder address validation
///   - Workflow ID validation
///   - Workflow owner and name validation (from IReceiverTemplate)
///   - Updatable configuration with owner access control
contract SettlementReceiver is IReceiverTemplate, Ownable {

    // Updatable security parameters
    address public keystoneForwarderAddress;
    bytes32 public expectedWorkflowId;
    
    // ExecutionProxy for executing arbitrary signed data
    address public executionProxy;

    // Custom errors
    error InvalidSender(address sender, address expected);
    error UnauthorizedWorkflow(bytes32 received, bytes32 expected);
    error InvalidAddress(address addr);
    error InvalidWorkflowId(bytes32 workflowId);

    // Events
    event KeystoneForwarderUpdated(address indexed oldForwarder, address indexed newForwarder);
    event WorkflowIdUpdated(bytes32 indexed oldWorkflowId, bytes32 indexed newWorkflowId);
    event ExpectedAuthorUpdated(address indexed oldAuthor, address indexed newAuthor);
    event ExpectedWorkflowNameUpdated(bytes10 indexed oldName, bytes10 indexed newName);
    event ExecutionProxyUpdated(address indexed oldProxy, address indexed newProxy);
    event ExecutionSucceeded(address indexed target, bytes data, uint256 value, bool success);

    /// @notice Constructor sets all security parameters
    /// @param expectedAuthor The expected workflow owner address
    /// @param expectedWorkflowName The expected workflow name (bytes10)
    /// @param _keystoneForwarderAddress The Chainlink KeystoneForwarder contract address
    /// @param _expectedWorkflowId The specific workflow ID to accept reports from
    constructor(
        address expectedAuthor,
        bytes10 expectedWorkflowName,
        address _keystoneForwarderAddress,
        bytes32 _expectedWorkflowId
    ) IReceiverTemplate(expectedAuthor, expectedWorkflowName) {
        if (_keystoneForwarderAddress == address(0)) {
            revert InvalidAddress(address(0));
        }
        keystoneForwarderAddress = _keystoneForwarderAddress;
        expectedWorkflowId = _expectedWorkflowId;
    }

    /// @notice Override to add forwarder and workflow ID checks before parent validation
    /// @param metadata Report metadata containing workflow information
    /// @param report The actual report data
    function onReport(
        bytes calldata metadata,
        bytes calldata report
    ) external override {
        // First check: Ensure the call is from the trusted KeystoneForwarder
        if (msg.sender != keystoneForwarderAddress) {
            revert InvalidSender(msg.sender, keystoneForwarderAddress);
        }

        // Second check: Validate workflow ID
        (bytes32 workflowId, , ) = _getWorkflowMetaData(metadata);
        if (workflowId != expectedWorkflowId) {
            revert UnauthorizedWorkflow(workflowId, expectedWorkflowId);
        }

        // Third check: Call parent validation for workflow owner/name validation
        _validateAndProcess(metadata, report);
    }

    /// @notice Extracts metadata from the onReport `metadata` parameter
    /// @param metadata The metadata bytes
    /// @return workflowId The workflow ID
    /// @return workflowOwner The workflow owner address
    /// @return workflowName The workflow name
    function _getWorkflowMetaData(
        bytes memory metadata
    ) internal pure returns (bytes32 workflowId, address workflowOwner, bytes10 workflowName) {
        assembly {
            // workflow_cid (workflowId) is at offset 32, size 32
            workflowId := mload(add(metadata, 32))
            // workflow_name is at offset 64, size 10
            workflowName := mload(add(metadata, 64))
            // workflow_owner is at offset 74, size 20 (shift right by 12 bytes)
            workflowOwner := shr(mul(12, 8), mload(add(metadata, 74)))
        }
    }

    /// @notice Processes the validated report
    /// @param report The ABI-encoded report data from the workflow
    /// @dev The report should contain: (address target, bytes data, uint256 value)
    function _processReport(bytes calldata report) internal override {
        // Decode the report containing execution data
        // Expected format: (address target, bytes data, uint256 value)
        (address target, bytes memory data, uint256 value) = abi.decode(report, (address, bytes, uint256));
        
        // Execute the signed data through ExecutionProxy
        // This will only succeed if ExecutionProxy is set and all validations passed
        (bool success, bytes memory result) = executeSignedData(target, data, value);
        
        // Handle execution result if needed
        // The ExecutionProxy already emits events, but you can add additional logic here
        if (!success) {
            // Execution failed - you can add custom error handling here
            // The ExecutionFailed event was already emitted by ExecutionProxy
        }
        
        // Optional: Emit additional events or perform other actions based on result
        // emit SettlementProcessed(target, data, value, success);
    }

    /// @notice Sets the ExecutionProxy address (owner only)
    /// @param _executionProxy The ExecutionProxy contract address
    function setExecutionProxy(address _executionProxy) external onlyOwner {
        if (_executionProxy != address(0) && _executionProxy.code.length == 0) {
            revert InvalidAddress(_executionProxy);
        }
        address oldProxy = executionProxy;
        executionProxy = _executionProxy;
        emit ExecutionProxyUpdated(oldProxy, _executionProxy);
    }

    /// @notice Executes arbitrary signed data through ExecutionProxy
    /// @dev Can be called from _processReport to execute validated signed data
    /// @param target The target address to call
    /// @param data The calldata to send to the target
    /// @param value The amount of ETH to send with the call
    /// @return success Whether the execution succeeded
    /// @return result The return data from the execution
    function executeSignedData(
        address target,
        bytes memory data,
        uint256 value
    ) internal returns (bool success, bytes memory result) {
        // Ensure ExecutionProxy is set
        if (executionProxy == address(0)) {
            revert InvalidAddress(address(0));
        }
        
        // Call ExecutionProxy to execute (ExecutionProxy will emit events)
        // Convert bytes memory to bytes calldata for the call
        (success, result) = ExecutionProxy(payable(executionProxy)).execute(target, data, value);
        
        // Emit additional event for SettlementReceiver tracking
        emit ExecutionSucceeded(target, data, value, success);
        
        return (success, result);
    }

    /// @notice Updates the KeystoneForwarder address (owner only)
    /// @param _newForwarderAddress The new KeystoneForwarder contract address
    function setKeystoneForwarder(address _newForwarderAddress) external onlyOwner {
        if (_newForwarderAddress == address(0)) {
            revert InvalidAddress(address(0));
        }
        address oldForwarder = keystoneForwarderAddress;
        keystoneForwarderAddress = _newForwarderAddress;
        emit KeystoneForwarderUpdated(oldForwarder, _newForwarderAddress);
    }

    /// @notice Updates the expected workflow ID (owner only)
    /// @param _newWorkflowId The new workflow ID to accept reports from
    function setExpectedWorkflowId(bytes32 _newWorkflowId) external onlyOwner {
        if (_newWorkflowId == bytes32(0)) {
            revert InvalidWorkflowId(bytes32(0));
        }
        bytes32 oldWorkflowId = expectedWorkflowId;
        expectedWorkflowId = _newWorkflowId;
        emit WorkflowIdUpdated(oldWorkflowId, _newWorkflowId);
    }

    /// @notice Updates the expected workflow author (owner only)
    /// @param _newAuthor The new expected workflow owner address
    function setExpectedAuthor(address _newAuthor) external onlyOwner {
        if (_newAuthor == address(0)) {
            revert InvalidAddress(address(0));
        }
        address oldAuthor = EXPECTED_AUTHOR;
        EXPECTED_AUTHOR = _newAuthor;
        emit ExpectedAuthorUpdated(oldAuthor, _newAuthor);
    }

    /// @notice Updates the expected workflow name (owner only)
    /// @param _newWorkflowName The new expected workflow name
    function setExpectedWorkflowName(bytes10 _newWorkflowName) external onlyOwner {
        bytes10 oldName = EXPECTED_WORKFLOW_NAME;
        EXPECTED_WORKFLOW_NAME = _newWorkflowName;
        emit ExpectedWorkflowNameUpdated(oldName, _newWorkflowName);
    }

   }

