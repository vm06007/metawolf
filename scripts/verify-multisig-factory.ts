#!/usr/bin/env bun
/**
 * Verify MultisigFactory contract on Etherscan
 *
 * Usage:
 *   bun scripts/verify-multisig-factory.ts --chain <chainId> --api-key <etherscanApiKey>
 *
 * Example:
 *   bun scripts/verify-multisig-factory.ts --chain 1 --api-key YOUR_API_KEY
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : undefined;
}

const chainId = parseInt(getArg('chain') || '1');
const apiKey = getArg('api-key') || process.env.ETHERSCAN_API_KEY;

if (!apiKey) {
    console.error('Error: Etherscan API key required. Use --api-key or set ETHERSCAN_API_KEY env var');
    process.exit(1);
}

const ETHERSCAN_APIS: Record<number, string> = {
    1: 'https://api.etherscan.io/v2/api',
    11155111: 'https://api-sepolia.etherscan.io/v2/api',
    137: 'https://api.polygonscan.com/v2/api',
    8453: 'https://api.basescan.org/v2/api',
    42161: 'https://api.arbiscan.io/v2/api',
    10: 'https://api-optimistic.etherscan.io/v2/api',
    43114: 'https://api.snowtrace.io/v2/api',
    56: 'https://api.bscscan.com/v2/api',
};

const CHAIN_NAMES: Record<number, string> = {
    1: 'Ethereum Mainnet',
    11155111: 'Sepolia Testnet',
    137: 'Polygon',
    8453: 'Base',
    42161: 'Arbitrum',
    10: 'Optimism',
    43114: 'Avalanche',
    56: 'BSC',
};

const etherscanApi = ETHERSCAN_APIS[chainId];
if (!etherscanApi) {
    console.error(`Error: Etherscan API not configured for chain ${chainId}`);
    process.exit(1);
}

console.log(`\n🔍 Verifying MultisigFactory on ${CHAIN_NAMES[chainId] || `Chain ${chainId}`}\n`);

// Load deployment info
const deploymentsPath = join(process.cwd(), 'deployments.json');
let deploymentInfo: any;
try {
    const deployments = JSON.parse(readFileSync(deploymentsPath, 'utf8'));
    deploymentInfo = deployments[chainId];
    if (!deploymentInfo) {
        console.error(`Error: No deployment found for chain ${chainId}`);
        process.exit(1);
    }
} catch (error) {
    console.error('Error: Could not load deployments.json');
    process.exit(1);
}

console.log(`  Contract: ${deploymentInfo.contractAddress}`);
console.log(`  Transaction: ${deploymentInfo.transactionHash}\n`);

// Read contract sources
const contractsDir = join(process.cwd(), 'src/contracts');
const multisigWalletSource = readFileSync(join(contractsDir, 'MultisigWallet.sol'), 'utf8');
const multisigFactorySource = readFileSync(join(contractsDir, 'MultisigFactory.sol'), 'utf8');

// Prepare source code for verification
// Etherscan expects a JSON with all sources
const sourceCode = JSON.stringify({
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
        evmVersion: 'paris',
        outputSelection: {
            '*': {
                '*': ['*']
            }
        }
    }
});

console.log('📤 Submitting verification request...\n');

// Submit verification
const formData = new URLSearchParams({
    apikey: apiKey,
    chainid: chainId.toString(),
    module: 'contract',
    action: 'verifysourcecode',
    contractaddress: deploymentInfo.contractAddress,
    sourceCode: sourceCode,
    codeformat: 'solidity-standard-json-input',
    contractname: 'contracts/MultisigFactory.sol:MultisigFactory',
    compilerversion: 'v0.8.30+commit.73712a01', // Solc version we're using
    optimizationUsed: '1',
    runs: '200',
    evmversion: 'paris',
    licenseType: '3', // MIT License
});

async function submitVerification() {
    const response = await fetch(etherscanApi, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
    });

    const result = await response.json();

    if (result.status === '1') {
        console.log('✅ Verification submitted successfully!');
        console.log(`  GUID: ${result.result}\n`);
        return result.result;
    } else {
        // Check if already verified
        if (result.result && result.result.includes('already verified')) {
            console.log('✅ Contract is already verified!\n');
            return null;
        }
        throw new Error(result.result || 'Verification failed');
    }
}

async function checkVerificationStatus(guid: string) {
    console.log('⏳ Checking verification status...\n');

    let attempts = 0;
    const maxAttempts = 30; // 30 attempts with 2 second intervals = 1 minute

    while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

        const response = await fetch(
            `${etherscanApi}?chainid=${chainId}&module=contract&action=checkverifystatus&guid=${guid}&apikey=${apiKey}`
        );

        const result = await response.json();

        if (result.status === '1') {
            console.log('✅ Contract verified successfully!\n');
            console.log(`View on Etherscan:`);
            if (chainId === 1) {
                console.log(`  https://etherscan.io/address/${deploymentInfo.contractAddress}#code\n`);
            } else if (chainId === 11155111) {
                console.log(`  https://sepolia.etherscan.io/address/${deploymentInfo.contractAddress}#code\n`);
            }
            return true;
        } else if (result.result === 'Pending in queue') {
            process.stdout.write('.');
        } else if (result.result && result.result.includes('Fail')) {
            console.error(`\n❌ Verification failed: ${result.result}\n`);
            return false;
        }

        attempts++;
    }

    console.log('\n⏱️  Verification is taking longer than expected.');
    console.log('You can check the status manually on Etherscan.\n');
    return false;
}

try {
    const guid = await submitVerification();

    if (guid) {
        await checkVerificationStatus(guid);
    }

    console.log('🎉 Done!\n');
} catch (error: any) {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
}
