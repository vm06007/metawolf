import { CHAIN_METADATA } from '@avail-project/nexus-core';
import type { UserAsset } from '@avail-project/nexus-core';
import type { UnifiedBalanceData } from '../services/unified-balance-service';
import { getChainWhiteLogo } from '../utils/chain-icons';

export interface UnifiedBalancePanelProps {
    data: UnifiedBalanceData | null;
    loading: boolean;
}

const getChainLogo = (chainId: number): string => {
    // Use white logo from clone folder for better visibility on blue background
    const whiteLogo = getChainWhiteLogo(chainId);
    if (whiteLogo) return whiteLogo;
    // Fallback to regular logo from SDK
    return CHAIN_METADATA[chainId]?.logo || '';
};

const getChainName = (chainId: number): string => {
    return CHAIN_METADATA[chainId]?.name || `Chain ${chainId}`;
};

export function renderUnifiedBalancePanel(props: UnifiedBalancePanelProps): string {
    const { data, loading } = props;

    if (loading) {
        return `
            <div class="unified-balance-panel">
                <div class="unified-balance-header">
                    <div class="balance-amount" style="width: 150px; height: 32px; background: var(--r-neutral-line); border-radius: 4px; margin-bottom: 8px;"></div>
                    <div style="width: 80px; height: 16px; background: var(--r-neutral-line); border-radius: 2px;"></div>
                </div>
                <div class="chain-logos-row" style="margin-top: 16px;">
                    <div class="chain-logos" style="display: flex; gap: 8px;">
                        ${Array(5).fill(0).map(() => `
                            <div style="width: 24px; height: 24px; background: var(--r-neutral-line); border-radius: 50%;"></div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    if (!data || data.error) {
        const errorMessage = data?.error || 'Failed to load balances';
        
        return `
            <div class="unified-balance-panel">
                <div class="unified-balance-error">
                    ${errorMessage}
                </div>
            </div>
        `;
    }

    const formatUSD = (value: number): string => {
        if (value < 0.01) return '<$0.01';
        return `$${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
    };

    const formatBalance = (balance: string, decimals: number = 6): string => {
        const num = parseFloat(balance);
        if (num === 0) return '0';
        if (num < 0.000001) return '<0.000001';
        return num.toFixed(decimals).replace(/\.?0+$/, '');
    };

    // Get unique chains from all assets
    const chainIds = new Set<number>();
    data.assets.forEach(asset => {
        asset.breakdown?.forEach(breakdown => {
            chainIds.add(breakdown.chain.id);
        });
    });

    const chainLogos = Array.from(chainIds).slice(0, 8); // Show first 8 chains
    const remainingChains = chainIds.size - chainLogos.length;

    // Calculate 24h change (placeholder - you'd need historical data)
    const change24h = 1.51; // This would come from historical data

    return `
        <div class="unified-balance-panel">
            <div class="unified-balance-header">
                <div class="balance-amount" id="unified-balance-amount">
                    ${formatUSD(data.totalBalanceUSD)}
                </div>
                ${change24h !== null ? `
                    <div class="balance-change" style="color: ${change24h >= 0 ? 'var(--r-green-default)' : 'var(--r-red-default)'};">
                        ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%
                    </div>
                ` : ''}
            </div>
            
            <div class="chain-logos-row">
                <div class="chain-logos">
                    ${chainLogos.map(chainId => {
                        const logo = getChainLogo(chainId);
                        return `
                            <div class="chain-logo" title="${getChainName(chainId)}">
                                ${logo ? `
                                    <img src="${logo}" alt="${getChainName(chainId)}" 
                                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                    <div class="chain-logo-fallback" style="display: none; width: 20px; height: 20px; border-radius: 50%; background: var(--r-neutral-line); align-items: center; justify-content: center; font-size: 10px; color: var(--r-neutral-foot);">
                                        ${getChainName(chainId).charAt(0)}
                                    </div>
                                ` : `
                                    <div class="chain-logo-fallback" style="width: 20px; height: 20px; border-radius: 50%; background: var(--r-neutral-line); display: flex; align-items: center; justify-content: center; font-size: 10px; color: var(--r-neutral-foot);">
                                        ${getChainName(chainId).charAt(0)}
                                    </div>
                                `}
                            </div>
                        `;
                    }).join('')}
                    ${remainingChains > 0 ? `
                        <div class="chain-logo-more">+${remainingChains}</div>
                    ` : ''}
                </div>
                <div class="view-all-assets" id="view-all-assets-btn" style="cursor: pointer;">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                        <path d="M6 12L10 8L6 4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
            </div>

            <div class="unified-balance-chart" id="unified-balance-chart">
                <!-- Chart will be rendered here -->
                <div class="chart-placeholder">
                    <svg width="100%" height="60" viewBox="0 0 300 60" preserveAspectRatio="none">
                        <defs>
                            <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" style="stop-color: var(--r-green-default); stop-opacity: 0.3"/>
                                <stop offset="100%" style="stop-color: var(--r-green-default); stop-opacity: 0"/>
                            </linearGradient>
                        </defs>
                        <path d="M0,50 Q75,45 150,30 T300,10" 
                              fill="url(#chartGradient)" 
                              stroke="var(--r-green-default)" 
                              stroke-width="2"/>
                    </svg>
                </div>
            </div>

            <div class="asset-breakdown" id="asset-breakdown" style="display: none;">
                ${data.assets.length > 0 ? `
                    <div class="asset-list">
                        ${data.assets.map(asset => `
                            <div class="asset-item">
                                <div class="asset-header">
                                    <div class="asset-info">
                                        ${asset.icon ? `
                                            <img src="${asset.icon}" alt="${asset.symbol}" class="asset-icon">
                                        ` : `
                                            <div class="asset-icon-fallback">${asset.symbol.charAt(0)}</div>
                                        `}
                                        <div>
                                            <div class="asset-symbol">${asset.symbol}</div>
                                            <div class="asset-balance">${formatBalance(asset.balance)}</div>
                                        </div>
                                    </div>
                                    <div class="asset-usd">${formatUSD(asset.balanceInFiat || 0)}</div>
                                </div>
                                ${asset.breakdown && asset.breakdown.length > 0 ? `
                                    <div class="asset-chains">
                                        ${asset.breakdown.map(chainBalance => `
                                            <div class="chain-balance-item">
                                                <div class="chain-info">
                                                    ${getChainLogo(chainBalance.chain.id) ? `
                                                        <img src="${getChainLogo(chainBalance.chain.id)}" 
                                                             alt="${chainBalance.chain.name}" 
                                                             class="chain-logo-small"
                                                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                                        <div class="chain-logo-small-fallback" style="display: none;">${chainBalance.chain.name.charAt(0)}</div>
                                                    ` : `
                                                        <div class="chain-logo-small-fallback">${chainBalance.chain.name.charAt(0)}</div>
                                                    `}
                                                    <span class="chain-name">${chainBalance.chain.name}</span>
                                                </div>
                                                <div class="chain-balance">
                                                    <span>${formatBalance(chainBalance.balance)}</span>
                                                    <span class="chain-balance-usd">${formatUSD(chainBalance.balanceInFiat || 0)}</span>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="no-assets">No assets found</div>
                `}
            </div>
        </div>
    `;
}

