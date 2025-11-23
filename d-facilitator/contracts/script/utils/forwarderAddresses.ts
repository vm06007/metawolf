/**
 * Forwarder Addresses for CRE Networks
 * 
 * Utility functions for getting forwarder addresses per chain for deployment and testing.
 * Based on CRE's official supported networks documentation.
 */

export type ChainName =
  // Mainnets
  | "ethereum-mainnet-arbitrum-1"
  | "avalanche-mainnet"
  | "ethereum-mainnet-base-1"
  | "binance_smart_chain-mainnet"
  | "ethereum-mainnet"
  | "ethereum-mainnet-optimism-1"
  | "polygon-mainnet"
  // Testnets
  | "ethereum-testnet-sepolia-arbitrum-1"
  | "avalanche-testnet-fuji"
  | "ethereum-testnet-sepolia-base-1"
  | "binance_smart_chain-testnet"
  | "ethereum-testnet-sepolia"
  | "ethereum-testnet-sepolia-optimism-1"
  | "polygon-testnet-amoy";

/**
 * Simulation (MockKeystoneForwarder) addresses for local testing
 * Use these when running `cre workflow simulate --broadcast`
 */
export const SIMULATION_FORWARDERS: Record<ChainName, string> = {
  // Mainnets
  "ethereum-mainnet-arbitrum-1": "0xd770499057619c9a76205fd4168161cf94abc532",
  "avalanche-mainnet": "0xdc21e279934ff6721cadfdd112dafb3261f09a2c",
  "ethereum-mainnet-base-1": "0x5e342a8438b4f5d39e72875fcee6f76b39cce548",
  "binance_smart_chain-mainnet": "0x6f3239bbb26e98961e1115aba83f8a282e5508c8",
  "ethereum-mainnet": "0xa3d1ad4ac559a6575a114998affb2fb2ec97a7d9",
  "ethereum-mainnet-optimism-1": "0x9119a1501550ed94a3f2794038ed9258337afa18",
  "polygon-mainnet": "0xf458d621885e29a5003ea9bbba5280d54e19b1ce",
  // Testnets
  "ethereum-testnet-sepolia-arbitrum-1": "0xd41263567ddfead91504199b8c6c87371e83ca5d",
  "avalanche-testnet-fuji": "0x2e7371a5d032489e4f60216d8d898a4c10805963",
  "ethereum-testnet-sepolia-base-1": "0x82300bd7c3958625581cc2f77bc6464dcecdf3e5",
  "binance_smart_chain-testnet": "0xa238e42cb8782808dbb2f37e19859244ec4779b0",
  "ethereum-testnet-sepolia": "0x15fC6ae953E024d975e77382eEeC56A9101f9F88",
  "ethereum-testnet-sepolia-optimism-1": "0xa2888380dff3704a8ab6d1cd1a8f69c15fea5ee3",
  "polygon-testnet-amoy": "0x3675a5eb2286a3f87e8278fc66edf458a2e3bb74",
};

/**
 * Production (KeystoneForwarder) addresses for deployed workflows
 * Use these when deploying to production
 */
export const PRODUCTION_FORWARDERS: Record<ChainName, string> = {
  // Mainnets
  "ethereum-mainnet-arbitrum-1": "0xF8344CFd5c43616a4366C34E3EEE75af79a74482",
  "avalanche-mainnet": "0x76c9cf548b4179F8901cda1f8623568b58215E62",
  "ethereum-mainnet-base-1": "0xF8344CFd5c43616a4366C34E3EEE75af79a74482",
  "binance_smart_chain-mainnet": "0x76c9cf548b4179F8901cda1f8623568b58215E62",
  "ethereum-mainnet": "0x0b93082D9b3C7C97fAcd250082899BAcf3af3885",
  "ethereum-mainnet-optimism-1": "0xF8344CFd5c43616a4366C34E3EEE75af79a74482",
  "polygon-mainnet": "0x76c9cf548b4179F8901cda1f8623568b58215E62",
  // Testnets
  "ethereum-testnet-sepolia-arbitrum-1": "0x76c9cf548b4179F8901cda1f8623568b58215E62",
  "avalanche-testnet-fuji": "0x76c9cf548b4179F8901cda1f8623568b58215E62",
  "ethereum-testnet-sepolia-base-1": "0xF8344CFd5c43616a4366C34E3EEE75af79a74482",
  "binance_smart_chain-testnet": "0x76c9cf548b4179F8901cda1f8623568b58215E62",
  "ethereum-testnet-sepolia": "0xF8344CFd5c43616a4366C34E3EEE75af79a74482",
  "ethereum-testnet-sepolia-optimism-1": "0x76c9cf548b4179F8901cda1f8623568b58215E62",
  "polygon-testnet-amoy": "0x76c9cf548b4179F8901cda1f8623568b58215E62",
};

/**
 * Gets the simulation forwarder address for a chain
 * @param chainName The CRE chain name
 * @returns The MockKeystoneForwarder address for simulation
 */
export function getSimulationForwarder(chainName: ChainName): string {
  const forwarder = SIMULATION_FORWARDERS[chainName];
  if (!forwarder) {
    throw new Error(`Unsupported chain for simulation: ${chainName}`);
  }
  return forwarder;
}

/**
 * Gets the production forwarder address for a chain
 * @param chainName The CRE chain name
 * @returns The KeystoneForwarder address for production
 */
export function getProductionForwarder(chainName: ChainName): string {
  const forwarder = PRODUCTION_FORWARDERS[chainName];
  if (!forwarder) {
    throw new Error(`Unsupported chain for production: ${chainName}`);
  }
  return forwarder;
}

/**
 * Gets the forwarder address based on environment
 * @param chainName The CRE chain name
 * @param isSimulation True for simulation addresses, false for production
 * @returns The appropriate forwarder address
 */
export function getForwarder(chainName: ChainName, isSimulation: boolean): string {
  return isSimulation
    ? getSimulationForwarder(chainName)
    : getProductionForwarder(chainName);
}

/**
 * Common forwarder addresses for quick access in tests
 */
export const COMMON_FORWARDERS = {
  sepolia: {
    simulation: "0x15fC6ae953E024d975e77382eEeC56A9101f9F88",
    production: "0xF8344CFd5c43616a4366C34E3EEE75af79a74482",
  },
  baseSepolia: {
    simulation: "0x82300bd7c3958625581cc2f77bc6464dcecdf3e5",
    production: "0xF8344CFd5c43616a4366C34E3EEE75af79a74482",
  },
  ethereumMainnet: {
    simulation: "0xa3d1ad4ac559a6575a114998affb2fb2ec97a7d9",
    production: "0x0b93082D9b3C7C97fAcd250082899BAcf3af3885",
  },
} as const;

