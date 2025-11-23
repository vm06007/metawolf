#!/usr/bin/env bun
/**
 * Deploy MultisigFactory contract to Ethereum mainnet
 *
 * Usage:
 *   bun scripts/deploy-multisig-factory.ts --chain <chainId> --rpc <rpcUrl> --private-key <privateKey>
 *
 * Example:
 *   bun scripts/deploy-multisig-factory.ts --chain 1 --rpc https://eth.llamarpc.com --private-key 0x...
 *   bun scripts/deploy-multisig-factory.ts --chain 11155111 --rpc https://sepolia.drpc.org --private-key 0x...
 */

import { ethers } from 'ethers';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import solc from 'solc';

// Parse command line arguments
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : undefined;
}

const chainId = parseInt(getArg('chain') || '11155111'); // Default to Sepolia
const rpcUrl = getArg('rpc') || 'https://sepolia.drpc.org';
const privateKey = getArg('private-key') || process.env.PRIVATE_KEY || process.env.GAS_STATION_PRIVATE_KEY;

if (!privateKey) {
    console.error('Error: Private key required. Use --private-key or set PRIVATE_KEY/GAS_STATION_PRIVATE_KEY env var');
    process.exit(1);
}

const CHAIN_NAMES: Record<number, string> = {
    1: 'Ethereum Mainnet',
    11155111: 'Sepolia Testnet',
    137: 'Polygon',
    8453: 'Base',
    42161: 'Arbitrum',
    10: 'Optimism',
    43114: 'Avalanche',
    56: 'BSC',
    48900: 'Zircuit Mainnet',
};

console.log(`\n🚀 Deploying MultisigFactory to ${CHAIN_NAMES[chainId] || `Chain ${chainId}`}\n`);

// Compile contracts
console.log('🔨 Compiling contracts...');
const contractsDir = join(process.cwd(), 'src/contracts');

// Read contract sources
const multisigWalletPath = join(contractsDir, 'MultisigWallet.sol');
const multisigWalletSource = readFileSync(multisigWalletPath, 'utf8');

const multisigFactoryPath = join(contractsDir, 'MultisigFactory.sol');
let multisigFactorySource = readFileSync(multisigFactoryPath, 'utf8');

// Fix import path for solc compilation
multisigFactorySource = multisigFactorySource.replace(
    'import "./MultisigWallet.sol";',
    'import "contracts/MultisigWallet.sol";'
);

// Setup solc input with proper import resolution
const input = {
    language: 'Solidity',
    sources: {
        'contracts/MultisigWallet.sol': {
            content: multisigWalletSource
        },
        'contracts/MultisigFactory.sol': {
            content: multisigFactorySource
        }
    },
    settings: {
        optimizer: {
            enabled: true,
            runs: 200
        },
        outputSelection: {
            '*': {
                '*': ['abi', 'evm.bytecode', 'evm.bytecode.sourceMap']
            }
        },
        evmVersion: 'paris' // Use Paris for better compatibility
    }
};

console.log('  Compiling with solc...');
const output = JSON.parse(solc.compile(JSON.stringify(input)));

// Check for errors
if (output.errors) {
    const errors = output.errors.filter((e: any) => e.severity === 'error');
    if (errors.length > 0) {
        console.error('❌ Compilation errors:');
        errors.forEach((err: any) => console.error(err.formattedMessage));
        process.exit(1);
    }
}

const contract = output.contracts['contracts/MultisigFactory.sol']['MultisigFactory'];
const abi = contract.abi;
const bytecode = '0x' + contract.evm.bytecode.object;

console.log(`  Bytecode size: ${bytecode.length / 2 - 1} bytes`);

console.log('✅ Contracts compiled successfully\n');

try {

    // Deploy
    console.log('🌐 Connecting to network...');
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const deployerAddress = await wallet.getAddress();

    console.log(`  Deployer: ${deployerAddress}`);

    const balance = await provider.getBalance(deployerAddress);
    console.log(`  Balance: ${ethers.formatEther(balance)} ETH`);

    if (balance === 0n) {
        console.error('\n❌ Error: Deployer has no balance');
        process.exit(1);
    }

    // Get fee data first
    const feeData = await provider.getFeeData();
    console.log(`  Gas price: ${feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, 'gwei') : 'N/A'} gwei`);

    // Deploy with manual gas limit (bytecode is ~5KB, so 2M gas should be more than enough)
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const gasLimit = 2_000_000n;

    const estimatedCost = gasLimit * (feeData.maxFeePerGas || feeData.gasPrice || 0n);
    console.log(`  Gas limit: ${gasLimit.toString()}`);
    console.log(`  Estimated cost: ${ethers.formatEther(estimatedCost)} ETH\n`);

    // Confirm deployment
    console.log('⏳ Deploying MultisigFactory...');

    const contract = await factory.deploy({ gasLimit });
    console.log(`  Transaction: ${contract.deploymentTransaction()?.hash}`);

    console.log('  Waiting for confirmation...');
    await contract.waitForDeployment();

    const contractAddress = await contract.getAddress();
    console.log(`\n✅ MultisigFactory deployed to: ${contractAddress}\n`);

    // Update config file
    console.log('📝 Updating configuration...');
    const configPath = join(process.cwd(), 'src/core/multisig-config.ts');
    let configSource = readFileSync(configPath, 'utf8');

    // Replace the address for this chain
    const regex = new RegExp(`(\\s*${chainId}:\\s*)'0x0000000000000000000000000000000000000000'(,?.*\\/\\/ TODO: Deploy factory)`);
    configSource = configSource.replace(
        regex,
        `$1'${contractAddress}'$2`
    );

    writeFileSync(configPath, configSource);
    console.log(`✅ Updated ${configPath}\n`);

    // Save deployment info
    const deploymentInfo = {
        chainId,
        chainName: CHAIN_NAMES[chainId] || `Chain ${chainId}`,
        contractAddress,
        transactionHash: contract.deploymentTransaction()?.hash,
        deployer: deployerAddress,
        timestamp: new Date().toISOString(),
        rpcUrl,
    };

    const deploymentsPath = join(process.cwd(), 'deployments.json');
    let deployments: any = {};
    try {
        deployments = JSON.parse(readFileSync(deploymentsPath, 'utf8'));
    } catch {
        // File doesn't exist yet
    }

    deployments[chainId] = deploymentInfo;
    writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));

    console.log('📄 Deployment info saved to deployments.json\n');
    console.log('🎉 Deployment complete!\n');
    console.log(`Next steps:`);
    console.log(`  1. Verify the contract on Etherscan`);
    console.log(`  2. Test creating a multisig wallet`);
    console.log(`  3. Deploy to other chains if needed\n`);

} catch (error: any) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
}
