import type { OctavPortfolio, OctavPortfolioAsset } from '../services/transactions-service';
import { getChainColoredLogo, getChainWhiteLogo } from '../utils/chain-icons';
import { CHAIN_METADATA } from '@avail-project/nexus-core';

// Helper function to get token icon URL
function getTokenIcon(asset: OctavPortfolioAsset, chainKey?: string): string {
    // First try the image from OCTAV API (if includeImages=true)
    if (asset.image) {
        return asset.image;
    }
    
    // Fallback to TrustWallet assets
    const chain = chainKey || asset.chain || 'ethereum';
    const contractAddress = asset.contractAddress;
    
    // For native tokens (ETH, MATIC, etc.)
    if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
        const nativeTokenMap: Record<string, string> = {
            'ETH': 'https://cryptologos.cc/logos/ethereum-eth-logo.png?v=040',
            'MATIC': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
            'BNB': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png',
            'AVAX': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png',
            'FTM': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/fantom/info/logo.png',
            'OP': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png',
            'ARB': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png',
            'BASE': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png',
        };
        
        if (nativeTokenMap[asset.symbol]) {
            return nativeTokenMap[asset.symbol];
        }
        
        // Generic chain logo
        return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chain}/info/logo.png`;
    }
    
    // For ERC20 tokens, use TrustWallet assets
    // Format: https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chain}/assets/{contractAddress}/logo.png
    const chainMap: Record<string, string> = {
        'ethereum': 'ethereum',
        'arbitrum': 'arbitrum',
        'optimism': 'optimism',
        'polygon': 'polygon',
        'base': 'base',
        'bsc': 'smartchain',
        'avalanche': 'avalanchec',
        'fantom': 'fantom',
    };
    
    const trustwalletChain = chainMap[chain.toLowerCase()] || 'ethereum';
    const address = contractAddress.toLowerCase();
    
    return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${trustwalletChain}/assets/${address}/logo.png`;
}

export interface DeFiPositionsProps {
    portfolio: OctavPortfolio | null;
    loading: boolean;
    selectedChainId?: number | null;
    onChainClick?: (chainId: number | null) => void;
}

// Map chain keys from OCTAV to chain IDs
const CHAIN_KEY_TO_ID: Record<string, number> = {
    ethereum: 1,
    arbitrum: 42161,
    optimism: 10,
    polygon: 137,
    base: 8453,
    bsc: 56,
    avalanche: 43114,
    fantom: 250,
    zksync: 324,
    linea: 59144,
    blast: 81457,
    mode: 34443,
    zircuit: 48900,
    scroll: 534352,
    mantle: 5000,
    celo: 42220,
    gnosis: 100,
    metis: 1088,
    boba: 288,
    aurora: 1313161554,
    harmony: 1666600000,
    moonbeam: 1284,
    moonriver: 1285,
    cronos: 25,
    okc: 66,
    heco: 128,
    klaytn: 8217,
    // Add more as needed
};

function getChainIdFromKey(chainKey: string): number | null {
    return CHAIN_KEY_TO_ID[chainKey.toLowerCase()] || null;
}

function getChainName(chainId: number): string {
    return CHAIN_METADATA[chainId]?.name || `Chain ${chainId}`;
}

function getChainLogo(chainId: number, useWhite: boolean = false): string {
    if (useWhite) {
        return getChainWhiteLogo(chainId) || getChainColoredLogo(chainId) || '';
    }
    return getChainColoredLogo(chainId) || getChainWhiteLogo(chainId) || '';
}

