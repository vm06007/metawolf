import { NexusSDK, EthereumProvider } from '@avail-project/nexus-core';
import type { UserAsset } from '@avail-project/nexus-core';

export interface UnifiedBalanceData {
    totalBalanceUSD: number;
    assets: UserAsset[];
    loading: boolean;
    error?: string;
}

export class UnifiedBalanceService {
    private sdk: NexusSDK | null = null;
    private cache: UnifiedBalanceData | null = null;
    private cacheTime: number = 0;
    private readonly CACHE_DURATION = 30000; // 30 seconds

    async initialize(provider: EthereumProvider, network: 'mainnet' | 'testnet' = 'mainnet'): Promise<void> {
        try {
            // The SDK will read domain from window.location, but it should work with proper signing
            const sdkConfig: any = {
                network: network,
                debug: false, // Disable debug to reduce console spam (matching de-hack)
            };

            this.sdk = new NexusSDK(sdkConfig);

            // Initialize with the EIP-1193 provider
            // The provider now supports signing methods needed for SIWE
            await this.sdk.initialize(provider);
            console.log('[UnifiedBalanceService] SDK initialized successfully');
        } catch (error: any) {
            console.error('[UnifiedBalanceService] Error initializing SDK:', error);
            throw error;
        }
    }

    async getUnifiedBalances(): Promise<UnifiedBalanceData> {
        if (!this.sdk) {
            return {
                totalBalanceUSD: 0,
                assets: [],
                loading: false,
                error: 'SDK not initialized',
            };
        }

        // Check cache first
        const now = Date.now();
        if (this.cache && (now - this.cacheTime) < this.CACHE_DURATION) {
            return this.cache;
        }

        try {
            console.log('[UnifiedBalanceService] Fetching unified balances from SDK...');
            const assets = await this.sdk.getUnifiedBalances();
            console.log('[UnifiedBalanceService] Received assets:', {
                count: assets?.length || 0,
                assets: assets?.map(a => ({ symbol: a.symbol, balance: a.balance, balanceInFiat: a.balanceInFiat })) || []
            });

            // Handle empty or null response
            if (!assets || !Array.isArray(assets)) {
                console.warn('[UnifiedBalanceService] Invalid assets response:', assets);
                return {
                    totalBalanceUSD: 0,
                    assets: [],
                    loading: false,
                    error: 'No balance data received from SDK',
                };
            }

            // Calculate total USD value
            // Note: UserAsset from SDK has balanceInFiat as a property directly
            const totalBalanceUSD = assets.reduce((sum, asset) => {
                return sum + (asset.balanceInFiat || 0);
            }, 0);

            const data: UnifiedBalanceData = {
                totalBalanceUSD,
                assets,
                loading: false,
            };

            console.log('[UnifiedBalanceService] Calculated total USD:', totalBalanceUSD);

            // Update cache
            this.cache = data;
            this.cacheTime = now;

            return data;
        } catch (error: any) {
            console.error('[UnifiedBalanceService] Error fetching unified balances:', error);
            console.error('[UnifiedBalanceService] Error stack:', error.stack);
            return {
                totalBalanceUSD: 0,
                assets: [],
                loading: false,
                error: error.message || 'Failed to fetch unified balances',
            };
        }
    }

    async getUnifiedBalance(symbol: string): Promise<UserAsset | undefined> {
        if (!this.sdk) {
            return undefined;
        }

        try {
            return await this.sdk.getUnifiedBalance(symbol);
        } catch (error) {
            console.error(`[UnifiedBalanceService] Error fetching balance for ${symbol}:`, error);
            return undefined;
        }
    }

    clearCache(): void {
        this.cache = null;
        this.cacheTime = 0;
    }

    deinit(): void {
        if (this.sdk) {
            // Clean up SDK
            this.sdk.deinit();
            this.sdk = null;
        }
        this.clearCache();
    }
}

export const unifiedBalanceService = new UnifiedBalanceService();

