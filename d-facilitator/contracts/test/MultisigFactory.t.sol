// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Test, console} from "forge-std/Test.sol";
import {MultisigFactory} from "../src/MultisigFactory.sol";
import {MultisigWallet} from "../src/MultisigWallet.sol";

contract MultisigFactoryTest is Test {
    MultisigFactory public factory;
    
    // Test addresses
    address public owner1 = address(0x1);
    address public owner2 = address(0x2);
    address public owner3 = address(0x3);
    address public nonOwner = address(0x999);
    
    // Test parameters
    uint256 public constant THRESHOLD = 2;
    uint256 public constant ACCEPTED_WINDOW_SECONDS = 3600; // 1 hour
    bytes32 public constant SALT = keccak256("test-salt");

    function setUp() public {
        factory = new MultisigFactory();
    }

    function test_CreateMultisig() public {
        address[] memory owners = new address[](3);
        owners[0] = owner1;
        owners[1] = owner2;
        owners[2] = owner3;

        // Compute expected address
        address expectedAddress = factory.computeAddress(
            owners,
            THRESHOLD,
            ACCEPTED_WINDOW_SECONDS,
            SALT
        );

        vm.expectEmit(true, false, false, true);
        emit MultisigFactory.MultisigCreated(
            expectedAddress,
            owners,
            THRESHOLD,
            ACCEPTED_WINDOW_SECONDS
        );

        address multisigAddress = factory.createMultisig(
            owners,
            THRESHOLD,
            ACCEPTED_WINDOW_SECONDS,
            SALT
        );

        // Verify the multisig was deployed
        assertNotEq(multisigAddress, address(0));
        
        // Verify the multisig contract exists
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(multisigAddress)
        }
        assertGt(codeSize, 0);

        // Verify the multisig configuration
        MultisigWallet multisig = MultisigWallet(payable(multisigAddress));
        assertEq(multisig.threshold(), THRESHOLD);
        assertEq(multisig.acceptedWindowSeconds(), ACCEPTED_WINDOW_SECONDS);
        
        address[] memory returnedOwners = multisig.getOwners();
        assertEq(returnedOwners.length, 3);
        assertEq(returnedOwners[0], owner1);
        assertEq(returnedOwners[1], owner2);
        assertEq(returnedOwners[2], owner3);
    }

    function test_ComputeAddress() public {
        address[] memory owners = new address[](3);
        owners[0] = owner1;
        owners[1] = owner2;
        owners[2] = owner3;

        address computedAddress = factory.computeAddress(
            owners,
            THRESHOLD,
            ACCEPTED_WINDOW_SECONDS,
            SALT
        );

        // Deploy and verify the address matches
        address deployedAddress = factory.createMultisig(
            owners,
            THRESHOLD,
            ACCEPTED_WINDOW_SECONDS,
            SALT
        );

        assertEq(computedAddress, deployedAddress);
    }

    function test_ComputeAddress_DifferentSalt() public {
        address[] memory owners = new address[](3);
        owners[0] = owner1;
        owners[1] = owner2;
        owners[2] = owner3;

        bytes32 salt1 = keccak256("salt-1");
        bytes32 salt2 = keccak256("salt-2");

        address address1 = factory.computeAddress(
            owners,
            THRESHOLD,
            ACCEPTED_WINDOW_SECONDS,
            salt1
        );

        address address2 = factory.computeAddress(
            owners,
            THRESHOLD,
            ACCEPTED_WINDOW_SECONDS,
            salt2
        );

        assertNotEq(address1, address2);
    }

    function test_ComputeAddress_DifferentWindow() public {
        address[] memory owners = new address[](3);
        owners[0] = owner1;
        owners[1] = owner2;
        owners[2] = owner3;

        uint256 window1 = 3600; // 1 hour
        uint256 window2 = 7200; // 2 hours

        address address1 = factory.computeAddress(
            owners,
            THRESHOLD,
            window1,
            SALT
        );

        address address2 = factory.computeAddress(
            owners,
            THRESHOLD,
            window2,
            SALT
        );

        assertNotEq(address1, address2);
    }

    function test_ComputeAddress_DifferentOwners() public {
        address[] memory owners1 = new address[](2);
        owners1[0] = owner1;
        owners1[1] = owner2;

        address[] memory owners2 = new address[](3);
        owners2[0] = owner1;
        owners2[1] = owner2;
        owners2[2] = owner3;

        address address1 = factory.computeAddress(
            owners1,
            THRESHOLD,
            ACCEPTED_WINDOW_SECONDS,
            SALT
        );

        address address2 = factory.computeAddress(
            owners2,
            THRESHOLD,
            ACCEPTED_WINDOW_SECONDS,
            SALT
        );

        assertNotEq(address1, address2);
    }

    function test_ComputeAddress_DifferentThreshold() public {
        address[] memory owners = new address[](3);
        owners[0] = owner1;
        owners[1] = owner2;
        owners[2] = owner3;

        address address1 = factory.computeAddress(
            owners,
            2,
            ACCEPTED_WINDOW_SECONDS,
            SALT
        );

        address address2 = factory.computeAddress(
            owners,
            3,
            ACCEPTED_WINDOW_SECONDS,
            SALT
        );

        assertNotEq(address1, address2);
    }

    function test_CreateMultisig_DeterministicAddress() public {
        address[] memory owners = new address[](3);
        owners[0] = owner1;
        owners[1] = owner2;
        owners[2] = owner3;

        // Compute address before deployment
        address computedAddress = factory.computeAddress(
            owners,
            THRESHOLD,
            ACCEPTED_WINDOW_SECONDS,
            SALT
        );

        // Deploy first multisig
        address deployedAddress1 = factory.createMultisig(
            owners,
            THRESHOLD,
            ACCEPTED_WINDOW_SECONDS,
            SALT
        );

        assertEq(computedAddress, deployedAddress1);

        // Try to deploy again with same parameters - should fail (address already exists)
        vm.expectRevert();
        factory.createMultisig(
            owners,
            THRESHOLD,
            ACCEPTED_WINDOW_SECONDS,
            SALT
        );
    }

    function test_CreateMultisig_WithTimeWindow() public {
        address[] memory owners = new address[](3);
        owners[0] = owner1;
        owners[1] = owner2;
        owners[2] = owner3;

        uint256 windowSeconds = 1800; // 30 minutes

        address multisigAddress = factory.createMultisig(
            owners,
            THRESHOLD,
            windowSeconds,
            SALT
        );

        MultisigWallet multisig = MultisigWallet(payable(multisigAddress));
        assertEq(multisig.acceptedWindowSeconds(), windowSeconds);
    }

    function test_CreateMultisig_EventEmitted() public {
        address[] memory owners = new address[](2);
        owners[0] = owner1;
        owners[1] = owner2;

        bytes32 salt = keccak256("event-test-salt");
        
        // Compute expected address
        address expectedAddress = factory.computeAddress(
            owners,
            THRESHOLD,
            ACCEPTED_WINDOW_SECONDS,
            salt
        );

        vm.expectEmit(true, false, false, true);
        emit MultisigFactory.MultisigCreated(
            expectedAddress,
            owners,
            THRESHOLD,
            ACCEPTED_WINDOW_SECONDS
        );

        address multisigAddress = factory.createMultisig(
            owners,
            THRESHOLD,
            ACCEPTED_WINDOW_SECONDS,
            salt
        );

        // Verify the address matches
        assertEq(multisigAddress, expectedAddress);
    }

    function test_CreateMultisig_MultipleMultisigs() public {
        address[] memory owners1 = new address[](2);
        owners1[0] = owner1;
        owners1[1] = owner2;

        address[] memory owners2 = new address[](2);
        owners2[0] = owner2;
        owners2[1] = owner3;

        address multisig1 = factory.createMultisig(
            owners1,
            2,
            ACCEPTED_WINDOW_SECONDS,
            keccak256("salt-1")
        );

        address multisig2 = factory.createMultisig(
            owners2,
            2,
            ACCEPTED_WINDOW_SECONDS,
            keccak256("salt-2")
        );

        assertNotEq(multisig1, multisig2);
        assertNotEq(multisig1, address(0));
        assertNotEq(multisig2, address(0));
    }

    function test_CreateMultisig_ZeroWindow() public {
        address[] memory owners = new address[](2);
        owners[0] = owner1;
        owners[1] = owner2;

        // Zero window should be allowed (though it might not be practical)
        address multisigAddress = factory.createMultisig(
            owners,
            THRESHOLD,
            0,
            SALT
        );

        MultisigWallet multisig = MultisigWallet(payable(multisigAddress));
        assertEq(multisig.acceptedWindowSeconds(), 0);
    }

    function test_CreateMultisig_LargeWindow() public {
        address[] memory owners = new address[](2);
        owners[0] = owner1;
        owners[1] = owner2;

        uint256 largeWindow = 365 days; // 1 year

        address multisigAddress = factory.createMultisig(
            owners,
            THRESHOLD,
            largeWindow,
            SALT
        );

        MultisigWallet multisig = MultisigWallet(payable(multisigAddress));
        assertEq(multisig.acceptedWindowSeconds(), largeWindow);
    }
}

