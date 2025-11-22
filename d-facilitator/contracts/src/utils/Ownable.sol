// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title Ownable - Simple ownership pattern
/// @notice Provides basic authorization control functions
abstract contract Ownable {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner(address caller, address owner);
    error InvalidOwner(address newOwner);

    /// @notice Initializes the contract setting the deployer as the initial owner
    constructor() {
        _transferOwnership(msg.sender);
    }

    /// @notice Returns the address of the current owner
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /// @notice Throws if called by any account other than the owner
    modifier onlyOwner() {
        if (msg.sender != _owner) {
            revert NotOwner(msg.sender, _owner);
        }
        _;
    }

    /// @notice Transfers ownership of the contract to a new account
    /// @param newOwner The address to transfer ownership to
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert InvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    /// @notice Transfers ownership of the contract to a new account
    /// @param newOwner The address to transfer ownership to
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

