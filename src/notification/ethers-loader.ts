/**
 * Ethers loader for notification script - provides ethers from bundled file
 * This avoids bundling conflicts with firefly.js
 */

let ethersModule: any = null;

export async function loadEthers() {
    if (ethersModule) {
        return ethersModule;
    }

    try {
        // Load from bundled ethers.js file
        const ethersUrl = chrome.runtime.getURL('popup/lib/ethers.js');
        const module = await import(ethersUrl);
        
        // Handle different export formats
        // ethers v6 exports everything individually, and also exports as 'ethers'
        // The module itself contains all the exports, so we can use it directly
        // But we need to check if there's an 'ethers' namespace export
        if (module.ethers) {
            ethersModule = module.ethers;
        } else if (module.default && module.default.ethers) {
            ethersModule = module.default.ethers;
        } else {
            // The module itself contains all exports (JsonRpcProvider, Wallet, etc.)
            // Create a namespace object that matches ethers v6 structure
            ethersModule = module;
        }
        
        return ethersModule;
    } catch (error) {
        console.error('[EthersLoader] Failed to load ethers:', error);
        // Fallback to CDN if bundled version fails
        try {
            const cdnModule = await import('https://cdn.jsdelivr.net/npm/ethers@6/dist/ethers.esm.min.js');
            ethersModule = cdnModule.ethers || cdnModule.default || cdnModule;
            return ethersModule;
        } catch (cdnError) {
            console.error('[EthersLoader] Failed to load ethers from CDN:', cdnError);
            throw new Error('Failed to load ethers library');
        }
    }
}