const formatUSD = (value: string | number): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (num < 0.01) return '<$0.01';
    return `$${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

const formatBalance = (balance: string, decimals: number = 6): string => {
    const num = parseFloat(balance);
    if (num === 0) return '0';
    if (num < 0.000001) return '<0.000001';
    return num.toFixed(decimals).replace(/\.?0+$/, '');
};

export function renderDeFiPositions(props: DeFiPositionsProps): string {
    const { portfolio, loading, selectedChainId, onChainClick } = props;

    if (loading) {
        return `
            <div class="defi-positions">
                <div class="defi-positions-header">
                    <h3 class="defi-positions-title">DeFi Positions</h3>
                </div>
                <div class="defi-positions-loading">
                    ${Array.from({ length: 3 }).map(() => `
                        <div class="defi-position-skeleton">
                            <div style="width: 40px; height: 40px; background: var(--r-neutral-line); border-radius: 8px; margin-right: 12px;"></div>
                            <div style="flex: 1;">
                                <div style="width: 120px; height: 16px; background: var(--r-neutral-line); border-radius: 4px; margin-bottom: 8px;"></div>
                                <div style="width: 80px; height: 14px; background: var(--r-neutral-line); border-radius: 4px;"></div>
                            </div>
                            <div style="text-align: right;">
                                <div style="width: 80px; height: 16px; background: var(--r-neutral-line); border-radius: 4px; margin-bottom: 8px;"></div>
                                <div style="width: 60px; height: 14px; background: var(--r-neutral-line); border-radius: 4px;"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    if (!portfolio || !portfolio.assetByProtocols || Object.keys(portfolio.assetByProtocols).length === 0) {
        return `
            <div class="defi-positions">
                <div class="defi-positions-header">
                    <h3 class="defi-positions-title">DeFi Positions</h3>
                </div>
                <div class="defi-positions-empty">
                    <div class="empty-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M2 17L12 22L22 17" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M2 12L12 17L22 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <div class="empty-title">No DeFi positions</div>
                    <div class="empty-desc">Your DeFi positions will appear here</div>
                </div>
            </div>
        `;
    }

    // Get all protocols
    const protocols = Object.values(portfolio.assetByProtocols);
    
    // Debug logging
    console.log('[DeFiPositions] Rendering with protocols:', protocols.map((p: any) => ({
        name: p.name,
        value: p.value,
        assetCount: p.assets?.length || 0,
        assets: p.assets?.map((a: any) => ({ symbol: a.symbol, value: a.value, chain: a.chain })) || [],
    })));
    
    // Filter by chain if selected
    let filteredProtocols = protocols;
    if (selectedChainId !== null && selectedChainId !== undefined) {
        // Find chain key from chain ID
        const chainKey = Object.keys(CHAIN_KEY_TO_ID).find(
            key => CHAIN_KEY_TO_ID[key] === selectedChainId
        );
        
        if (chainKey) {
            // Filter protocols that have assets on this chain
            filteredProtocols = protocols.filter(protocol => {
                const assets = protocol.assets || [];
                return assets.some(asset => 
                    asset.chain?.toLowerCase() === chainKey.toLowerCase()
                );
            });
        }
    }

    // Group assets by chain for the selected chain view
    if (selectedChainId !== null && selectedChainId !== undefined) {
        const chainKey = Object.keys(CHAIN_KEY_TO_ID).find(
            key => CHAIN_KEY_TO_ID[key] === selectedChainId
        );
        
        if (chainKey) {
            // Show assets grouped by protocol for this chain
            const chainAssets: Record<string, { protocol: OctavPortfolio['assetByProtocols'][string]; assets: typeof portfolio.assetByProtocols[string]['assets'] }> = {};
            
            filteredProtocols.forEach(protocol => {
                const protocolAssets = protocol.assets || [];
                const chainAssetsList = protocolAssets.filter(asset => 
                    asset.chain?.toLowerCase() === chainKey.toLowerCase()
                );
                
                if (chainAssetsList.length > 0) {
                    if (!chainAssets[protocol.key]) {
                        chainAssets[protocol.key] = {
                            protocol,
                            assets: []
                        };
                    }
                    chainAssets[protocol.key].assets.push(...chainAssetsList);
                }
            });

            const totalValue = Object.values(chainAssets).reduce((sum, group) => {
                return sum + group.assets.reduce((assetSum, asset) => {
                    return assetSum + parseFloat(asset.value || '0');
                }, 0);
            }, 0);

            return `
                <div class="defi-positions">
                    <div class="defi-positions-header">
                        <button class="defi-positions-back-btn" id="defi-positions-back-btn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M15 18L9 12L15 6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <div>
                            <h3 class="defi-positions-title">${getChainName(selectedChainId)}</h3>
                            <div class="defi-positions-subtitle">${formatUSD(totalValue)}</div>
                        </div>
                    </div>
                    <div class="defi-positions-list">
                        ${Object.values(chainAssets).map(group => {
                            const protocolValue = group.assets.reduce((sum, asset) => {
                                return sum + parseFloat(asset.value || '0');
                            }, 0);
                            
                            return `
                                <div class="defi-protocol-group">
                                    <div class="defi-protocol-header">
                                        <div class="defi-protocol-name">${group.protocol.name}</div>
                                        <div class="defi-protocol-value">${formatUSD(protocolValue)}</div>
                                    </div>
                                    <div class="defi-assets-list">
                                        ${(group.assets || []).map(asset => {
                                            const tokenIcon = getTokenIcon(asset);
                                            const assetSymbol = asset.symbol || 'N/A';
                                            const assetName = asset.name || assetSymbol;
                                            return `
                                                <div class="defi-asset-item">
                                                    <div class="defi-asset-info">
                                                        ${tokenIcon ? `
                                                            <img src="${tokenIcon}" 
                                                                 alt="${assetSymbol}" 
                                                                 class="defi-asset-icon"
                                                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                                            <div class="defi-asset-icon-fallback" style="display: none;">${assetSymbol.charAt(0).toUpperCase()}</div>
                                                        ` : `
                                                            <div class="defi-asset-icon-fallback">${assetSymbol.charAt(0).toUpperCase()}</div>
                                                        `}
                                                        <div>
                                                            <div class="defi-asset-symbol" title="${assetName}">${assetSymbol}</div>
                                                            <div class="defi-asset-balance">${formatBalance(asset.balance || '0')}</div>
                                                        </div>
                                                    </div>
                                                    <div class="defi-asset-value">${formatUSD(asset.value || '0')}</div>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }
    }

    // Show protocols overview
    const sortedProtocols = filteredProtocols.sort((a, b) => {
        const valueA = parseFloat(a.value || '0');
        const valueB = parseFloat(b.value || '0');
        return valueB - valueA;
    });

    return `
        <div class="defi-positions">
            <div class="defi-positions-header">
                <h3 class="defi-positions-title">DeFi Positions</h3>
                ${selectedChainId !== null && selectedChainId !== undefined ? `
                    <button class="defi-positions-filter-clear" id="defi-positions-filter-clear">
                        Clear filter
                    </button>
                ` : ''}
            </div>
            <div class="defi-positions-list">
                ${sortedProtocols.length > 0 ? sortedProtocols.map(protocol => {
                    const protocolValue = parseFloat(protocol.value || '0');
                    const assets = protocol.assets || [];
                    // Never show "0 assets" - if no assets but has value, show "1 asset" as minimum
                    const assetCount = assets.length > 0 ? assets.length : (protocolValue > 0 ? 1 : 0);
                    
                    // Get unique chains for this protocol
                    const chainKeys = new Set(assets.map(a => a.chain).filter(Boolean));
                    const chainIds = Array.from(chainKeys)
                        .map(key => key ? getChainIdFromKey(key) : null)
                        .filter((id): id is number => id !== null);

                    return `
                        <div class="defi-protocol-item">
                            <div class="defi-protocol-main">
                                <div class="defi-protocol-info">
                                    <div class="defi-protocol-name">${protocol.name}</div>
                                    ${assetCount > 0 ? `<div class="defi-protocol-meta">${assetCount} asset${assetCount !== 1 ? 's' : ''}</div>` : ''}
                                </div>
                                <div class="defi-protocol-value">${formatUSD(protocolValue)}</div>
                            </div>
                            ${chainIds.length > 0 ? `
                                <div class="defi-protocol-chains">
                                    ${chainIds.map(chainId => {
                                        const logo = getChainLogo(chainId, false);
                                        const isSelected = selectedChainId === chainId;
                                        return `
                                            <div class="defi-chain-icon ${isSelected ? 'selected' : ''}" 
                                                 data-chain-id="${chainId}"
                                                 title="${getChainName(chainId)}"
                                                 ${onChainClick ? 'style="cursor: pointer;"' : ''}>
                                        ${logo ? `
                                            <img src="${logo}" alt="${getChainName(chainId)}" 
                                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                            <div class="chain-icon-fallback" style="display: none; width: 24px; height: 24px; border-radius: 50%; background: var(--r-neutral-line); display: flex; align-items: center; justify-content: center; font-size: 10px; color: var(--r-neutral-foot);">${getChainName(chainId).charAt(0)}</div>
                                        ` : `
                                            <div class="chain-icon-fallback" style="width: 24px; height: 24px; border-radius: 50%; background: var(--r-neutral-line); display: flex; align-items: center; justify-content: center; font-size: 10px; color: var(--r-neutral-foot);">${getChainName(chainId).charAt(0)}</div>
                                        `}
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            ` : ''}
                            ${assets.length > 0 ? `
                                <div class="defi-protocol-assets">
                                    ${assets.map(asset => {
                                        const tokenIcon = getTokenIcon(asset);
                                        const assetSymbol = asset.symbol || 'N/A';
                                        const assetName = asset.name || assetSymbol;
                                        const assetValue = parseFloat(asset.value || '0');
                                        return `
                                            <div class="defi-asset-preview" title="${assetName} - ${formatUSD(assetValue)}">
                                                ${tokenIcon ? `
                                                    <img src="${tokenIcon}" 
                                                         alt="${assetSymbol}" 
                                                         class="defi-asset-icon"
                                                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                                    <div class="defi-asset-icon-fallback" style="display: none;">${assetSymbol.charAt(0).toUpperCase()}</div>
                                                ` : `
                                                    <div class="defi-asset-icon-fallback">${assetSymbol.charAt(0).toUpperCase()}</div>
                                                `}
                                                <div class="defi-asset-preview-info">
                                                    <span class="defi-asset-symbol-small" title="${assetName}">${assetSymbol}</span>
                                                    <span class="defi-asset-value-small">${formatUSD(assetValue)}</span>
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('') : `
                    <div class="defi-positions-empty">
                        <div class="empty-title">No positions found</div>
                        <div class="empty-desc">${selectedChainId !== null && selectedChainId !== undefined ? 'No DeFi positions on this chain' : 'Your DeFi positions will appear here'}</div>
                    </div>
                `}
            </div>
        </div>
    `;
}

