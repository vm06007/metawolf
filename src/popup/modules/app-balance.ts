import { unifiedBalanceService } from '../services/unified-balance-service';
import { transferService } from '../services/transfer-service';
import { createEIP1193Provider } from '../services/eip1193-provider';
import { fetchHistoricalBalanceFromOctav } from '../services/transactions-service';
import { renderRechartsChart } from '../utils/recharts-renderer';
import { formatChartTime, formatChartBalance } from '../utils/balance-chart';
import { loadEthers } from '../ethers-loader';
import type { AppState } from '../types/app-state';

export interface BalanceContext {
    state: AppState;
    render: () => void;
    updateBalanceDisplay: (hoverData: { timestamp: number; balance: number; visible: boolean }, currentBalance: number, firstBalance: number) => void;
    renderPlaceholderChart: () => void;
}

export async function initializeUnifiedBalance(
    account: any,
    context: BalanceContext
): Promise<void> {
    const { state, render } = context;
    
    if (!account || !account.address) {
        return;
    }

    // For Halo chip accounts, fetch balance directly from node (no SDK needed)
    if (account.isChipAccount && account.chipInfo) {
        console.log('[PopupApp] Halo chip account detected, fetching balance directly from node');
        await loadUnifiedBalances(context);
        return;
    }

    // For watch-only addresses, use Octav portfolio API (no SDK needed)
    if (account.isWatchOnly) {
        console.log('[PopupApp] Watch-only account detected, fetching balance from Octav API');
        await loadUnifiedBalances(context);
        return;
    }

    // For Firefly accounts, fetch balance directly from node (same as Halo accounts)
    if (account.isFireflyAccount) {
        console.log('[PopupApp] Firefly account detected, fetching balance directly from node');
        await loadUnifiedBalances(context);
        return;
    }

    // For regular accounts, use SDK with signing
    let accountToUse = account;

    // Ensure Buffer is available before initializing SDK
    if (typeof (window as any).Buffer === 'undefined') {
        console.warn('[PopupApp] Buffer not available, waiting for polyfills...');
        await new Promise(resolve => setTimeout(resolve, 100));

        if (typeof (window as any).Buffer === 'undefined') {
            console.error('[PopupApp] Buffer still not available after wait');
            state.unifiedBalanceLoading = false;
            state.unifiedBalanceData = {
                totalBalanceUSD: 0,
                assets: [],
                loading: false,
                error: 'Buffer polyfill not loaded',
            };
            return;
        }
    }

    try {
        unifiedBalanceService.deinit();

        const ethersModule = await loadEthers();
        const ethers = ethersModule.ethers || ethersModule.default || ethersModule;
        const provider = new ethers.JsonRpcProvider('https://mainnet.infura.io/v3/b17509e0e2ce45f48a44289ff1aa3c73');

        const eip1193Provider = createEIP1193Provider(provider, accountToUse.address);

        await unifiedBalanceService.initialize(eip1193Provider, 'mainnet');

        const sdk = (unifiedBalanceService as any).sdk;
        if (sdk) {
            transferService.setSDK(sdk);
        }

        await loadUnifiedBalances(context);
        render();
    } catch (error: any) {
        console.error('[PopupApp] Error initializing unified balance:', error);
        state.unifiedBalanceLoading = false;
        state.unifiedBalanceData = {
            totalBalanceUSD: 0,
            assets: [],
            loading: false,
            error: error.message || 'Failed to initialize unified balance',
        };
        render();
    }
}

export async function loadUnifiedBalances(context: BalanceContext): Promise<void> {
    const { state, render } = context;
    
    try {
        state.unifiedBalanceLoading = true;
        render();

        const data = await unifiedBalanceService.getUnifiedBalances(state.selectedAccount);
        state.unifiedBalanceData = data;

        if (data.totalBalanceUSD > 0) {
            state.balance = data.totalBalanceUSD.toFixed(2);
        }

        console.log('[PopupApp] Unified balances loaded:', {
            totalUSD: data.totalBalanceUSD,
            assetCount: data.assets.length,
            hasError: !!data.error
        });

        if ((state.selectedAccount?.isWatchOnly || state.selectedAccount?.isFireflyAccount) && state.selectedAccount?.address) {
            console.log('[PopupApp] Loading historical balances for view-only/Firefly account');
            await loadHistoricalBalances(context);
        } else {
            console.log('[PopupApp] Not a view-only/Firefly account, skipping historical data');
            state.historicalBalanceData = null;
            state.historicalBalanceLoading = false;
        }
    } catch (error: any) {
        console.error('[PopupApp] Error loading unified balances:', error);
        state.unifiedBalanceData = {
            totalBalanceUSD: 0,
            assets: [],
            loading: false,
            error: error.message || 'Failed to load unified balances',
        };
        state.historicalBalanceData = null;
        state.historicalBalanceLoading = false;
    } finally {
        state.unifiedBalanceLoading = false;
        render();
        setTimeout(() => {
            console.log('[PopupApp] Rendering charts after loadUnifiedBalances');
            renderCharts(context);
        }, 100);
    }
}

