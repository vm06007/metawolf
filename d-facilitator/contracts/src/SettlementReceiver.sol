// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { IReceiverTemplate } from "./keystone/IReceiverTemplate.sol";

/// @title SettlementReceiver - Secure consumer contract for Chainlink CRE settlement reports
/// @notice This contract implements the most secure pattern with:
///   - Forwarder address validation
///   - Workflow ID validation
///   - Workflow owner and name validation (from IReceiverTemplate)
contract SettlementReceiver is IReceiverTemplate {

    // Immutable security parameters
    address public immutable keystoneForwarderAddress;
    bytes32 public immutable expectedWorkflowId;

    // Custom errors
    error InvalidSender(address sender, address expected);
    error UnauthorizedWorkflow(bytes32 received, bytes32 expected);

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
            revert InvalidSender(address(0), _keystoneForwarderAddress);
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

        // Third check: Call parent implementation for workflow owner/name validation
        super.onReport(metadata, report);
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
    function _processReport(bytes calldata report) internal override {
        // TODO: Decode the report and implement your settlement logic here
        // Example:
        // (address payer, address payee, uint256 amount, bool success) = abi.decode(report, (address, address, uint256, bool));
        // 
        // Your settlement logic here...
        // 
        // emit SettlementProcessed(payer, payee, amount, success);
    }

    // TODO: Add events for settlement processing
    // event SettlementProcessed(address indexed payer, address indexed payee, uint256 amount, bool success);
}

