import { NexusSDK, EthereumProvider } from '@avail-project/nexus-core';
import type { UserAsset } from '@avail-project/nexus-core';
import { fetchPortfolioFromOctav } from './transactions-service';

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

        // For watch-only addresses, use Octav portfolio API
        if (account?.isWatchOnly) {
            return await this.getWatchOnlyBalances(account);
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

            // Filter breakdown entries to only include chains with actual balance > 0
            // This ensures we only show chain icons for chains where user has liquidity
            const filteredAssets = assets.map(asset => {
                if (asset.breakdown && Array.isArray(asset.breakdown)) {
                    // Filter breakdown to only include chains with balance > 0
                    const filteredBreakdown = asset.breakdown.filter(b => {
                        if (!b || !b.chain) return false;
                        // Check if balance is greater than 0
                        const balance = parseFloat(b.balance || '0');
                        const balanceInFiat = parseFloat(String(b.balanceInFiat || '0'));
                        // Include if either balance or USD value is > 0
                        return balance > 0 || balanceInFiat > 0;
                    });
                    
                    return {
                        ...asset,
                        breakdown: filteredBreakdown,
                    };
                }
                return asset;
            });

            // Calculate total USD value
            // Note: UserAsset from SDK has balanceInFiat as a property directly
            const totalBalanceUSD = filteredAssets.reduce((sum, asset) => {
                return sum + (asset.balanceInFiat || 0);
            }, 0);

            const data: UnifiedBalanceData = {
                totalBalanceUSD,
                assets: filteredAssets,
                loading: false,
            };

            // Log chain information for debugging
            const chainIds = new Set<number>();
            filteredAssets.forEach(asset => {
                if (asset.breakdown && Array.isArray(asset.breakdown)) {
                    asset.breakdown.forEach(b => {
                        if (b.chain?.id) {
                            chainIds.add(b.chain.id);
                        }
                    });
                }
            });

            console.log('[UnifiedBalanceService] Calculated total USD:', totalBalanceUSD);
            console.log('[UnifiedBalanceService] Chains with liquidity:', Array.from(chainIds));

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
     * Fetch portfolio data from Octav API for watch-only addresses
     * This provides unified balance across all chains and protocols
     */
    private async getWatchOnlyBalances(account: any): Promise<UnifiedBalanceData> {
        try {
            console.log('[UnifiedBalanceService] Fetching watch-only balance from Octav for:', account.address);

            const portfolio = await fetchPortfolioFromOctav({
                addresses: account.address,
                includeImages: true,
            });

            console.log('[UnifiedBalanceService] Octav portfolio response:', portfolio);

            // Handle case where response might be an array (multiple addresses)
            const portfolioData = Array.isArray(portfolio) ? portfolio[0] : portfolio;
            
            console.log('[UnifiedBalanceService] Portfolio chains:', portfolioData?.chains);
            console.log('[UnifiedBalanceService] Portfolio assetByProtocols:', portfolioData?.assetByProtocols);
            
            if (!portfolioData) {
                throw new Error('No portfolio data received from Octav API');
            }

            // Check if assetByProtocols exists
            if (!portfolioData.assetByProtocols || typeof portfolioData.assetByProtocols !== 'object') {
                console.warn('[UnifiedBalanceService] No assetByProtocols in response, using empty portfolio');
                return {
                    totalBalanceUSD: parseFloat(portfolioData.networth || '0'),
                    assets: [],
                    loading: false,
                };
            }

            // Map chain keys to chain IDs
            const chainKeyToId: Record<string, number> = {
                ethereum: 1,
                arbitrum: 42161,
                optimism: 10,
                base: 8453,
                polygon: 137,
                bsc: 56,
                avalanche: 43114,
                fantom: 250,
                zksync: 324,
                linea: 59144,
                scroll: 534352,
                zircuit: 48900,
            };

            // Aggregate assets by symbol across all protocols and chains
            const assetMap = new Map<string, {
                symbol: string;
                totalBalance: number;
                totalValue: number;
                breakdown: any[];
                name: string;
                decimals: number;
                icon?: string;
            }>();

            // Track all chains that have assets (from chains object)
            const chainsWithAssets = new Set<string>();
            if (portfolioData.chains && typeof portfolioData.chains === 'object') {
                Object.keys(portfolioData.chains).forEach(chainKey => {
                    const chainData = portfolioData.chains[chainKey];
                    if (chainData && parseFloat(chainData.value || '0') > 0) {
                        chainsWithAssets.add(chainKey);
                    }
                });
            }

            // Process all assets from all protocols
            Object.values(portfolioData.assetByProtocols).forEach((protocol: any) => {
                if (!protocol || !protocol.assets || !Array.isArray(protocol.assets)) {
                    return;
                }
                protocol.assets.forEach((asset: any) => {
                    const symbol = asset.symbol;
                    const balance = parseFloat(asset.balance || '0');
                    const value = parseFloat(asset.value || '0');
                    const chainKey = asset.chain || 'ethereum';
                    const chainId = chainKeyToId[chainKey] || (chainKeyToId[chainKey.toLowerCase()] || 1);
                    const chainName = portfolioData.chains?.[chainKey]?.name || portfolioData.chains?.[chainKey.toLowerCase()]?.name || chainKey;
                    
                    // Log asset details for debugging
                    if (!asset.chain) {
                        console.warn(`[UnifiedBalanceService] Asset ${symbol} missing chain field:`, asset);
                    }
                    
                    // Log if chain mapping is missing
                    if (!chainKeyToId[chainKey] && !chainKeyToId[chainKey.toLowerCase()]) {
                        console.warn(`[UnifiedBalanceService] Unknown chain key: ${chainKey}, defaulting to Ethereum (chainId: 1)`);
                    }

                    // Track this chain as having assets
                    chainsWithAssets.add(chainKey);

                    if (!assetMap.has(symbol)) {
                        assetMap.set(symbol, {
                            symbol,
                            totalBalance: 0,
                            totalValue: 0,
                            breakdown: [],
                            name: symbol,
                            decimals: 18, // Default, could be improved with token metadata
                            icon: undefined,
                        });
                    }

                    const assetData = assetMap.get(symbol)!;
                    assetData.totalBalance += balance;
                    assetData.totalValue += value;

                    // Add breakdown entry for this chain
                    // Ensure chainId is a number
                    const numericChainId = typeof chainId === 'number' ? chainId : parseInt(String(chainId), 10) || 1;
                    
                    assetData.breakdown.push({
                        chain: {
                            id: numericChainId,
                            name: chainName,
                            logo: `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chainKey}/info/logo.png`,
                        },
                        balance: asset.balance,
                        balanceInFiat: parseFloat(asset.value || '0'),
                        contractAddress: asset.contractAddress || (symbol === 'ETH' || symbol === 'MATIC' || symbol === 'BNB' ? '0x0000000000000000000000000000000000000000' : undefined) as `0x${string}`,
                        decimals: 18,
                        isNative: !asset.contractAddress || asset.contractAddress === '0x0000000000000000000000000000000000000000',
                        universe: 'mainnet' as any,
                    });
                });
            });

            // Convert to UserAsset format
            const assets: UserAsset[] = Array.from(assetMap.values()).map(assetData => {
                // Ensure breakdown is properly structured and has chain IDs
                const breakdown = assetData.breakdown.map(b => ({
                    ...b,
                    chain: {
                        ...b.chain,
                        id: b.chain?.id || 1, // Ensure chain ID is always set
                    }
                }));

                return {
                    symbol: assetData.symbol,
                    balance: assetData.totalBalance.toString(),
                    balanceInFiat: assetData.totalValue,
                    icon: assetData.icon || `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${assetData.symbol === 'ETH' ? '0x0000000000000000000000000000000000000000' : 'unknown'}/logo.png`,
                    chain: 'eth', // Default chain
                    name: assetData.name,
                    decimals: assetData.decimals,
                    address: account.address,
                    breakdown: breakdown, // Ensure breakdown is properly structured
                } as UserAsset;
            });

            const totalBalanceUSD = parseFloat(portfolioData.networth || '0');

            // Ensure all chains from the portfolio are represented in at least one asset's breakdown
            // This ensures the UI can extract and display chain icons
            const allPortfolioChains: Array<{chainId: number, chainName: string, chainKey: string}> = [];
            let placeholderAssetCreated = false;
            
            if (portfolioData.chains && typeof portfolioData.chains === 'object') {
                Object.keys(portfolioData.chains).forEach(chainKey => {
                    const chainData = portfolioData.chains[chainKey];
                    if (chainData && parseFloat(chainData.value || '0') > 0) {
                        const chainId = chainKeyToId[chainKey] || (chainKeyToId[chainKey.toLowerCase()] || 1);
                        const chainName = chainData.name || chainKey;
                        allPortfolioChains.push({ chainId, chainName, chainKey });
                        
                        // Check if this chain is already in any asset's breakdown
                        let chainInBreakdown = false;
                        for (const asset of assets) {
                            if (asset.breakdown && asset.breakdown.some(b => b.chain?.id === chainId)) {
                                chainInBreakdown = true;
                                break;
                            }
                        }
                        
                        // If chain is not in any breakdown, add it to the first asset (or create a placeholder)
                        // This ensures the chain icon will show in the UI
                        if (!chainInBreakdown) {
                            if (assets.length > 0) {
                                const firstAsset = assets[0];
                                if (!firstAsset.breakdown) {
                                    firstAsset.breakdown = [];
                                }
                                // Add a minimal breakdown entry for this chain
                                firstAsset.breakdown.push({
                                    chain: {
                                        id: chainId,
                                        name: chainName,
                                        logo: `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chainKey}/info/logo.png`,
                                    },
                                    balance: '0',
                                    balanceInFiat: 0,
                                    contractAddress: undefined,
                                    decimals: 18,
                                    isNative: false,
                                    universe: 'mainnet' as any,
                                });
                            } else if (!placeholderAssetCreated) {
                                // If no assets exist, create a placeholder asset with all chains (only once)
                                placeholderAssetCreated = true;
                                const placeholderBreakdown = allPortfolioChains.map(({ chainId, chainName, chainKey }) => ({
                                    chain: {
                                        id: chainId,
                                        name: chainName,
                                        logo: `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chainKey}/info/logo.png`,
                                    },
                                    balance: '0',
                                    balanceInFiat: 0,
                                    contractAddress: undefined,
                                    decimals: 18,
                                    isNative: false,
                                    universe: 'mainnet' as any,
                                }));
                                
                                assets.push({
                                    symbol: 'TOTAL',
                                    balance: '0',
                                    balanceInFiat: totalBalanceUSD,
                                    icon: '',
                                    chain: 'eth',
                                    name: 'Total Portfolio',
                                    decimals: 18,
                                    address: account.address,
                                    breakdown: placeholderBreakdown,
                                } as UserAsset);
                            }
                        }
                    }
                });
            }

            const data: UnifiedBalanceData = {
                totalBalanceUSD,
                assets,
                loading: false,
            };

            // Get all unique chain IDs from breakdowns for verification
            const allChainIds = new Set<number>();
            const breakdownDetails: any[] = [];
            assets.forEach(asset => {
                if (asset.breakdown && Array.isArray(asset.breakdown)) {
                    asset.breakdown.forEach(b => {
                        if (b.chain?.id) {
                            allChainIds.add(b.chain.id);
                            breakdownDetails.push({
                                symbol: asset.symbol,
                                chainId: b.chain.id,
                                chainName: b.chain.name,
                                balance: b.balance,
                            });
                        }
                    });
                }
            });

            console.log('[UnifiedBalanceService] Watch-only balance fetched from Octav:', {
                totalUSD: totalBalanceUSD,
                assetCount: assets.length,
                chainsWithAssets: Array.from(chainsWithAssets),
                chainIds: Array.from(allChainIds),
                chainKeys: portfolioData.chains ? Object.keys(portfolioData.chains) : [],
                chainValues: portfolioData.chains ? Object.entries(portfolioData.chains).map(([key, val]: [string, any]) => ({
                    key,
                    name: val.name,
                    value: val.value,
                })) : [],
                protocols: portfolioData.assetByProtocols ? Object.keys(portfolioData.assetByProtocols) : [],
                breakdownDetails: breakdownDetails.slice(0, 10), // Log first 10 breakdown entries
                assetsWithBreakdown: assets.filter(a => a.breakdown && a.breakdown.length > 0).length,
            });

            return data;
        } catch (error: any) {
            console.error('[UnifiedBalanceService] Error fetching watch-only balance from Octav:', error);
            return {
                totalBalanceUSD: 0,
                assets: [],
                loading: false,
                error: error.message || 'Failed to fetch watch-only balance from Octav',
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
            const rpcUrl = 'https://mainnet.infura.io/v3/b17509e0e2ce45f48a44289ff1aa3c73';

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