export async function loadHistoricalBalances(context: BalanceContext): Promise<void> {
    const { state, render } = context;
    
    if (!state.selectedAccount?.address) {
        return;
    }

    try {
        state.historicalBalanceLoading = true;
        render();

        const historicalData = await fetchHistoricalBalanceFromOctav({
            address: state.selectedAccount.address,
            hours: 24,
            points: 24,
        });

        state.historicalBalanceData = historicalData && historicalData.length > 0 ? historicalData : null;
        console.log('[PopupApp] Historical balances loaded:', {
            points: historicalData?.length || 0,
            firstBalance: historicalData?.[0]?.balance,
            lastBalance: historicalData?.[historicalData.length - 1]?.balance,
        });
    } catch (error: any) {
        console.error('[PopupApp] Error loading historical balances:', error);
        state.historicalBalanceData = null;
    } finally {
        state.historicalBalanceLoading = false;
        render();
        setTimeout(() => {
            console.log('[PopupApp] Rendering charts after loadHistoricalBalances');
            renderCharts(context);
        }, 100);
    }
}

export function renderCharts(context: BalanceContext): void {
    const { state, updateBalanceDisplay, renderPlaceholderChart } = context;
    
    console.log('[PopupApp] renderCharts called', {
        hasHistoricalData: !!state.historicalBalanceData,
        dataLength: state.historicalBalanceData?.length || 0,
        isLoading: state.historicalBalanceLoading,
    });

    if (state.historicalBalanceData && state.historicalBalanceData.length > 0) {
        const chartColor = state.historicalBalanceData.length >= 2
            ? (state.historicalBalanceData[state.historicalBalanceData.length - 1].balance >=
                state.historicalBalanceData[0].balance ? '#27C193' : '#F24822')
            : '#27C193';

        const currentBalance = state.unifiedBalanceData?.totalBalanceUSD || 0;
        const firstBalance = state.historicalBalanceData[0]?.balance || currentBalance;

        const chartContainer = document.getElementById('unified-balance-chart-container');
        if (chartContainer) {
            console.log('[PopupApp] Rendering Recharts chart in UnifiedBalancePanel');
            renderRechartsChart('unified-balance-chart-container', {
                data: state.historicalBalanceData,
                width: chartContainer.clientWidth || 300,
                height: 60,
                color: chartColor,
                gradientId: 'chartGradient',
                onHover: (data) => {
                    const tooltip = document.getElementById('unified-balance-chart-tooltip');
                    if (tooltip) {
                        if (data.visible) {
                            tooltip.textContent = `${formatChartTime(data.timestamp)} - ${formatChartBalance(data.balance)}`;
                            tooltip.style.display = 'block';
                        } else {
                            tooltip.style.display = 'none';
                        }
                    }
                    updateBalanceDisplay(data, currentBalance, firstBalance);
                },
            });
        } else {
            console.warn('[PopupApp] Chart container not found: unified-balance-chart-container');
        }

        const headerChartContainer = document.getElementById('unified-balance-chart-header-container');
        if (headerChartContainer) {
            console.log('[PopupApp] Rendering Recharts chart in DashboardHeader');
            renderRechartsChart('unified-balance-chart-header-container', {
                data: state.historicalBalanceData,
                width: headerChartContainer.clientWidth || 300,
                height: 60,
                color: chartColor,
                gradientId: 'chartGradientHeader',
                onHover: (data) => {
                    const tooltip = document.getElementById('unified-balance-chart-header-tooltip');
                    if (tooltip) {
                        if (data.visible) {
                            tooltip.textContent = `${formatChartTime(data.timestamp)} - ${formatChartBalance(data.balance)}`;
                            tooltip.style.display = 'block';
                        } else {
                            tooltip.style.display = 'none';
                        }
                    }
                    updateBalanceDisplay(data, currentBalance, firstBalance);
                },
            });
        } else {
            console.warn('[PopupApp] Chart container not found: unified-balance-chart-header-container');
        }
    } else {
        console.log('[PopupApp] No historical data, rendering placeholder');
        renderPlaceholderChart();
    }
}

