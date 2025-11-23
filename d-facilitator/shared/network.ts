/// @notice Maps x402 network string to CRE chainSelectorName
/// @param network The network string from payment request (e.g., "base-sepolia", "ethereum-testnet-sepolia")
/// @returns The CRE chainSelectorName and isTestnet flag
/// @dev Maps x402 network formats to CRE's official chainSelectorName format
export function getNetworkInfo(network: string): { chainSelectorName: string; isTestnet: boolean } {
  // Mapping from x402 network strings to CRE chainSelectorName format
  // Based on CRE's official supported networks documentation
  const networkMap: Record<string, { chainSelectorName: string; isTestnet: boolean }> = {
    // Mainnets
    'arbitrum': { chainSelectorName: 'ethereum-mainnet-arbitrum-1', isTestnet: false },
    'arbitrum-one': { chainSelectorName: 'ethereum-mainnet-arbitrum-1', isTestnet: false },
    'avalanche': { chainSelectorName: 'avalanche-mainnet', isTestnet: false },
    'base': { chainSelectorName: 'ethereum-mainnet-base-1', isTestnet: false },
    'base-mainnet': { chainSelectorName: 'ethereum-mainnet-base-1', isTestnet: false },
    'bsc': { chainSelectorName: 'binance_smart_chain-mainnet', isTestnet: false },
    'binance-smart-chain': { chainSelectorName: 'binance_smart_chain-mainnet', isTestnet: false },
    'ethereum': { chainSelectorName: 'ethereum-mainnet', isTestnet: false },
    'ethereum-mainnet': { chainSelectorName: 'ethereum-mainnet', isTestnet: false },
    'optimism': { chainSelectorName: 'ethereum-mainnet-optimism-1', isTestnet: false },
    'optimism-mainnet': { chainSelectorName: 'ethereum-mainnet-optimism-1', isTestnet: false },
    'op-mainnet': { chainSelectorName: 'ethereum-mainnet-optimism-1', isTestnet: false },
    'polygon': { chainSelectorName: 'polygon-mainnet', isTestnet: false },
    'polygon-mainnet': { chainSelectorName: 'polygon-mainnet', isTestnet: false },
    
    // Testnets
    'arbitrum-sepolia': { chainSelectorName: 'ethereum-testnet-sepolia-arbitrum-1', isTestnet: true },
    'arbitrum-testnet': { chainSelectorName: 'ethereum-testnet-sepolia-arbitrum-1', isTestnet: true },
    'avalanche-fuji': { chainSelectorName: 'avalanche-testnet-fuji', isTestnet: true },
    'avalanche-testnet': { chainSelectorName: 'avalanche-testnet-fuji', isTestnet: true },
    'base-sepolia': { chainSelectorName: 'ethereum-testnet-sepolia-base-1', isTestnet: true },
    'base-testnet': { chainSelectorName: 'ethereum-testnet-sepolia-base-1', isTestnet: true },
    'bsc-testnet': { chainSelectorName: 'binance_smart_chain-testnet', isTestnet: true },
    'binance-smart-chain-testnet': { chainSelectorName: 'binance_smart_chain-testnet', isTestnet: true },
    'ethereum-sepolia': { chainSelectorName: 'ethereum-testnet-sepolia', isTestnet: true },
    'ethereum-testnet-sepolia': { chainSelectorName: 'ethereum-testnet-sepolia', isTestnet: true },
    'sepolia': { chainSelectorName: 'ethereum-testnet-sepolia', isTestnet: true },
    'optimism-sepolia': { chainSelectorName: 'ethereum-testnet-sepolia-optimism-1', isTestnet: true },
    'optimism-testnet': { chainSelectorName: 'ethereum-testnet-sepolia-optimism-1', isTestnet: true },
    'op-sepolia': { chainSelectorName: 'ethereum-testnet-sepolia-optimism-1', isTestnet: true },
    'polygon-amoy': { chainSelectorName: 'polygon-testnet-amoy', isTestnet: true },
    'polygon-testnet': { chainSelectorName: 'polygon-testnet-amoy', isTestnet: true },
  };
  
  // Normalize network string (lowercase, replace spaces/underscores with hyphens)
  const normalized = network.toLowerCase().replace(/[\s_]/g, '-');
  
  // Check if we have a direct mapping
  if (networkMap[normalized]) {
    return networkMap[normalized];
  }
  
  // Fallback: try to determine from common patterns
  const isTestnet = normalized.includes('testnet') || 
                    normalized.includes('sepolia') || 
                    normalized.includes('goerli') ||
                    normalized.includes('mumbai') ||
                    normalized.includes('fuji') ||
                    normalized.includes('amoy');
  
  // If no direct mapping, try to construct CRE format
  // This is a fallback for networks that might not be in our map
  // Most x402 networks should match CRE format directly
  if (normalized.includes('ethereum-testnet-sepolia') || normalized === 'ethereum-testnet-sepolia') {
    return { chainSelectorName: 'ethereum-testnet-sepolia', isTestnet: true };
  }
  
  // Default: assume the network string matches CRE format
  // Log a warning if we're using fallback
  return {
    chainSelectorName: network, // Use original network string as fallback
    isTestnet,
  };
}

