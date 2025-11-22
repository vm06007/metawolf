/**
 * RPC Service - Manages RPC endpoints with fallbacks and custom RPC support
 */

export interface RPCConfig {
    url: string;
    enable: boolean;
}

export interface RPCStore {
    customRPC: Record<string, RPCConfig>;
}

// Default RPC endpoints with fallbacks
const DEFAULT_RPC_ENDPOINTS: Record<number, string[]> = {
    1: [
        'https://mainnet.infura.io/v3/db2e296c0a0f475fb6c3a3281a0c39d6', // Infura (primary)
        'https://eth.llamarpc.com', // LlamaRPC (fallback)
        'https://rpc.ankr.com/eth', // Ankr (fallback)
        'https://ethereum.publicnode.com', // Public Node (fallback)
    ],
    11155111: [ // Sepolia
        'https://sepolia.infura.io/v3/db2e296c0a0f475fb6c3a3281a0c39d6',
        'https://rpc.sepolia.org',
    ],
};

class RPCService {
    private store: RPCStore = {
        customRPC: {},
    };

    async init() {
        try {
            const stored = await chrome.storage.local.get('rpc_config');
            if (stored.rpc_config) {
                this.store = stored.rpc_config;
            }
        } catch (error) {
            console.error('[RPCService] Error loading RPC config:', error);
        }
    }

    /**
     * Get RPC URL for a chain, checking custom RPC first, then defaults
     */
    getRPCUrl(chainId: number): string {
        const chainKey = chainId.toString();
        
        // Check if custom RPC is set and enabled
        const customRPC = this.store.customRPC[chainKey];
        if (customRPC && customRPC.enable) {
            return customRPC.url;
        }

        // Use default RPC (first in the list)
        const defaultRPCs = DEFAULT_RPC_ENDPOINTS[chainId];
        if (defaultRPCs && defaultRPCs.length > 0) {
            return defaultRPCs[0];
        }

        // Fallback to Infura mainnet
        return 'https://mainnet.infura.io/v3/db2e296c0a0f475fb6c3a3281a0c39d6';
    }

    /**
     * Get all RPC URLs for a chain (for fallback)
     */
    getRPCUrls(chainId: number): string[] {
        const chainKey = chainId.toString();
        
        // Check if custom RPC is set and enabled
        const customRPC = this.store.customRPC[chainKey];
        if (customRPC && customRPC.enable) {
            return [customRPC.url];
        }

        // Return default RPCs with fallbacks
        return DEFAULT_RPC_ENDPOINTS[chainId] || [
            'https://mainnet.infura.io/v3/db2e296c0a0f475fb6c3a3281a0c39d6',
        ];
    }

    /**
     * Set custom RPC for a chain
     */
    async setCustomRPC(chainId: number, url: string, enable: boolean = true) {
        const chainKey = chainId.toString();
        this.store.customRPC[chainKey] = {
            url,
            enable,
        };
        await chrome.storage.local.set({ rpc_config: this.store });
    }

    /**
     * Remove custom RPC for a chain
     */
    async removeCustomRPC(chainId: number) {
        const chainKey = chainId.toString();
        delete this.store.customRPC[chainKey];
        await chrome.storage.local.set({ rpc_config: this.store });
    }

    /**
     * Get custom RPC for a chain
     */
    getCustomRPC(chainId: number): RPCConfig | undefined {
        const chainKey = chainId.toString();
        return this.store.customRPC[chainKey];
    }

    /**
     * Get all custom RPCs
     */
    getAllCustomRPCs(): Record<string, RPCConfig> {
        return this.store.customRPC;
    }

    /**
     * Try RPC request with fallbacks
     */
    async requestWithFallback<T>(
        chainId: number,
        requestFn: (rpcUrl: string) => Promise<T>
    ): Promise<T> {
        const rpcUrls = this.getRPCUrls(chainId);
        let lastError: Error | null = null;

        for (const rpcUrl of rpcUrls) {
            try {
                const result = await requestFn(rpcUrl);
                return result;
            } catch (error: any) {
                lastError = error;
                console.warn(`[RPCService] RPC failed: ${rpcUrl}`, error.message);
                // Continue to next RPC
            }
        }

        // All RPCs failed
        throw lastError || new Error('All RPC endpoints failed');
    }
}

// Singleton instance
export const rpcService = new RPCService();

