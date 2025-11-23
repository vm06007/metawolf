// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { IReceiverTemplate } from "./keystone/IReceiverTemplate.sol";
import { Ownable } from "./utils/Ownable.sol";
import { ExecutionProxy } from "./ExecutionProxy.sol";

/// @title SettlementReceiver - Secure consumer contract for Chainlink CRE settlement reports
/// @notice This contract implements the most secure pattern with:
///   - Forwarder address validation (array-based)
///   - Workflow ID validation (array-based)
///   - Workflow owner and name validation (array-based, overriding IReceiverTemplate)
///   - Updatable configuration with owner access control
contract SettlementReceiver is IReceiverTemplate, Ownable {

    // Array-based security parameters
    address[] public keystoneForwarderAddresses;
    bytes32[] public expectedWorkflowIds;
    address[] public expectedAuthors;
    bytes10[] public expectedWorkflowNames;
    
    // ExecutionProxy for executing arbitrary signed data
    address public executionProxy;

    // Custom errors
    error InvalidSender(address sender);
    error UnauthorizedWorkflow(bytes32 received);
    error InvalidAddress(address addr);
    error InvalidWorkflowId(bytes32 workflowId);
    error DuplicateValue();

    // Events
    event KeystoneForwarderAdded(address indexed forwarder);
    event WorkflowIdAdded(bytes32 indexed workflowId);
    event ExpectedAuthorAdded(address indexed author);
    event ExpectedWorkflowNameAdded(bytes10 indexed workflowName);
    event ExecutionProxyUpdated(address indexed oldProxy, address indexed newProxy);
    event ExecutionSucceeded(address indexed target, bytes data, uint256 value, bool success);

    /// @notice Constructor with no parameters - configuration is done via setter functions
    constructor() IReceiverTemplate() {
        // Arrays are initialized empty - use add* functions to configure
    }

    /// @notice Override to add forwarder and workflow ID checks before parent validation
    /// @param metadata Report metadata containing workflow information
    /// @param report The actual report data
    function onReport(
        bytes calldata metadata,
        bytes calldata report
    ) external override {
        // First check: Ensure the call is from a trusted KeystoneForwarder
        bool isAuthorizedForwarder = false;
        for (uint256 i = 0; i < keystoneForwarderAddresses.length; i++) {
            if (msg.sender == keystoneForwarderAddresses[i]) {
                isAuthorizedForwarder = true;
                break;
            }
        }
        if (!isAuthorizedForwarder) {
            revert InvalidSender(msg.sender);
        }

        // Second check: Validate workflow ID
        bytes32 workflowId = _getWorkflowId(metadata);
        bool isAuthorizedWorkflowId = false;
        for (uint256 i = 0; i < expectedWorkflowIds.length; i++) {
            if (workflowId == expectedWorkflowIds[i]) {
                isAuthorizedWorkflowId = true;
                break;
            }
        }
        if (!isAuthorizedWorkflowId) {
            revert UnauthorizedWorkflow(workflowId);
        }

        // Third check: Validate workflow owner (array-based) - using parent's _decodeMetadata
        (address workflowOwner, bytes10 workflowName) = _decodeMetadata(metadata);
        bool isAuthorizedAuthor = false;
        for (uint256 i = 0; i < expectedAuthors.length; i++) {
            if (workflowOwner == expectedAuthors[i]) {
                isAuthorizedAuthor = true;
                break;
            }
        }
        if (!isAuthorizedAuthor) {
            // Use first expected author as reference for error message
            address expectedAuthorRef = expectedAuthors.length > 0 ? expectedAuthors[0] : address(0);
            revert InvalidAuthor(workflowOwner, expectedAuthorRef);
        }

        // Fourth check: Validate workflow name (array-based) - using parent's _decodeMetadata
        bool isAuthorizedName = false;
        for (uint256 i = 0; i < expectedWorkflowNames.length; i++) {
            if (workflowName == expectedWorkflowNames[i]) {
                isAuthorizedName = true;
                break;
            }
        }
        if (!isAuthorizedName) {
            // Use first expected workflow name as reference for error message
            bytes10 expectedNameRef = expectedWorkflowNames.length > 0 ? expectedWorkflowNames[0] : bytes10(0);
            revert InvalidWorkflowName(workflowName, expectedNameRef);
        }

        // All validations passed, process the report
        _processReport(report);
    }

    /// @notice Extracts workflow ID from the onReport `metadata` parameter
    /// @param metadata The metadata bytes
    /// @return workflowId The workflow ID (workflow_cid)
    /// @dev Uses parent's _decodeMetadata for workflowOwner and workflowName to avoid duplication
    function _getWorkflowId(
        bytes memory metadata
    ) internal pure returns (bytes32 workflowId) {
        assembly {
            // workflow_cid (workflowId) is at offset 32, size 32
            workflowId := mload(add(metadata, 32))
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

    /// @notice Adds a new KeystoneForwarder address to the allowed list (owner only)
    /// @param _forwarderAddress The KeystoneForwarder contract address to add
    function addKeystoneForwarder(address _forwarderAddress) external onlyOwner {
        if (_forwarderAddress == address(0)) {
            revert InvalidAddress(address(0));
        }
        // Check for duplicates
        for (uint256 i = 0; i < keystoneForwarderAddresses.length; i++) {
            if (keystoneForwarderAddresses[i] == _forwarderAddress) {
                revert DuplicateValue();
            }
        }
        keystoneForwarderAddresses.push(_forwarderAddress);
        emit KeystoneForwarderAdded(_forwarderAddress);
    }

    /// @notice Adds a new expected workflow ID to the allowed list (owner only)
    /// @param _workflowId The workflow ID to add
    function addExpectedWorkflowId(bytes32 _workflowId) external onlyOwner {
        if (_workflowId == bytes32(0)) {
            revert InvalidWorkflowId(bytes32(0));
        }
        // Check for duplicates
        for (uint256 i = 0; i < expectedWorkflowIds.length; i++) {
            if (expectedWorkflowIds[i] == _workflowId) {
                revert DuplicateValue();
            }
        }
        expectedWorkflowIds.push(_workflowId);
        emit WorkflowIdAdded(_workflowId);
    }

    /// @notice Adds a new expected workflow author to the allowed list (owner only)
    /// @param _author The expected workflow owner address to add
    function addExpectedAuthor(address _author) external onlyOwner {
        if (_author == address(0)) {
            revert InvalidAddress(address(0));
        }
        // Check for duplicates
        for (uint256 i = 0; i < expectedAuthors.length; i++) {
            if (expectedAuthors[i] == _author) {
                revert DuplicateValue();
            }
        }
        expectedAuthors.push(_author);
        emit ExpectedAuthorAdded(_author);
    }

    /// @notice Adds a new expected workflow name to the allowed list (owner only)
    /// @param _workflowName The expected workflow name to add
    function addExpectedWorkflowName(bytes10 _workflowName) external onlyOwner {
        if (_workflowName == bytes10(0)) {
            revert InvalidWorkflowName(bytes10(0), bytes10(0));
        }
        // Check for duplicates
        for (uint256 i = 0; i < expectedWorkflowNames.length; i++) {
            if (expectedWorkflowNames[i] == _workflowName) {
                revert DuplicateValue();
            }
        }
        expectedWorkflowNames.push(_workflowName);
        emit ExpectedWorkflowNameAdded(_workflowName);
    }

    /// @notice Gets the count of authorized forwarders
    /// @return The number of authorized forwarders
    function getKeystoneForwarderCount() external view returns (uint256) {
        return keystoneForwarderAddresses.length;
    }

    /// @notice Gets the count of authorized workflow IDs
    /// @return The number of authorized workflow IDs
    function getExpectedWorkflowIdCount() external view returns (uint256) {
        return expectedWorkflowIds.length;
    }

    /// @notice Gets the count of authorized authors
    /// @return The number of authorized authors
    function getExpectedAuthorCount() external view returns (uint256) {
        return expectedAuthors.length;
    }

    /// @notice Gets the count of authorized workflow names
    /// @return The number of authorized workflow names
    function getExpectedWorkflowNameCount() external view returns (uint256) {
        return expectedWorkflowNames.length;
    }

   }

