/**
 * ERC20 transfer function selector
 * keccak256("transfer(address,uint256)") = 0xa9059cbb2ab09eb219583f4a59a5d0623ade346d962bcd4e46b11da047c9049b
 * First 4 bytes: 0xa9059cbb
 */
const TRANSFER_SELECTOR = '0xa9059cbb';

/**
 * Encode address to 32-byte hex string (padded)
 */
function encodeAddress(address: string): string {
    // Remove 0x prefix if present
    const addr = address.startsWith('0x') ? address.slice(2) : address;
    // Pad to 32 bytes (64 hex chars)
    return '0'.repeat(24) + addr.toLowerCase();
}

/**
 * Encode uint256 to 32-byte hex string
 */
function encodeUint256(value: bigint): string {
    // Convert to hex and remove 0x prefix
    const hex = value.toString(16);
    // Pad to 32 bytes (64 hex chars)
    return '0'.repeat(64 - hex.length) + hex;
}

/**
 * Encode ERC20 transfer function call
 * @param recipient - Recipient address
 * @param amount - Amount in token's smallest unit (wei for 18 decimals)
 * @returns Encoded function data
 */
export function encodeERC20Transfer(recipient: string, amount: bigint): string {
    // Function selector (4 bytes)
    const selector = TRANSFER_SELECTOR.slice(2); // Remove 0x
    
    // Encode parameters
    const encodedRecipient = encodeAddress(recipient);
    const encodedAmount = encodeUint256(amount);
    
    // Concatenate: selector + recipient (32 bytes) + amount (32 bytes)
    return '0x' + selector + encodedRecipient + encodedAmount;
}

/**
 * Get token contract address for common tokens
 * This is a fallback - ideally we'd get this from the asset data
 */
export function getTokenContractAddress(symbol: string, chainId: number): string | null {
    // Common ERC20 token addresses on Ethereum mainnet
    const MAINNET_TOKENS: Record<string, string> = {
        'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        'WETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        'WBTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    };

    // Common ERC20 token addresses on other chains
    if (chainId === 1) {
        return MAINNET_TOKENS[symbol.toUpperCase()] || null;
    }

    // For other chains, we'd need to maintain a mapping
    // For now, return null and let the caller handle it
    return null;
}

/**
 * Check if a token symbol is a native token (ETH, MATIC, etc.)
 */
export function isNativeToken(symbol: string): boolean {
    const nativeTokens = ['ETH', 'MATIC', 'BNB', 'AVAX', 'FTM', 'ARB', 'OP'];
    return nativeTokens.includes(symbol.toUpperCase());
}

