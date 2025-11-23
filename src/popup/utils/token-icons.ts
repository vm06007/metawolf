/**
 * Token icon utilities - provides fallback logo sources for common tokens
 * Similar to chain-icons.ts, but for token logos
 * 
 * Uses stable CDN sources and includes base64 SVG fallbacks for reliability
 */

// Base64 SVG for ETH logo (final fallback)
const ETH_SVG_BASE64 = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiM2MjcFRUEiLz4KPHBhdGggZD0iTTE2IDhMMjAgMTJIMTZWMjRIMTJWMjBIMTJWMTJIMTZWOE0xNiA4SDEyVjEySDE2VjhNMTYgMTJIMjBWMjBIMTZWMjBNMTYgMTJIMTJWMjBIMTZWMjAiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4K';

// Fallback logo sources for common tokens
// Ordered by reliability: DeBank (most stable) -> TrustWallet -> CryptoLogos -> Base64 SVG
const FALLBACK_TOKEN_LOGOS: Record<string, string[]> = {
    'ETH': [
        'https://static.debank.com/image/token/logo_url/eth/42ba589cd077e7bdd97db6480b0ff61d.png',
        'https://cryptologos.cc/logos/ethereum-eth-logo.png?v=040',
        'https://cryptologos.cc/logos/ethereum-eth-logo.png',
        ETH_SVG_BASE64
    ],
    'WETH': [
        'https://static.debank.com/image/token/logo_url/eth/42ba589cd077e7bdd97db6480b0ff61d.png',
        'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
        ETH_SVG_BASE64
    ],
    'USDC': [
        'https://static.debank.com/image/token/logo_url/usdc/0a5e3299d0a7d49b0b57a5b47328875c.png',
        'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
        'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
    ],
    'USDT': [
        'https://static.debank.com/image/token/logo_url/usdt/188f3c8b5a0c0b5e5e5e5e5e5e5e5e5e.png',
        'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
        'https://cryptologos.cc/logos/tether-usdt-logo.png'
    ],
    'DAI': [
        'https://static.debank.com/image/token/logo_url/dai/549c4205d5c17b1e1e1e1e1e1e1e1e1e1e.png',
        'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png',
        'https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.png'
    ],
    'WBTC': [
        'https://static.debank.com/image/token/logo_url/wbtc/4e5c5e5e5e5e5e5e5e5e5e5e5e5e5e5e.png',
        'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png',
        'https://cryptologos.cc/logos/wrapped-bitcoin-wbtc-logo.png'
    ]
};

/**
 * Get all fallback logo URLs for a token symbol
 * Returns an array of URLs ordered by reliability
 */
export function getTokenIconFallbacks(symbol: string): string[] {
    const normalizedSymbol = symbol.toUpperCase();
    const fallbacks = FALLBACK_TOKEN_LOGOS[normalizedSymbol] || [];
    
    // If no fallbacks found, return empty array
    return fallbacks;
}

/**
 * Get the primary (first) fallback logo URL for a token
 * Returns the most reliable source
 */
export function getTokenIconPrimary(symbol: string): string | null {
    const fallbacks = getTokenIconFallbacks(symbol);
    return fallbacks.length > 0 ? fallbacks[0] : null;
}

/**
 * Get token icon with fallback support
 * Returns the primary icon URL, or null if no fallbacks available
 */
export function getTokenIcon(symbol: string, assetIcon?: string | null): string | null {
    // If asset has an icon, use it (but we'll still have fallbacks in the HTML)
    if (assetIcon) {
        return assetIcon;
    }
    
    // Otherwise, use fallback
    return getTokenIconPrimary(symbol);
}

/**
 * Generate HTML attributes for token image with multiple fallbacks
 * Similar to how chain selector handles fallbacks
 */
export function getTokenImageAttributes(symbol: string, assetIcon?: string | null): {
    src: string;
    fallbacks: string[];
} {
    const normalizedSymbol = symbol.toUpperCase();
    const fallbacks = getTokenIconFallbacks(normalizedSymbol);
    
    // Use asset icon as primary, or first fallback
    const primarySrc = assetIcon || (fallbacks.length > 0 ? fallbacks[0] : '');
    
    // Get remaining fallbacks (skip first if we're using it as primary)
    const remainingFallbacks = assetIcon ? fallbacks : fallbacks.slice(1);
    
    return {
        src: primarySrc,
        fallbacks: remainingFallbacks
    };
}

