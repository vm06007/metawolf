/**
 * Multisig Factory Configuration
 * Factory contract addresses per chain
 *
 * TODO: Deploy MultisigFactory contract on each chain and update these addresses
 */
export const MULTISIG_FACTORY_ADDRESSES: Record<number, string> = {
    // Mainnet
    1: '0xfF25B865d75583FB77102De88901Bf9c1C51B6C0',
    // Sepolia
    11155111: '0x0000000000000000000000000000000000000000', // TODO: Deploy factory
    // Polygon
    137: '0x0000000000000000000000000000000000000000', // TODO: Deploy factory
    // Base
    8453: '0x0000000000000000000000000000000000000000', // TODO: Deploy factory
    // Arbitrum
    42161: '0x0000000000000000000000000000000000000000', // TODO: Deploy factory
    // Optimism
    10: '0x0000000000000000000000000000000000000000', // TODO: Deploy factory
    // Avalanche
    43114: '0x0000000000000000000000000000000000000000', // TODO: Deploy factory
    // BSC
    56: '0x0000000000000000000000000000000000000000', // TODO: Deploy factory
};

/**
 * Get factory address for a given chain ID
 */
export function getMultisigFactoryAddress(chainId: number): string {
    const address = MULTISIG_FACTORY_ADDRESSES[chainId];
    if (!address || address === '0x0000000000000000000000000000000000000000') {
        throw new Error(
            `MultisigFactory contract not deployed on chain ${chainId}. ` +
            `Please deploy the MultisigFactory contract first. ` +
            `See src/contracts/MultisigFactory.sol for the contract code.`
        );
    }
    return address;
}

/**
 * Check if factory is configured for a chain
 */
export function isFactoryConfigured(chainId: number): boolean {
    const address = MULTISIG_FACTORY_ADDRESSES[chainId];
    return !!address && address !== '0x0000000000000000000000000000000000000000';
}

