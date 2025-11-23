/**
 * Gas Station Configuration
 * Private key for deploying multisig contracts
 * 
 * IMPORTANT: In production, this should be:
 * - Stored securely (encrypted)
 * - Funded with minimal ETH for deployments only
 * - Rotated regularly
 * - Monitored for usage
 * 
 * To configure: Set GAS_STATION_PRIVATE_KEY in .env file
 * The build process will automatically load it from there.
 */

// Import config generated from .env file during build
import { GAS_STATION_PRIVATE_KEY as GAS_STATION_PRIVATE_KEY_FROM_ENV } from './gas-station-config.js';

let GAS_STATION_PRIVATE_KEY_CACHE: string | null = null;

/**
 * Set gas station private key (can be called at runtime)
 */
export function setGasStationPrivateKey(privateKey: string): void {
    GAS_STATION_PRIVATE_KEY_CACHE = privateKey;
}

/**
 * Get gas station private key
 */
async function getGasStationPrivateKey(): Promise<string> {
    // Check cache first
    if (GAS_STATION_PRIVATE_KEY_CACHE) {
        return GAS_STATION_PRIVATE_KEY_CACHE;
    }
    
    // Get from config file (generated from .env during build)
    if (GAS_STATION_PRIVATE_KEY_FROM_ENV) {
        return GAS_STATION_PRIVATE_KEY_FROM_ENV;
    }
    
    // Try to get from chrome.storage (for runtime configuration override)
    try {
        const storage = await chrome.storage.local.get('gasStationPrivateKey');
        if (storage.gasStationPrivateKey) {
            GAS_STATION_PRIVATE_KEY_CACHE = storage.gasStationPrivateKey;
            return storage.gasStationPrivateKey;
        }
    } catch (error) {
        console.warn('[GasStation] Could not read from chrome.storage:', error);
    }
    
    return '';
}

/**
 * Get gas station signer for a given provider
 */
export async function getGasStationSigner(provider: any): Promise<any> {
    const privateKey = await getGasStationPrivateKey();
    if (!privateKey) {
        throw new Error(
            'Gas station private key not configured. ' +
            'Please set it using setGasStationPrivateKey() or store it in chrome.storage.local with key "gasStationPrivateKey"'
        );
    }

    // Load ethers using the loader to avoid bundling issues
    const { loadEthers } = await import('../popup/ethers-loader.js');
    const ethers = await loadEthers();
    return new ethers.Wallet(privateKey, provider);
}

/**
 * Check if gas station is configured
 */
export async function isGasStationConfigured(): Promise<boolean> {
    const privateKey = await getGasStationPrivateKey();
    return !!privateKey && privateKey.length > 0;
}

