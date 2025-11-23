// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title ForwarderAddresses - Utility library for CRE forwarder addresses
/// @notice Provides forwarder addresses for all CRE-supported networks
/// @dev Use simulation addresses for local testing, production addresses for mainnet deployment
library ForwarderAddresses {
    /// @notice Converts a hex string address to address type
    /// @param addr The address as a hex string (e.g., "0x1234...")
    /// @return The address type
    function _toAddress(string memory addr) private pure returns (address) {
        bytes memory addrBytes = bytes(addr);
        require(addrBytes.length == 42, "Invalid address length");
        uint160 result = 0;
        for (uint256 i = 2; i < 42; i++) {
            uint8 char = uint8(addrBytes[i]);
            uint8 value;
            if (char >= 48 && char <= 57) {
                value = char - 48;
            } else if (char >= 65 && char <= 70) {
                value = char - 55;
            } else if (char >= 97 && char <= 102) {
                value = char - 87;
            } else {
                revert("Invalid hex character");
            }
            result = result * 16 + value;
        }
        return address(result);
    }
    
    /// @notice Returns the simulation (MockKeystoneForwarder) address for a given chain
    /// @param chainName The CRE chain name (e.g., "ethereum-testnet-sepolia")
    /// @return forwarderAddress The MockKeystoneForwarder address for simulation
    function getSimulationForwarder(string memory chainName) internal pure returns (address forwarderAddress) {
        bytes32 chainHash = keccak256(bytes(chainName));
        
        // Simulation Mainnets - using exact addresses from CRE documentation
        if (chainHash == keccak256(bytes("ethereum-mainnet-arbitrum-1"))) {
            return _toAddress("0xd770499057619c9a76205fd4168161cf94abc532");
        }
        if (chainHash == keccak256(bytes("avalanche-mainnet"))) {
            return _toAddress("0xdc21e279934ff6721cadfdd112dafb3261f09a2c");
        }
        if (chainHash == keccak256(bytes("ethereum-mainnet-base-1"))) {
            return _toAddress("0x5e342a8438b4f5d39e72875fcee6f76b39cce548");
        }
        if (chainHash == keccak256(bytes("binance_smart_chain-mainnet"))) {
            return _toAddress("0x6f3239bbb26e98961e1115aba83f8a282e5508c8");
        }
        if (chainHash == keccak256(bytes("ethereum-mainnet"))) {
            return _toAddress("0xa3d1ad4ac559a6575a114998affb2fb2ec97a7d9");
        }
        if (chainHash == keccak256(bytes("ethereum-mainnet-optimism-1"))) {
            return _toAddress("0x9119a1501550ed94a3f2794038ed9258337afa18");
        }
        if (chainHash == keccak256(bytes("polygon-mainnet"))) {
            return _toAddress("0xf458d621885e29a5003ea9bbba5280d54e19b1ce");
        }
        
        // Simulation Testnets - using exact addresses from CRE documentation
        if (chainHash == keccak256(bytes("ethereum-testnet-sepolia-arbitrum-1"))) {
            return _toAddress("0xd41263567ddfead91504199b8c6c87371e83ca5d");
        }
        if (chainHash == keccak256(bytes("avalanche-testnet-fuji"))) {
            return _toAddress("0x2e7371a5d032489e4f60216d8d898a4c10805963");
        }
        if (chainHash == keccak256(bytes("ethereum-testnet-sepolia-base-1"))) {
            return _toAddress("0x82300bd7c3958625581cc2f77bc6464dcecdf3e5");
        }
        if (chainHash == keccak256(bytes("binance_smart_chain-testnet"))) {
            return _toAddress("0xa238e42cb8782808dbb2f37e19859244ec4779b0");
        }
        if (chainHash == keccak256(bytes("ethereum-testnet-sepolia"))) {
            return _toAddress("0x15fC6ae953E024d975e77382eEeC56A9101f9F88");
        }
        if (chainHash == keccak256(bytes("ethereum-testnet-sepolia-optimism-1"))) {
            return _toAddress("0xa2888380dff3704a8ab6d1cd1a8f69c15fea5ee3");
        }
        if (chainHash == keccak256(bytes("polygon-testnet-amoy"))) {
            return _toAddress("0x3675a5eb2286a3f87e8278fc66edf458a2e3bb74");
        }
        
        revert("ForwarderAddresses: Unsupported chain for simulation");
    }
    
    /// @notice Returns the production (KeystoneForwarder) address for a given chain
    /// @param chainName The CRE chain name (e.g., "ethereum-testnet-sepolia")
    /// @return forwarderAddress The KeystoneForwarder address for production
    function getProductionForwarder(string memory chainName) internal pure returns (address forwarderAddress) {
        bytes32 chainHash = keccak256(bytes(chainName));
        
        // Production Mainnets - using exact addresses from CRE documentation
        if (chainHash == keccak256(bytes("ethereum-mainnet-arbitrum-1"))) {
            return _toAddress("0xF8344CFd5c43616a4366C34E3EEE75af79a74482");
        }
        if (chainHash == keccak256(bytes("avalanche-mainnet"))) {
            return _toAddress("0x76c9cf548b4179F8901cda1f8623568b58215E62");
        }
        if (chainHash == keccak256(bytes("ethereum-mainnet-base-1"))) {
            return _toAddress("0xF8344CFd5c43616a4366C34E3EEE75af79a74482");
        }
        if (chainHash == keccak256(bytes("binance_smart_chain-mainnet"))) {
            return _toAddress("0x76c9cf548b4179F8901cda1f8623568b58215E62");
        }
        if (chainHash == keccak256(bytes("ethereum-mainnet"))) {
            return _toAddress("0x0b93082D9b3C7C97fAcd250082899BAcf3af3885");
        }
        if (chainHash == keccak256(bytes("ethereum-mainnet-optimism-1"))) {
            return _toAddress("0xF8344CFd5c43616a4366C34E3EEE75af79a74482");
        }
        if (chainHash == keccak256(bytes("polygon-mainnet"))) {
            return _toAddress("0x76c9cf548b4179F8901cda1f8623568b58215E62");
        }
        
        // Production Testnets - using exact addresses from CRE documentation
        if (chainHash == keccak256(bytes("ethereum-testnet-sepolia-arbitrum-1"))) {
            return _toAddress("0x76c9cf548b4179F8901cda1f8623568b58215E62");
        }
        if (chainHash == keccak256(bytes("avalanche-testnet-fuji"))) {
            return _toAddress("0x76c9cf548b4179F8901cda1f8623568b58215E62");
        }
        if (chainHash == keccak256(bytes("ethereum-testnet-sepolia-base-1"))) {
            return _toAddress("0xF8344CFd5c43616a4366C34E3EEE75af79a74482");
        }
        if (chainHash == keccak256(bytes("binance_smart_chain-testnet"))) {
            return _toAddress("0x76c9cf548b4179F8901cda1f8623568b58215E62");
        }
        if (chainHash == keccak256(bytes("ethereum-testnet-sepolia"))) {
            return _toAddress("0xF8344CFd5c43616a4366C34E3EEE75af79a74482");
        }
        if (chainHash == keccak256(bytes("ethereum-testnet-sepolia-optimism-1"))) {
            return _toAddress("0x76c9cf548b4179F8901cda1f8623568b58215E62");
        }
        if (chainHash == keccak256(bytes("polygon-testnet-amoy"))) {
            return _toAddress("0x76c9cf548b4179F8901cda1f8623568b58215E62");
        }
        
        revert("ForwarderAddresses: Unsupported chain for production");
    }
    
    /// @notice Returns the forwarder address based on environment
    /// @param chainName The CRE chain name
    /// @param isSimulation True for simulation addresses, false for production
    /// @return forwarderAddress The appropriate forwarder address
    function getForwarder(string memory chainName, bool isSimulation) internal pure returns (address forwarderAddress) {
        if (isSimulation) {
            return getSimulationForwarder(chainName);
        } else {
            return getProductionForwarder(chainName);
        }
    }
}

