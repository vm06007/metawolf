import { ethers } from 'ethers';

const ADDRESS = '0x25e32DDAE4aFe21685D9E24C06e99525bD4F9181';
const DELEGATION_PREFIX = '0xef0100';

const NETWORKS = [
    {
        name: 'Ethereum Mainnet',
        chainId: 1,
        rpcUrl: 'https://mainnet.infura.io/v3/b17509e0e2ce45f48a44289ff1aa3c73'
    },
    {
        name: 'Sepolia Testnet',
        chainId: 11155111,
        rpcUrl: 'https://sepolia.infura.io/v3/b17509e0e2ce45f48a44289ff1aa3c73'
    },
    {
        name: 'Arbitrum One',
        chainId: 42161,
        rpcUrl: 'https://arb1.arbitrum.io/rpc'
    },
    {
        name: 'Zircuit Mainnet',
        chainId: 48900,
        rpcUrl: 'https://zircuit-mainnet.drpc.org'
    }
];

async function checkDelegationOnNetwork(network: typeof NETWORKS[0]) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Checking ${network.name} (Chain ID: ${network.chainId})`);
    console.log('='.repeat(60));
    
    try {
        const provider = new ethers.JsonRpcProvider(network.rpcUrl);
        
        // Verify we're connected to the correct network
        const connectedNetwork = await provider.getNetwork();
        const actualChainId = Number(connectedNetwork.chainId);
        console.log(`Connected to chain: ${actualChainId}`);
        
        if (actualChainId !== network.chainId) {
            console.log(`⚠️  WARNING: Expected chain ${network.chainId} but got ${actualChainId}`);
        }
        
        // Get code at address
        console.log(`Checking address: ${ADDRESS}`);
        const code = await provider.getCode(ADDRESS);
        
        console.log(`Code: ${code}`);
        console.log(`Code length: ${code.length} characters (${(code.length - 2) / 2} bytes)`);
        console.log(`Starts with delegation prefix (${DELEGATION_PREFIX}): ${code.startsWith(DELEGATION_PREFIX)}`);
        
        // Check if delegated
        if (code && code.startsWith(DELEGATION_PREFIX)) {
            const delegateAddress = '0x' + code.slice(8, 48);
            console.log(`\n✅ IS DELEGATED`);
            console.log(`Delegate address: ${delegateAddress}`);
            return {
                isDelegated: true,
                delegateAddress,
                network: network.name,
                chainId: network.chainId
            };
        } else {
            console.log(`\n❌ NOT DELEGATED`);
            if (code === '0x') {
                console.log(`(Account code is empty - regular EOA)`);
            } else {
                console.log(`(Account has code but not EIP-7702 delegation)`);
            }
            return {
                isDelegated: false,
                delegateAddress: null,
                network: network.name,
                chainId: network.chainId
            };
        }
    } catch (error: any) {
        console.log(`\n❌ ERROR: ${error.message}`);
        return {
            isDelegated: false,
            delegateAddress: null,
            network: network.name,
            chainId: network.chainId,
            error: error.message
        };
    }
}

async function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║      EIP-7702 Delegation Check - All Networks             ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\nChecking address: ${ADDRESS}\n`);
    
    const results = [];
    
    for (const network of NETWORKS) {
        const result = await checkDelegationOnNetwork(network);
        results.push(result);
    }
    
    // Summary
    console.log(`\n\n${'='.repeat(60)}`);
    console.log('SUMMARY');
    console.log('='.repeat(60));
    
    const delegated = results.filter(r => r.isDelegated);
    const notDelegated = results.filter(r => !r.isDelegated && !r.error);
    const errors = results.filter(r => r.error);
    
    console.log(`\n✅ Delegated on ${delegated.length} network(s):`);
    delegated.forEach(r => {
        console.log(`   - ${r.network} (Chain ${r.chainId}): ${r.delegateAddress}`);
    });
    
    console.log(`\n❌ NOT delegated on ${notDelegated.length} network(s):`);
    notDelegated.forEach(r => {
        console.log(`   - ${r.network} (Chain ${r.chainId})`);
    });
    
    if (errors.length > 0) {
        console.log(`\n⚠️  Errors on ${errors.length} network(s):`);
        errors.forEach(r => {
            console.log(`   - ${r.network} (Chain ${r.chainId}): ${r.error}`);
        });
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
}

main().catch(console.error);

