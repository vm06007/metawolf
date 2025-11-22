// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {ExecutionProxy} from "../src/ExecutionProxy.sol";
import {SettlementReceiver} from "../src/SettlementReceiver.sol";

contract ExecutionProxyTest is Test {
    ExecutionProxy public executionProxy;
    SettlementReceiver public settlementReceiver;
    
    // Test addresses
    address public constant EXPECTED_AUTHOR = address(0x1234567890123456789012345678901234567890);
    bytes10 public constant EXPECTED_WORKFLOW_NAME = "d-settle";
    address public constant KEYSTONE_FORWARDER = address(0x15fC6ae953E024d975e77382eEeC56A9101f9F88);
    bytes32 public constant EXPECTED_WORKFLOW_ID = keccak256("test-workflow-id");
    
    // Mock target contract
    MockTarget public mockTarget;

    function setUp() public {
        // Deploy SettlementReceiver first (owner will be this test contract)
        settlementReceiver = new SettlementReceiver(
            EXPECTED_AUTHOR,
            EXPECTED_WORKFLOW_NAME,
            KEYSTONE_FORWARDER,
            EXPECTED_WORKFLOW_ID
        );
        
        // Deploy ExecutionProxy with SettlementReceiver as authorized caller
        executionProxy = new ExecutionProxy(address(settlementReceiver));
        
        // Set ExecutionProxy in SettlementReceiver (this contract is the owner)
        settlementReceiver.setExecutionProxy(address(executionProxy));
        
        // Deploy mock target
        mockTarget = new MockTarget();
    }

    function test_Constructor() public {
        assertEq(executionProxy.authorizedCaller(), address(settlementReceiver));
    }

    function test_RevertWhen_CalledByUnauthorized() public {
        bytes memory data = abi.encodeWithSignature("testFunction()");
        
        vm.prank(address(0x999)); // Not SettlementReceiver
        vm.expectRevert(
            abi.encodeWithSignature(
                "UnauthorizedCaller(address,address)",
                address(0x999),
                address(settlementReceiver)
            )
        );
        executionProxy.execute(address(mockTarget), data, 0);
    }

    function test_RevertWhen_TargetIsZero() public {
        bytes memory data = abi.encodeWithSignature("testFunction()");
        
        // Expect ExecutionFailed event
        vm.expectEmit(true, true, false, true);
        emit ExecutionProxy.ExecutionFailed(
            address(settlementReceiver),
            address(0),
            data,
            0,
            "ExecutionProxy: target address is zero"
        );
        
        vm.prank(address(settlementReceiver));
        // Should emit ExecutionFailed event, not revert
        (bool success, bytes memory result) = executionProxy.execute(address(0), data, 0);
        assertFalse(success);
        assertEq(result.length, 0);
    }

    function test_SuccessfulExecution() public {
        bytes memory data = abi.encodeWithSignature("testFunction()");
        
        // Expect ExecutionSucceeded event with success = true
        vm.expectEmit(true, true, false, true);
        emit ExecutionProxy.ExecutionSucceeded(
            address(settlementReceiver),
            address(mockTarget),
            data,
            0,
            true,
            ""
        );
        
        vm.prank(address(settlementReceiver));
        (bool success, bytes memory result) = executionProxy.execute(address(mockTarget), data, 0);
        
        assertTrue(success);
        assertEq(mockTarget.callCount(), 1);
    }

    function test_ExecutionWithValue() public {
        bytes memory data = abi.encodeWithSignature("receiveEth()");
        uint256 value = 1 ether;
        
        // Fund ExecutionProxy
        vm.deal(address(executionProxy), value);
        
        // Expect ExecutionSucceeded event with success = true
        vm.expectEmit(true, true, false, true);
        emit ExecutionProxy.ExecutionSucceeded(
            address(settlementReceiver),
            address(mockTarget),
            data,
            value,
            true,
            ""
        );
        
        vm.prank(address(settlementReceiver));
        (bool success, ) = executionProxy.execute(address(mockTarget), data, value);
        
        assertTrue(success);
        assertEq(address(mockTarget).balance, value);
    }

    function test_ExecutionFailure() public {
        bytes memory data = abi.encodeWithSignature("revertFunction()");
        
        // Expect ExecutionFailed event
        // The revert will have result.length >= 68, so it will emit "Custom error"
        vm.expectEmit(true, true, false, true);
        emit ExecutionProxy.ExecutionFailed(
            address(settlementReceiver),
            address(mockTarget),
            data,
            0,
            "Custom error" // Revert with string message results in "Custom error" when length >= 68
        );
        
        vm.prank(address(settlementReceiver));
        (bool success, bytes memory result) = executionProxy.execute(address(mockTarget), data, 0);
        
        assertFalse(success);
        assertGt(result.length, 0);
    }

    function test_ExecutionWithReturnValue() public {
        bytes memory data = abi.encodeWithSignature("returnValue()");
        
        // Expect ExecutionSucceeded event with success = true and return value
        vm.expectEmit(true, true, false, true);
        bytes memory expectedResult = abi.encode(uint256(42));
        emit ExecutionProxy.ExecutionSucceeded(
            address(settlementReceiver),
            address(mockTarget),
            data,
            0,
            true,
            expectedResult
        );
        
        vm.prank(address(settlementReceiver));
        (bool success, bytes memory result) = executionProxy.execute(address(mockTarget), data, 0);
        
        assertTrue(success);
        uint256 value = abi.decode(result, (uint256));
        assertEq(value, 42);
    }

    function test_ReceiveEth() public {
        vm.deal(address(this), 1 ether);
        (bool success, ) = address(executionProxy).call{value: 1 ether}("");
        assertTrue(success);
        assertEq(address(executionProxy).balance, 1 ether);
    }
}

// Mock target contract for testing
contract MockTarget {
    uint256 public callCount;
    
    function testFunction() external {
        callCount++;
    }
    
    function receiveEth() external payable {
        callCount++;
    }
    
    function revertFunction() external pure {
        revert("MockTarget: intentional revert");
    }
    
    function returnValue() external pure returns (uint256) {
        return 42;
    }
}

