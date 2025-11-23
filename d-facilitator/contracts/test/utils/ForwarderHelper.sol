// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ForwarderAddresses} from "../../src/utils/ForwarderAddresses.sol";

/// @title ForwarderHelper - Test utilities for forwarder addresses
/// @notice Provides helper functions for testing with correct forwarder addresses
contract ForwarderHelper {
    /// @notice Gets the simulation forwarder address for a chain
    /// @param chainName The CRE chain name
    /// @return The simulation forwarder address
    function getSimulationForwarder(string memory chainName) external pure returns (address) {
        return ForwarderAddresses.getSimulationForwarder(chainName);
    }
    
    /// @notice Gets the production forwarder address for a chain
    /// @param chainName The CRE chain name
    /// @return The production forwarder address
    function getProductionForwarder(string memory chainName) external pure returns (address) {
        return ForwarderAddresses.getProductionForwarder(chainName);
    }
    
    /// @notice Gets the forwarder address based on environment
    /// @param chainName The CRE chain name
    /// @param isSimulation True for simulation, false for production
    /// @return The forwarder address
    function getForwarder(string memory chainName, bool isSimulation) external pure returns (address) {
        return ForwarderAddresses.getForwarder(chainName, isSimulation);
    }
    
    /// @notice Common test forwarder addresses (for Sepolia testnet)
    address public constant SEPOLIA_SIMULATION_FORWARDER = 0x15fC6ae953E024d975e77382eEeC56A9101f9F88;
    address public constant SEPOLIA_PRODUCTION_FORWARDER = 0xF8344CFd5c43616a4366C34E3EEE75af79a74482;
    
    /// @notice Common test forwarder addresses (for Base Sepolia testnet)
    address public constant BASE_SEPOLIA_SIMULATION_FORWARDER = 0x82300bd7c3958625581cc2F77bC6464dcEcDF3e5;
    address public constant BASE_SEPOLIA_PRODUCTION_FORWARDER = 0xF8344CFd5c43616a4366C34E3EEE75af79a74482;
}

