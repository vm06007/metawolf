// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MultisigWallet.sol";

/**
 * Factory for deploying MultisigWallet contracts
 * Uses CREATE2 for deterministic addresses
 */
contract MultisigFactory {
    event MultisigCreated(
        address indexed multisig,
        address[] owners,
        uint256 threshold,
        uint256 acceptedWindowSeconds
    );

    /**
     * Deploy a new multisig wallet with CREATE2 for deterministic address
     */
    function createMultisig(
        address[] calldata owners,
        uint256 threshold,
        uint256 acceptedWindowSeconds,
        bytes32 salt
    ) external returns (address) {
        // Deploy multisig wallet
        MultisigWallet multisig = new MultisigWallet{salt: salt}(
            owners,
            threshold,
            acceptedWindowSeconds
        );
        address multisigAddress = address(multisig);

        emit MultisigCreated(multisigAddress, owners, threshold, acceptedWindowSeconds);

        return multisigAddress;
    }

    /**
     * Compute the address of a multisig wallet before deployment
     */
    function computeAddress(
        address[] calldata owners,
        uint256 threshold,
        uint256 acceptedWindowSeconds,
        bytes32 salt
    ) external view returns (address) {
        bytes memory bytecode = abi.encodePacked(
            type(MultisigWallet).creationCode,
            abi.encode(owners, threshold, acceptedWindowSeconds)
        );

        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(bytecode)
            )
        );

        return address(uint160(uint256(hash)));
    }
}
