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

    async getUnifiedBalances(account?: any): Promise<UnifiedBalanceData> {
        // Check if this is a Halo chip account - fetch directly from node
        if (account?.isChipAccount && account?.chipInfo) {
            return await this.getHaloChipBalances(account);
        }

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

    /**
     * Fetch ETH balance directly from node for Halo chip accounts
     * (since we don't have access to private key, can't use Anvil)
     */
    private async getHaloChipBalances(account: any): Promise<UnifiedBalanceData> {
        try {
            console.log('[UnifiedBalanceService] Fetching Halo chip balance from node for:', account.address);

            // RPC endpoint for Ethereum mainnet
            const rpcUrl = 'https://mainnet.infura.io/v3/db2e296c0a0f475fb6c3a3281a0c39d6';

            // Fetch ETH balance directly from node using RPC call
            const balanceResponse = await fetch(rpcUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_getBalance',
                    params: [account.address, 'latest'],
                    id: 1,
                }),
            });

            const balanceData = await balanceResponse.json();
            if (balanceData.error) {
                throw new Error(balanceData.error.message || 'Failed to fetch balance');
            }

            // Convert hex balance to ETH
            const balanceWeiHex = balanceData.result;
            const balanceWei = BigInt(balanceWeiHex);
            const balanceEth = (Number(balanceWei) / 1e18).toString();
            const balanceNumber = parseFloat(balanceEth);

            // Fetch ETH price from CoinGecko
            let ethPrice = 0;
            try {
                const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
                const priceData = await priceResponse.json();
                if (priceData.ethereum && priceData.ethereum.usd) {
                    ethPrice = priceData.ethereum.usd;
                }
            } catch (error) {
                console.warn('[UnifiedBalanceService] Failed to fetch ETH price, using 0:', error);
            }

            // Calculate USD value
            const balanceInFiat = balanceNumber * ethPrice;

            // Create ETH asset with breakdown structure
            const ethAsset: UserAsset = {
                symbol: 'ETH',
                balance: balanceEth,
                balanceInFiat: balanceInFiat,
                icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
                chain: 'eth',
                name: 'Ethereum',
                decimals: 18,
                address: account.address,
                breakdown: [
                    {
                        chain: {
                            id: 1,
                            name: 'Ethereum',
                            logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
                        },
                        balance: balanceEth,
                        balanceInFiat: balanceInFiat,
                        contractAddress: '0x0000000000000000000000000000000000000000' as `0x${string}`,
                        decimals: 18,
                        isNative: true,
                        universe: 'mainnet' as any,
                    }
                ],
            } as UserAsset;

            const data: UnifiedBalanceData = {
                totalBalanceUSD: balanceInFiat,
                assets: [ethAsset],
                loading: false,
            };

            console.log('[UnifiedBalanceService] Halo chip balance fetched:', {
                eth: balanceEth,
                usd: balanceInFiat,
            });

            return data;
        } catch (error: any) {
            console.error('[UnifiedBalanceService] Error fetching Halo chip balance:', error);
            return {
                totalBalanceUSD: 0,
                assets: [],
                loading: false,
                error: error.message || 'Failed to fetch Halo chip balance',
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

