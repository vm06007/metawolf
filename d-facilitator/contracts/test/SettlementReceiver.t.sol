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
        
        // Deploy SettlementReceiver with no constructor parameters
        receiver = new SettlementReceiver();
        
        // Configure all parameters via setters
        receiver.addKeystoneForwarder(KEYSTONE_FORWARDER);
        receiver.addExpectedWorkflowId(EXPECTED_WORKFLOW_ID);
        receiver.addExpectedAuthor(EXPECTED_AUTHOR);
        receiver.addExpectedWorkflowName(EXPECTED_WORKFLOW_NAME);
        
        // Deploy ExecutionProxy
        executionProxy = new ExecutionProxy(address(receiver));
        
        // Set ExecutionProxy in receiver
        receiver.setExecutionProxy(address(executionProxy));
        
        // Deploy mock target
        mockTarget = new MockTarget();
    }

    function test_Constructor() public {
        // After setUp, check that we added all values via setters
        assertEq(receiver.getKeystoneForwarderCount(), 1);
        assertEq(receiver.keystoneForwarderAddresses(0), KEYSTONE_FORWARDER);
        assertEq(receiver.getExpectedWorkflowIdCount(), 1);
        assertEq(receiver.expectedWorkflowIds(0), EXPECTED_WORKFLOW_ID);
        assertEq(receiver.getExpectedAuthorCount(), 1);
        assertEq(receiver.expectedAuthors(0), EXPECTED_AUTHOR);
        assertEq(receiver.getExpectedWorkflowNameCount(), 1);
        assertEq(receiver.expectedWorkflowNames(0), EXPECTED_WORKFLOW_NAME);
    }
    
    function test_Constructor_EmptyArrays() public {
        // Deploy a new receiver without configuration to test empty arrays
        SettlementReceiver newReceiver = new SettlementReceiver();
        
        // Check that arrays are initialized empty
        assertEq(newReceiver.getExpectedAuthorCount(), 0);
        assertEq(newReceiver.getExpectedWorkflowNameCount(), 0);
        assertEq(newReceiver.getKeystoneForwarderCount(), 0);
        assertEq(newReceiver.getExpectedWorkflowIdCount(), 0);
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
        
        // Expect ExecutionSucceeded event from ExecutionProxy (emitted first)
        vm.expectEmit(true, true, false, true);
        emit ExecutionProxy.ExecutionSucceeded(
            address(receiver),
            address(mockTarget),
            data,
            0,
            true,
            ""
        );
        
        // Expect ExecutionSucceeded event from SettlementReceiver (emitted second)
        vm.expectEmit(true, false, false, true);
        emit SettlementReceiver.ExecutionSucceeded(
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

    function test_AddKeystoneForwarder() public {
        address newForwarder = address(0x999);
        
        vm.expectEmit(true, false, false, false);
        emit SettlementReceiver.KeystoneForwarderAdded(newForwarder);
        
        receiver.addKeystoneForwarder(newForwarder);
        assertEq(receiver.getKeystoneForwarderCount(), 2);
        assertEq(receiver.keystoneForwarderAddresses(1), newForwarder);
    }

    function test_RevertWhen_AddKeystoneForwarder_NotOwner() public {
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
        receiver.addKeystoneForwarder(newForwarder);
    }

    function test_RevertWhen_AddKeystoneForwarder_ZeroAddress() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                SettlementReceiver.InvalidAddress.selector,
                address(0)
            )
        );
        receiver.addKeystoneForwarder(address(0));
    }

    function test_RevertWhen_AddKeystoneForwarder_Duplicate() public {
        vm.expectRevert(SettlementReceiver.DuplicateValue.selector);
        receiver.addKeystoneForwarder(KEYSTONE_FORWARDER);
    }

    function test_AddExpectedWorkflowId() public {
        bytes32 newWorkflowId = keccak256("new-workflow-id");
        
        vm.expectEmit(true, false, false, false);
        emit SettlementReceiver.WorkflowIdAdded(newWorkflowId);
        
        receiver.addExpectedWorkflowId(newWorkflowId);
        assertEq(receiver.getExpectedWorkflowIdCount(), 2);
        assertEq(receiver.expectedWorkflowIds(1), newWorkflowId);
    }

    function test_RevertWhen_AddExpectedWorkflowId_NotOwner() public {
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
        receiver.addExpectedWorkflowId(newWorkflowId);
    }

    function test_RevertWhen_AddExpectedWorkflowId_Zero() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                SettlementReceiver.InvalidWorkflowId.selector,
                bytes32(0)
            )
        );
        receiver.addExpectedWorkflowId(bytes32(0));
    }

    function test_RevertWhen_AddExpectedWorkflowId_Duplicate() public {
        vm.expectRevert(SettlementReceiver.DuplicateValue.selector);
        receiver.addExpectedWorkflowId(EXPECTED_WORKFLOW_ID);
    }

    function test_AddExpectedAuthor() public {
        address newAuthor = address(0x888);
        
        vm.expectEmit(true, false, false, false);
        emit SettlementReceiver.ExpectedAuthorAdded(newAuthor);
        
        receiver.addExpectedAuthor(newAuthor);
        assertEq(receiver.getExpectedAuthorCount(), 2);
        assertEq(receiver.expectedAuthors(1), newAuthor);
    }

    function test_RevertWhen_AddExpectedAuthor_NotOwner() public {
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
        receiver.addExpectedAuthor(newAuthor);
    }

    function test_RevertWhen_AddExpectedAuthor_ZeroAddress() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                SettlementReceiver.InvalidAddress.selector,
                address(0)
            )
        );
        receiver.addExpectedAuthor(address(0));
    }

    function test_RevertWhen_AddExpectedAuthor_Duplicate() public {
        vm.expectRevert(SettlementReceiver.DuplicateValue.selector);
        receiver.addExpectedAuthor(EXPECTED_AUTHOR);
    }

    function test_AddExpectedWorkflowName() public {
        bytes10 newName = "new-name";
        
        vm.expectEmit(true, false, false, false);
        emit SettlementReceiver.ExpectedWorkflowNameAdded(newName);
        
        receiver.addExpectedWorkflowName(newName);
        assertEq(receiver.getExpectedWorkflowNameCount(), 2);
        assertEq(receiver.expectedWorkflowNames(1), newName);
    }

    function test_RevertWhen_AddExpectedWorkflowName_NotOwner() public {
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
        receiver.addExpectedWorkflowName(newName);
    }

    function test_RevertWhen_AddExpectedWorkflowName_Duplicate() public {
        vm.expectRevert(SettlementReceiver.DuplicateValue.selector);
        receiver.addExpectedWorkflowName(EXPECTED_WORKFLOW_NAME);
    }

    function test_AddConfiguration_ThenAcceptReport() public {
        // Add new configuration (keeping old ones)
        address newForwarder = address(0x777);
        bytes32 newWorkflowId = keccak256("new-workflow-id");
        address newAuthor = address(0x888);
        bytes10 newName = "new-name";
        
        receiver.addKeystoneForwarder(newForwarder);
        receiver.addExpectedWorkflowId(newWorkflowId);
        receiver.addExpectedAuthor(newAuthor);
        receiver.addExpectedWorkflowName(newName);
        
        // Create metadata with new values
        bytes memory metadata = _createMetadata(newWorkflowId, newAuthor, newName);
        
        // Report format: (address target, bytes data, uint256 value)
        bytes memory data = abi.encodeWithSignature("testFunction()");
        bytes memory report = abi.encode(address(mockTarget), data, uint256(0));
        
        // Expect ExecutionSucceeded event from ExecutionProxy (emitted first)
        vm.expectEmit(true, true, false, true);
        emit ExecutionProxy.ExecutionSucceeded(
            address(receiver),
            address(mockTarget),
            data,
            0,
            true,
            ""
        );
        
        // Expect ExecutionSucceeded event from SettlementReceiver (emitted second)
        vm.expectEmit(true, false, false, true);
        emit SettlementReceiver.ExecutionSucceeded(
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
        
        // Verify old configuration still works
        bytes memory oldMetadata = _createMetadata(EXPECTED_WORKFLOW_ID, EXPECTED_AUTHOR, EXPECTED_WORKFLOW_NAME);
        bytes memory oldReport = abi.encode(address(mockTarget), data, uint256(0));
        vm.prank(KEYSTONE_FORWARDER);
        receiver.onReport(oldMetadata, oldReport);
        assertEq(mockTarget.callCount(), 2);
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

