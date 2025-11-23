// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC165} from "./IERC165.sol";
import {IReceiver} from "./IReceiver.sol";

/// @title IReceiverTemplate - Abstract receiver with workflow validation and metadata decoding
abstract contract IReceiverTemplate is IReceiver {

    // Custom errors
    error InvalidAuthor(address received, address expected);
    error InvalidWorkflowName(bytes10 received, bytes10 expected);

    constructor() {
        // No initialization needed - child contracts handle their own validation
    }

    /// @inheritdoc IReceiver
    function onReport(
        bytes calldata metadata,
        bytes calldata report
    ) external virtual override {
        _validateAndProcess(metadata, report);
    }

    /// @notice Validates metadata and processes the report
    /// @param metadata Report metadata
    /// @param report Report data
    /// @dev Child contracts should override this or override onReport to implement their own validation
    function _validateAndProcess(
        bytes calldata metadata,
        bytes calldata report
    ) internal virtual {
        // Child contracts must implement their own validation logic
        // This is a no-op here - child contracts override onReport or _validateAndProcess
        // _decodeMetadata is available for child contracts to use
        _processReport(report);
    }

    /// @notice Extracts the workflow name and the workflow owner from the metadata parameter of onReport
    /// @param metadata The metadata in bytes format
    /// @return workflowOwner The owner of the workflow
    /// @return workflowName  The name of the workflow
    function _decodeMetadata(
        bytes memory metadata
    ) internal pure returns (address, bytes10) {
        address workflowOwner;
        bytes10 workflowName;
        // (first 32 bytes contain length of the byte array)
        // workflow_cid             // offset 32, size 32
        // workflow_name            // offset 64, size 10
        // workflow_owner           // offset 74, size 20
        // report_name              // offset 94, size  2
        assembly {
            // no shifting needed for bytes10 type
            workflowName := mload(add(metadata, 64))
            // shift right by 12 bytes to get the actual value
            workflowOwner := shr(mul(12, 8), mload(add(metadata, 74)))
        }
        return (workflowOwner, workflowName);
    }

    /// @notice Abstract function to process the report
    /// @param report The report calldata
    function _processReport(
        bytes calldata report
    ) internal virtual;

    /// @inheritdoc IERC165
    function supportsInterface(
        bytes4 interfaceId
    ) public pure virtual override returns (bool) {
        return
            interfaceId == type(IReceiver).interfaceId ||
            interfaceId == type(IERC165).interfaceId;
    }
}

