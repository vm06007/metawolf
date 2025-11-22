// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {SettlementReceiver} from "../src/SettlementReceiver.sol";
import {IReceiverTemplate} from "../src/keystone/IReceiverTemplate.sol";
import {ExecutionProxy} from "../src/ExecutionProxy.sol";
import {ForwarderHelper} from "./utils/ForwarderHelper.sol";

// Mock target contract for testing
contract MockTarget {
    uint256 public callCount;
    
    function testFunction() external {
        callCount++;
    }
}

contract SettlementReceiverTest is Test {
    SettlementReceiver public receiver;
    ExecutionProxy public executionProxy;
    MockTarget public mockTarget;
    
    // Test addresses
    address public constant EXPECTED_AUTHOR = address(0x1234567890123456789012345678901234567890);
    bytes10 public constant EXPECTED_WORKFLOW_NAME = "d-settle";
    // Use simulation forwarder for Sepolia testnet (for local testing)
    // This matches ForwarderHelper.SEPOLIA_SIMULATION_FORWARDER
    address public constant KEYSTONE_FORWARDER = address(0x15fC6ae953E024d975e77382eEeC56A9101f9F88);
    bytes32 public constant EXPECTED_WORKFLOW_ID = keccak256("test-workflow-id");
    
    ForwarderHelper public forwarderHelper;

    function setUp() public {
        // Deploy forwarder helper for testing
        forwarderHelper = new ForwarderHelper();
        
        receiver = new SettlementReceiver(
            EXPECTED_AUTHOR,
            EXPECTED_WORKFLOW_NAME,
            KEYSTONE_FORWARDER,
            EXPECTED_WORKFLOW_ID
        );
        
        // Deploy ExecutionProxy
        executionProxy = new ExecutionProxy(address(receiver));
        
        // Set ExecutionProxy in receiver
        receiver.setExecutionProxy(address(executionProxy));
        
        // Deploy mock target
        mockTarget = new MockTarget();
    }

    function test_Constructor() public {
        assertEq(receiver.EXPECTED_AUTHOR(), EXPECTED_AUTHOR);
        assertEq(receiver.EXPECTED_WORKFLOW_NAME(), EXPECTED_WORKFLOW_NAME);
        assertEq(receiver.keystoneForwarderAddress(), KEYSTONE_FORWARDER);
        assertEq(receiver.expectedWorkflowId(), EXPECTED_WORKFLOW_ID);
    }

    function test_RevertWhen_CalledByNonForwarder() public {
        bytes memory metadata = _createMetadata(EXPECTED_WORKFLOW_ID, EXPECTED_AUTHOR, EXPECTED_WORKFLOW_NAME);
        bytes memory report = abi.encode("test report");
        
        vm.prank(address(0x999)); // Not the forwarder
        vm.expectRevert(
            abi.encodeWithSelector(
                SettlementReceiver.InvalidSender.selector,
                address(0x999),
                KEYSTONE_FORWARDER
            )
        );
        receiver.onReport(metadata, report);
    }

    function test_RevertWhen_WrongWorkflowId() public {
        bytes32 wrongWorkflowId = keccak256("wrong-id");
        bytes memory metadata = _createMetadata(wrongWorkflowId, EXPECTED_AUTHOR, EXPECTED_WORKFLOW_NAME);
        bytes memory report = abi.encode("test report");
        
        vm.prank(KEYSTONE_FORWARDER);
        vm.expectRevert(
            abi.encodeWithSelector(
                SettlementReceiver.UnauthorizedWorkflow.selector,
                wrongWorkflowId,
                EXPECTED_WORKFLOW_ID
            )
        );
        receiver.onReport(metadata, report);
    }

    function test_RevertWhen_WrongAuthor() public {
        address wrongAuthor = address(0x999);
        bytes memory metadata = _createMetadata(EXPECTED_WORKFLOW_ID, wrongAuthor, EXPECTED_WORKFLOW_NAME);
        bytes memory report = abi.encode("test report");
        
        vm.prank(KEYSTONE_FORWARDER);
        vm.expectRevert(
            abi.encodeWithSignature(
                "InvalidAuthor(address,address)",
                wrongAuthor,
                EXPECTED_AUTHOR
            )
        );
        receiver.onReport(metadata, report);
    }

    function test_RevertWhen_WrongWorkflowName() public {
        bytes10 wrongName = "wrong-name";
        bytes memory metadata = _createMetadata(EXPECTED_WORKFLOW_ID, EXPECTED_AUTHOR, wrongName);
        bytes memory report = abi.encode("test report");
        
        vm.prank(KEYSTONE_FORWARDER);
        vm.expectRevert(
            abi.encodeWithSignature(
                "InvalidWorkflowName(bytes10,bytes10)",
                wrongName,
                EXPECTED_WORKFLOW_NAME
            )
        );
        receiver.onReport(metadata, report);
    }

    function test_SuccessfulReport() public {
        bytes memory metadata = _createMetadata(EXPECTED_WORKFLOW_ID, EXPECTED_AUTHOR, EXPECTED_WORKFLOW_NAME);
        
        // Report format: (address target, bytes data, uint256 value)
        bytes memory data = abi.encodeWithSignature("testFunction()");
        bytes memory report = abi.encode(address(mockTarget), data, uint256(0));
        
        // Expect ExecutionRequested event from ExecutionProxy (emitted first)
        vm.expectEmit(true, true, false, true);
        emit ExecutionProxy.ExecutionRequested(
            address(receiver),
            address(mockTarget),
            data,
            0,
            true,
            ""
        );
        
        // Expect ExecutionRequested event from SettlementReceiver (emitted second)
        vm.expectEmit(true, false, false, true);
        emit SettlementReceiver.ExecutionRequested(
            address(mockTarget),
            data,
            0,
            true
        );
        
        vm.prank(KEYSTONE_FORWARDER);
        // Should not revert - will call _processReport which executes through ExecutionProxy
        receiver.onReport(metadata, report);
        
        // Verify the execution happened
        assertEq(mockTarget.callCount(), 1);
    }

    function test_SetKeystoneForwarder() public {
        address newForwarder = address(0x999);
        
        vm.expectEmit(true, true, false, false);
        emit SettlementReceiver.KeystoneForwarderUpdated(KEYSTONE_FORWARDER, newForwarder);
        
        receiver.setKeystoneForwarder(newForwarder);
        assertEq(receiver.keystoneForwarderAddress(), newForwarder);
    }

    function test_RevertWhen_SetKeystoneForwarder_NotOwner() public {
        address attacker = address(0x666);
        address newForwarder = address(0x999);
        
        vm.prank(attacker);
        vm.expectRevert(
            abi.encodeWithSignature(
                "NotOwner(address,address)",
                attacker,
                address(this)
            )
        );
        receiver.setKeystoneForwarder(newForwarder);
    }

    function test_RevertWhen_SetKeystoneForwarder_ZeroAddress() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                SettlementReceiver.InvalidAddress.selector,
                address(0)
            )
        );
        receiver.setKeystoneForwarder(address(0));
    }

    function test_SetExpectedWorkflowId() public {
        bytes32 newWorkflowId = keccak256("new-workflow-id");
        
        vm.expectEmit(true, true, false, false);
        emit SettlementReceiver.WorkflowIdUpdated(EXPECTED_WORKFLOW_ID, newWorkflowId);
        
        receiver.setExpectedWorkflowId(newWorkflowId);
        assertEq(receiver.expectedWorkflowId(), newWorkflowId);
    }

    function test_RevertWhen_SetExpectedWorkflowId_NotOwner() public {
        address attacker = address(0x666);
        bytes32 newWorkflowId = keccak256("new-workflow-id");
        
        vm.prank(attacker);
        vm.expectRevert(
            abi.encodeWithSignature(
                "NotOwner(address,address)",
                attacker,
                address(this)
            )
        );
        receiver.setExpectedWorkflowId(newWorkflowId);
    }

    function test_RevertWhen_SetExpectedWorkflowId_Zero() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                SettlementReceiver.InvalidWorkflowId.selector,
                bytes32(0)
            )
        );
        receiver.setExpectedWorkflowId(bytes32(0));
    }

    function test_SetExpectedAuthor() public {
        address newAuthor = address(0x888);
        
        vm.expectEmit(true, true, false, false);
        emit SettlementReceiver.ExpectedAuthorUpdated(EXPECTED_AUTHOR, newAuthor);
        
        receiver.setExpectedAuthor(newAuthor);
        assertEq(receiver.EXPECTED_AUTHOR(), newAuthor);
    }

    function test_RevertWhen_SetExpectedAuthor_NotOwner() public {
        address attacker = address(0x666);
        address newAuthor = address(0x888);
        
        vm.prank(attacker);
        vm.expectRevert(
            abi.encodeWithSignature(
                "NotOwner(address,address)",
                attacker,
                address(this)
            )
        );
        receiver.setExpectedAuthor(newAuthor);
    }

    function test_RevertWhen_SetExpectedAuthor_ZeroAddress() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                SettlementReceiver.InvalidAddress.selector,
                address(0)
            )
        );
        receiver.setExpectedAuthor(address(0));
    }

    function test_SetExpectedWorkflowName() public {
        bytes10 newName = "new-name";
        
        vm.expectEmit(true, true, false, false);
        emit SettlementReceiver.ExpectedWorkflowNameUpdated(EXPECTED_WORKFLOW_NAME, newName);
        
        receiver.setExpectedWorkflowName(newName);
        assertEq(receiver.EXPECTED_WORKFLOW_NAME(), newName);
    }

    function test_RevertWhen_SetExpectedWorkflowName_NotOwner() public {
        address attacker = address(0x666);
        bytes10 newName = "new-name";
        
        vm.prank(attacker);
        vm.expectRevert(
            abi.encodeWithSignature(
                "NotOwner(address,address)",
                attacker,
                address(this)
            )
        );
        receiver.setExpectedWorkflowName(newName);
    }

    function test_UpdateConfiguration_ThenAcceptReport() public {
        // Update configuration
        address newForwarder = address(0x777);
        bytes32 newWorkflowId = keccak256("new-workflow-id");
        address newAuthor = address(0x888);
        bytes10 newName = "new-name";
        
        receiver.setKeystoneForwarder(newForwarder);
        receiver.setExpectedWorkflowId(newWorkflowId);
        receiver.setExpectedAuthor(newAuthor);
        receiver.setExpectedWorkflowName(newName);
        
        // Create metadata with new values
        bytes memory metadata = _createMetadata(newWorkflowId, newAuthor, newName);
        
        // Report format: (address target, bytes data, uint256 value)
        bytes memory data = abi.encodeWithSignature("testFunction()");
        bytes memory report = abi.encode(address(mockTarget), data, uint256(0));
        
        // Expect ExecutionRequested event from ExecutionProxy (emitted first)
        vm.expectEmit(true, true, false, true);
        emit ExecutionProxy.ExecutionRequested(
            address(receiver),
            address(mockTarget),
            data,
            0,
            true,
            ""
        );
        
        // Expect ExecutionRequested event from SettlementReceiver (emitted second)
        vm.expectEmit(true, false, false, true);
        emit SettlementReceiver.ExecutionRequested(
            address(mockTarget),
            data,
            0,
            true
        );
        
        // Should succeed with new configuration
        vm.prank(newForwarder);
        receiver.onReport(metadata, report);
        
        // Verify the execution happened
        assertEq(mockTarget.callCount(), 1);
    }

    /// @notice Helper function to create metadata bytes
    function _createMetadata(
        bytes32 workflowId,
        address workflowOwner,
        bytes10 workflowName
    ) internal pure returns (bytes memory) {
        // Metadata structure (as per CRE specification):
        // offset 0-31: length (automatically set by Solidity)
        // offset 32-63: workflow_cid (workflowId) - 32 bytes
        // offset 64-73: workflow_name - 10 bytes
        // offset 74-93: workflow_owner - 20 bytes (padded to 32 bytes)
        // offset 94-95: report_name - 2 bytes
        
        bytes memory metadata = new bytes(96);
        
        assembly {
            // workflowId at offset 32 (after length prefix)
            mstore(add(metadata, 0x20), workflowId)
            
            // workflowName at offset 64 (10 bytes)
            // bytes10 is stored in the leftmost 10 bytes of a 32-byte word
            // No shifting needed - Solidity handles bytes10 alignment
            mstore(add(metadata, 0x40), workflowName)
            
            // workflowOwner at offset 74 (20 bytes)
            // address is 20 bytes, stored at offset 74, so we shift left by 12 bytes
            let ownerShifted := shl(mul(12, 8), workflowOwner)
            mstore(add(metadata, 0x4a), ownerShifted)
        }
        
        return metadata;
    }
}

