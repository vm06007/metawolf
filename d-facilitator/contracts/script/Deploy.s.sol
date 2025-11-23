// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {SettlementReceiver} from "../src/SettlementReceiver.sol";
import {ExecutionProxy} from "../src/ExecutionProxy.sol";
import {ForwarderAddresses} from "../src/utils/ForwarderAddresses.sol";

/// @title Deploy - Deployment script for SettlementReceiver and ExecutionProxy
/// @notice Deploys contracts with proper forwarder configuration based on chain
/// @dev Set CHAIN_NAME and IS_SIMULATION environment variables before running
contract Deploy is Script {
    // Default values - can be overridden via environment variables
    string constant DEFAULT_CHAIN_NAME = "ethereum-testnet-sepolia";
    bool constant DEFAULT_IS_SIMULATION = true;
    
    // Default workflow configuration (update these for your workflow)
    address constant DEFAULT_EXPECTED_AUTHOR = address(0x1234567890123456789012345678901234567890);
    bytes10 constant DEFAULT_EXPECTED_WORKFLOW_NAME = bytes10("d-settle");
    bytes32 constant DEFAULT_EXPECTED_WORKFLOW_ID = bytes32(uint256(0x1234567890123456789012345678901234567890123456789012345678901234));
    
    function run() external {
        // Get configuration from environment or use defaults
        string memory chainName = vm.envOr("CHAIN_NAME", DEFAULT_CHAIN_NAME);
        bool isSimulation = vm.envOr("IS_SIMULATION", DEFAULT_IS_SIMULATION);
        
        // Get forwarder address for the chain
        address forwarder = ForwarderAddresses.getForwarder(chainName, isSimulation);
        
        console2.log("=== Deployment Configuration ===");
        console2.log("Chain Name:", chainName);
        console2.log("Is Simulation:", isSimulation);
        console2.log("Forwarder Address:", forwarder);
        console2.log("Expected Author:", DEFAULT_EXPECTED_AUTHOR);
        console2.log("Expected Workflow Name:", vm.toString(DEFAULT_EXPECTED_WORKFLOW_NAME));
        console2.log("================================");
        
        // Start broadcast using the private key from --private-key flag
        // If no --private-key is provided, will use default Anvil key for local testing
        vm.startBroadcast();
        
        // Deploy SettlementReceiver first (needed for ExecutionProxy)
        console2.log("\nDeploying SettlementReceiver...");
        SettlementReceiver settlementReceiver = new SettlementReceiver();
        console2.log("SettlementReceiver deployed at:", address(settlementReceiver));
        
        // Configure SettlementReceiver with all parameters
        console2.log("\nConfiguring SettlementReceiver...");
        // settlementReceiver.addKeystoneForwarder(forwarder);
        // console2.log("KeystoneForwarder added:", forwarder);
        // settlementReceiver.addExpectedWorkflowId(DEFAULT_EXPECTED_WORKFLOW_ID);
        // console2.log("ExpectedWorkflowId added");
        // settlementReceiver.addExpectedAuthor(DEFAULT_EXPECTED_AUTHOR);
        // console2.log("ExpectedAuthor added");
        // settlementReceiver.addExpectedWorkflowName(DEFAULT_EXPECTED_WORKFLOW_NAME);
        // console2.log("ExpectedWorkflowName added");
        
        // Deploy ExecutionProxy with SettlementReceiver as authorized caller
        console2.log("\nDeploying ExecutionProxy...");
        ExecutionProxy executionProxy = new ExecutionProxy(address(settlementReceiver));
        console2.log("ExecutionProxy deployed at:", address(executionProxy));
        
        // Set ExecutionProxy in SettlementReceiver
        // settlementReceiver.setExecutionProxy(address(executionProxy));
        // console2.log("ExecutionProxy set in SettlementReceiver");
        
        // Transfer ownership if needed (optional)
        // address newOwner = vm.envAddress("NEW_OWNER");
        // if (newOwner != address(0)) {
        //     settlementReceiver.transferOwnership(newOwner);
        //     console2.log("Ownership transferred to:", newOwner);
        // }
        
        vm.stopBroadcast();
        
        console2.log("\n=== Deployment Summary ===");
        console2.log("SettlementReceiver:", address(settlementReceiver));
        console2.log("ExecutionProxy:", address(executionProxy));
        console2.log("Forwarder:", forwarder);
        console2.log("Chain:", chainName);
        console2.log("Environment:", isSimulation ? "Simulation" : "Production");
        console2.log("==========================");
        
        // Output for easy copy-paste
        console2.log("\n=== Configuration for workflow ===");
        console2.log("settlementReceiverAddress:", address(settlementReceiver));
        console2.log("================================");
    }
}

