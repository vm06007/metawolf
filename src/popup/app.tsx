import { WalletService } from './services/wallet-service';
import { HaloService } from './services/halo-service';
import { FireflyService } from './services/firefly-service';
import { multisigService } from './services/multisig-service';
import { formatAddress, getDisplayName } from './utils/account';
import { getTokenImageAttributes } from './utils/token-icons';
import { renderDashboardHeader } from './components/DashboardHeader';
import { renderDashboardPanel, DEFAULT_PANEL_ITEMS, getPanelItems } from './components/DashboardPanel';
import { renderLockScreen } from './components/LockScreen';
import { renderAccountSelectorModal } from './components/AccountSelectorModal';
import { renderAccountDetailModal } from './components/AccountDetailModal';
import { renderSmartAccountUpgrade } from './components/SmartAccountUpgrade';
import { renderEip7702Modal } from './components/Eip7702Modal';
import { renderDelegationModal } from './components/DelegationModal';
import { renderSubscriptionsModal } from './components/SubscriptionsModal';
import { renderSubscriptionSignModal } from './components/SubscriptionSignModal';
import { renderPasswordModal } from './components/PasswordModal';
import { renderAccountSidebar } from './components/AccountSidebar';
import { renderTransactionList, Transaction } from './components/TransactionList';
import { renderAddWalletModal, ADD_WALLET_OPTIONS } from './components/AddWalletModal';
import { renderAddContactModal } from './components/AddContactModal';
import { renderCurrentConnection, ConnectedDApp } from './components/CurrentConnection';
import { renderCreateAccountForm } from './components/CreateAccountForm';
import { renderImportAccountForm } from './components/ImportAccountForm';
import { renderCreateMultisigForm } from './components/CreateMultisigForm';
import { renderParallelMultisigScan } from './components/ParallelMultisigScan';
import { renderHaloChipNameForm } from './components/HaloChipNameForm';
import { renderFireflyNameForm } from './components/FireflyNameForm';
import { renderSecurityConfirmModal } from './components/SecurityConfirmModal';
import { renderDeleteAccountModal } from './components/DeleteAccountModal';
import { renderSettingsMenu } from './components/SettingsMenu';
import { renderEthPricePanel, EthPriceData } from './components/EthPricePanel';
import { renderPrivateKeyModal } from './components/PrivateKeyModal';
import { renderUnifiedBalancePanel } from './components/UnifiedBalancePanel';
import { renderReceiveScreen, initReceiveScreenQRCode } from './components/ReceiveScreen';
import { renderSendScreen } from './components/SendScreen';
import { renderTransactionsScreen } from './components/TransactionsScreen';
import { renderNetworkSelectorModal } from './components/NetworkSelectorModal';
import { renderDeFiPositions } from './components/DeFiPositions';
import { ethPriceService } from './services/eth-price-service';
import { unifiedBalanceService } from './services/unified-balance-service';
import { fetchTransactionsFromOctav, fetchPortfolioFromOctav, OctavTransaction } from './services/transactions-service';
import { HaloUI } from './halo-ui';
import { isAddress, getAddress } from '@ethersproject/address';
import { loadEthers } from './ethers-loader';
import { type AppState, createInitialState, TRANSACTIONS_PAGE_SIZE } from './types/app-state';
import * as BalanceModule from './modules/app-balance';
import * as UIModule from './modules/app-ui';
import * as TransferModule from './modules/app-transfers';
import * as ModalModule from './modules/app-modals';

export class PopupApp {
    public state: AppState = createInitialState();

    private walletService: WalletService;
    private haloService: HaloService;
    private fireflyService: FireflyService;
    private delegationRequestId = 0;
    private delegationLoadingTimeout?: number;

    constructor() {
        this.walletService = new WalletService();
        this.haloService = new HaloService();
        this.fireflyService = new FireflyService();
    }

    async init() {
        try {
            console.log('[Init] Initializing popup...');

            if (!chrome.runtime || !chrome.runtime.id) {
                console.error('[Init] Extension runtime not available!');
                // Extension runtime not available - this is a critical error
                // We'll show it in the UI when render is called
                return;
            }

            // Wake up service worker
            await this.wakeServiceWorker();

            // Wait for background script to initialize
            await new Promise(resolve => setTimeout(resolve, 200));

            // Load data
            await Promise.all([
                this.checkUnlocked(),
                this.loadAccounts(),
                this.loadNetworks(),
                this.loadConnectedDApp(),
                this.loadEthPrice(),
            ]);
        } catch (error: any) {
            console.error('Error during initialization:', error);
        } finally {
            this.state.loading = false;
            setTimeout(() => this.render(), 0);
        }
    }

    private async wakeServiceWorker() {
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                const pingResponse = await Promise.race([
                    chrome.runtime.sendMessage({ type: 'PING' }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('PING timeout')), 3000))
                ]);
                if (pingResponse && (pingResponse.success || pingResponse.pong)) {
                    console.log('[Init] Service worker is awake!');
                    return;
                }
            } catch (error: any) {
                if (attempt < 4) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                }
            }
        }
    }

    async checkUnlocked() {
        this.state.unlocked = await this.walletService.checkUnlocked();
        // Check if password exists
        const { hasPassword } = await import('../core/password.js');
        this.state.hasPassword = await hasPassword();
        // If no password is set and we have accounts, unlock automatically
        if (!this.state.hasPassword && this.state.accounts.length > 0) {
            this.state.unlocked = true;
        }
    }

    async loadAccounts() {
        this.state.accounts = await this.walletService.getAccounts();
        const selected = await this.walletService.getSelectedAccount();
        if (selected) {
            this.state.selectedAccount = selected;
            this.state.balance = ''; // Don't show balance until unified balance loads
            // Initialize and load unified balances (don't block on errors)
            this.initializeUnifiedBalance(selected).catch((error) => {
                console.warn('[PopupApp] Unified balance initialization failed, continuing without it:', error);
                // App should still work without unified balance
            });
        }
    }

    async initializeUnifiedBalance(account: any) {
        await BalanceModule.initializeUnifiedBalance(account, this.getBalanceContext());
    }

    async loadUnifiedBalances() {
        await BalanceModule.loadUnifiedBalances(this.getBalanceContext());
        
        // Also load portfolio data for DeFi positions
        await this.loadPortfolioData();

        // If send screen is open, update the balance display for the selected token
        if (this.state.showSendScreen) {
            const sendState = (this as any)._sendScreenState;
            if (sendState && sendState.selectedToken) {
                // Update balance display for selected token
                const asset = this.state.unifiedBalanceData?.assets.find(a => a.symbol === sendState.selectedToken);
                const tokenBalance = asset ? parseFloat(asset.balance) : 0;
                const amountBalance = document.getElementById('send-amount-balance');
                if (amountBalance) {
                    amountBalance.textContent = `Balance: ${tokenBalance.toFixed(6)} ${sendState.selectedToken}`;
                }
            } else {
                // No token selected yet, refresh the entire send screen to show updated assets
                this.render();
            }
        }
    }

    async loadPortfolioData() {
        const account = this.state.selectedAccount;
        if (!account || !account.address) {
            this.state.portfolioData = null;
            this.state.portfolioLoading = false;
            return;
        }

        try {
            this.state.portfolioLoading = true;
            this.render();

            const portfolio = await fetchPortfolioFromOctav({
                addresses: account.address,
                includeImages: true,
            });

            // Handle case where response might be an array (multiple addresses)
            const portfolioData = Array.isArray(portfolio) ? portfolio[0] : portfolio;
            
            console.log('[PopupApp] Portfolio data loaded:', {
                hasData: !!portfolioData,
                hasProtocols: !!(portfolioData?.assetByProtocols),
                protocolCount: portfolioData?.assetByProtocols ? Object.keys(portfolioData.assetByProtocols).length : 0,
                chains: portfolioData?.chains ? Object.keys(portfolioData.chains) : [],
            });
            
            // Log detailed protocol info for debugging
            if (portfolioData?.assetByProtocols) {
                Object.entries(portfolioData.assetByProtocols).forEach(([key, protocol]: [string, any]) => {
                    console.log(`[PopupApp] Protocol ${key}:`, {
                        name: protocol.name,
                        value: protocol.value,
                        assetCount: protocol.assets?.length || 0,
                        assets: protocol.assets?.map((a: any) => ({
                            symbol: a.symbol,
                            value: a.value,
                            balance: a.balance,
                            chain: a.chain,
                            hasImage: !!a.image,
                        })) || [],
                    });
                });
            }
            
            this.state.portfolioData = portfolioData;
        } catch (error: any) {
            console.error('[PopupApp] Error loading portfolio data:', error);
            this.state.portfolioData = null;
            
            // Log detailed error for debugging
            if (error.message?.includes('401')) {
                console.error('[PopupApp] OCTAV API authentication failed. Please check API key.');
            } else if (error.message?.includes('402')) {
                console.error('[PopupApp] OCTAV API credits required. Please purchase credits.');
            }
        } finally {
            this.state.portfolioLoading = false;
            this.render();
        }
    }

    handleDefiChainClick(chainId: number | null) {
        this.state.defiSelectedChainId = chainId;
        this.render();
    }

    async loadHistoricalBalances() {
        await BalanceModule.loadHistoricalBalances(this.getBalanceContext());
    }

    renderCharts() {
        BalanceModule.renderCharts(this.getBalanceContext());
    }

    private getBalanceContext(): BalanceModule.BalanceContext {
        return {
            state: this.state,
            render: () => this.render(),
            updateBalanceDisplay: (hoverData, currentBalance, firstBalance) =>
                this.updateBalanceDisplay(hoverData, currentBalance, firstBalance),
            renderPlaceholderChart: () => this.renderPlaceholderChart(),
        };
    }

    updateBalanceDisplay(
        hoverData: { timestamp: number; balance: number; visible: boolean },
        currentBalance: number,
        firstBalance: number
    ) {
        const formatUSD = (value: number): string => {
            if (value < 0.01) return '<$0.01';
            return `$${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
        };

        const getOrCreateChangeElement = (balanceEl: HTMLElement | null, isHeader: boolean): HTMLElement | null => {
            if (!balanceEl) return null;

            // Look for existing change element
            let changeEl = balanceEl.nextElementSibling as HTMLElement;
            if (changeEl && changeEl.classList.contains('balance-change')) {
                return changeEl;
            }

            // If not found, look in parent's children
            const parent = balanceEl.parentElement;
            if (parent) {
                changeEl = Array.from(parent.children).find(
                    el => el.classList.contains('balance-change')
                ) as HTMLElement;
                if (changeEl) return changeEl;
            }

            // Create change element if it doesn't exist
            changeEl = document.createElement('div');
            changeEl.className = 'balance-change';
            changeEl.style.marginLeft = isHeader ? '12px' : '0';
            balanceEl.parentElement?.appendChild(changeEl);
            return changeEl;
        };

        if (hoverData.visible && hoverData.balance > 0) {
            // Show hovered balance
            const hoveredBalance = hoverData.balance;
            const changeFromFirst = firstBalance > 0
                ? ((hoveredBalance - firstBalance) / firstBalance) * 100
                : 0;

            // Update balance amount in DashboardHeader
            const headerBalanceEl = document.getElementById('balance-amount');
            if (headerBalanceEl) {
                headerBalanceEl.textContent = formatUSD(hoveredBalance);

                // Update change percentage in DashboardHeader
                const headerChangeEl = getOrCreateChangeElement(headerBalanceEl, true);
                if (headerChangeEl) {
                    headerChangeEl.textContent = `${changeFromFirst >= 0 ? '+' : ''}${changeFromFirst.toFixed(2)}%`;
                    headerChangeEl.style.color = changeFromFirst >= 0 ? '#27C193' : '#F24822';
                    headerChangeEl.style.display = 'block';
                }
            }

            // Update balance amount in UnifiedBalancePanel
            const panelBalanceEl = document.getElementById('unified-balance-amount');
            if (panelBalanceEl) {
                panelBalanceEl.textContent = formatUSD(hoveredBalance);

                // Update change percentage in UnifiedBalancePanel
                const panelChangeEl = getOrCreateChangeElement(panelBalanceEl, false);
                if (panelChangeEl) {
                    panelChangeEl.textContent = `${changeFromFirst >= 0 ? '+' : ''}${changeFromFirst.toFixed(2)}%`;
                    panelChangeEl.style.color = changeFromFirst >= 0 ? 'var(--r-green-default)' : 'var(--r-red-default)';
                    panelChangeEl.style.display = 'block';
                }
            }
        } else {
            // Reset to current balance
            const change24h = firstBalance > 0
                ? ((currentBalance - firstBalance) / firstBalance) * 100
                : 0;

            // Reset balance in DashboardHeader
            const headerBalanceEl = document.getElementById('balance-amount');
            if (headerBalanceEl) {
                headerBalanceEl.textContent = formatUSD(currentBalance);

                // Reset change percentage in DashboardHeader
                const headerChangeEl = getOrCreateChangeElement(headerBalanceEl, true);
                if (headerChangeEl) {
                    headerChangeEl.textContent = `${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%`;
                    headerChangeEl.style.color = change24h >= 0 ? '#27C193' : '#F24822';
                    headerChangeEl.style.display = 'block';
                }
            }

            // Reset balance in UnifiedBalancePanel
            const panelBalanceEl = document.getElementById('unified-balance-amount');
            if (panelBalanceEl) {
                panelBalanceEl.textContent = formatUSD(currentBalance);

                // Reset change percentage in UnifiedBalancePanel
                const panelChangeEl = getOrCreateChangeElement(panelBalanceEl, false);
                if (panelChangeEl) {
                    panelChangeEl.textContent = `${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%`;
                    panelChangeEl.style.color = change24h >= 0 ? 'var(--r-green-default)' : 'var(--r-red-default)';
                    panelChangeEl.style.display = 'block';
                }
            }
        }
    }

    renderPlaceholderChart() {
        // Render placeholder in UnifiedBalancePanel
        const chartContainer = document.getElementById('unified-balance-chart-container');
        if (chartContainer) {
            chartContainer.innerHTML = `
                <svg width="100%" height="60" viewBox="0 0 300 60" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="chartGradientPlaceholder" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" style="stop-color: var(--r-green-default); stop-opacity: 0.3"/>
                            <stop offset="100%" style="stop-color: var(--r-green-default); stop-opacity: 0"/>
                        </linearGradient>
                    </defs>
                    <path d="M0,50 Q75,45 150,30 T300,10"
                          fill="url(#chartGradientPlaceholder)"
                          stroke="var(--r-green-default)"
                          stroke-width="2"/>
                </svg>
            `;
        }

        // Render placeholder in DashboardHeader
        const headerChartContainer = document.getElementById('unified-balance-chart-header-container');
        if (headerChartContainer) {
            headerChartContainer.innerHTML = `
                <svg width="100%" height="60" viewBox="0 0 300 60" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="chartGradientHeaderPlaceholder" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" style="stop-color: #27C193; stop-opacity: 0.3"/>
                            <stop offset="100%" style="stop-color: #27C193; stop-opacity: 0"/>
                        </linearGradient>
                    </defs>
                    <path d="M0,50 Q75,45 150,30 T300,10"
                          fill="url(#chartGradientHeaderPlaceholder)"
                          stroke="#27C193"
                          stroke-width="2"/>
                </svg>
            `;
        }
    }

    async loadNetworks() {
        this.state.networks = await this.walletService.getNetworks();
        // Load the selected network from wallet state (persisted)
        const selectedNetwork = await this.walletService.getSelectedNetwork();
        if (selectedNetwork !== null && selectedNetwork !== undefined) {
            this.state.selectedNetwork = selectedNetwork;
        } else if (this.state.networks.length > 0) {
            // Fallback to first network if no selection persisted
            this.state.selectedNetwork = this.state.networks[0].chainId;
        }
    }

    async loadConnectedDApp() {
        try {
            // Get current tab to find connected DApp
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length > 0 && tabs[0].url) {
                try {
                    const url = new URL(tabs[0].url);
                    const origin = url.origin;

                    // Check if this origin is connected
                    const connections = await chrome.storage.local.get('dapp_connections');
                    const dappConnections = connections.dapp_connections || {};
                    const connection = dappConnections[origin];

                    if (connection) {
                        this.state.connectedDApp = {
                            origin: origin,
                            name: connection.name || origin,
                            icon: connection.icon || `${origin}/favicon.ico`,
                            account: connection.account,
                            connectedAt: connection.connectedAt,
                        };
                    } else {
                        this.state.connectedDApp = null;
                    }
                } catch (e) {
                    // Invalid URL (chrome://, etc.) - try to get most recent connection
                    const connections = await chrome.storage.local.get('dapp_connections');
                    const dappConnections = connections.dapp_connections || {};
                    const origins = Object.keys(dappConnections);
                    if (origins.length > 0) {
                        const sorted = origins.sort((a, b) => {
                            const timeA = dappConnections[a].connectedAt || 0;
                            const timeB = dappConnections[b].connectedAt || 0;
                            return timeB - timeA;
                        });
                        const mostRecent = dappConnections[sorted[0]];
                        this.state.connectedDApp = {
                            origin: sorted[0],
                            name: mostRecent.name || sorted[0],
                            icon: mostRecent.icon || `${sorted[0]}/favicon.ico`,
                            account: mostRecent.account,
                            connectedAt: mostRecent.connectedAt,
                        };
                    } else {
                        this.state.connectedDApp = null;
                    }
                }
            } else {
                // No active tab - try to get most recent connection
                const connections = await chrome.storage.local.get('dapp_connections');
                const dappConnections = connections.dapp_connections || {};
                const origins = Object.keys(dappConnections);
                if (origins.length > 0) {
                    const sorted = origins.sort((a, b) => {
                        const timeA = dappConnections[a].connectedAt || 0;
                        const timeB = dappConnections[b].connectedAt || 0;
                        return timeB - timeA;
                    });
                    const mostRecent = dappConnections[sorted[0]];
                    this.state.connectedDApp = {
                        origin: sorted[0],
                        name: mostRecent.name || sorted[0],
                        icon: mostRecent.icon || `${sorted[0]}/favicon.ico`,
                        account: mostRecent.account,
                        connectedAt: mostRecent.connectedAt,
                    };
                } else {
                    this.state.connectedDApp = null;
                }
            }
        } catch (error: any) {
            console.error('Error loading connected DApp:', error);
            this.state.connectedDApp = null;
        }
    }

    async loadEthPrice() {
        try {
            this.state.ethPriceLoading = true;
            const data = await ethPriceService.getEthPrice();
            this.state.ethPriceData = data;
        } catch (error: any) {
            console.error('Error loading ETH price:', error);
            this.state.ethPriceData = null;
        } finally {
            this.state.ethPriceLoading = false;
        }
    }

    async unlock() {
        const success = await this.walletService.unlock(this.state.password);
        if (success) {
            this.state.unlocked = true;
            this.state.password = '';
            await this.loadAccounts();
            this.render();
        } else {
            this.showErrorMessage('Failed to unlock wallet');
        }
    }

    async lock() {
        await this.walletService.lock();
        this.state.unlocked = false;
        this.render();
    }

    render() {
        const app = document.getElementById('app');
        if (!app) return;

        if (this.state.loading) {
            app.innerHTML = `
                <div class="loading">
                    <div class="loading-content">
                        <img src="${chrome.runtime.getURL('popup/wolfy-logo.png')}" alt="Wolfy" class="loading-logo" />
                        <div class="loading-spinner"></div>
                    </div>
                </div>
            `;
            return;
        }

        // Show lock screen only if password is set and wallet is locked
        if (this.state.hasPassword && !this.state.unlocked) {
            app.innerHTML = renderLockScreen(
                this.state.accounts.length > 0,
                this.state.password,
                this.state.errorMessage
            );
            this.attachLockScreenListeners();
            return;
        }

        // If no password is set and no accounts, show welcome screen (unless forms are showing)
        if (!this.state.hasPassword && this.state.accounts.length === 0 && !this.state.showCreateAccountForm && !this.state.showImportAccountForm) {
            // Wallet should be considered unlocked for welcome screen (no password to unlock)
            this.state.unlocked = true;
            app.innerHTML = renderLockScreen(
                false,
                '',
                undefined
            );
            // Use requestAnimationFrame and setTimeout to ensure DOM is fully ready
            requestAnimationFrame(() => {
                setTimeout(() => {
                    this.attachLockScreenListeners();
                }, 50);
            });
            return;
        }

        // If forms are showing on welcome screen, render a minimal background with the forms
        if (!this.state.hasPassword && this.state.accounts.length === 0 && (this.state.showCreateAccountForm || this.state.showImportAccountForm)) {
            // Wallet should be considered unlocked for welcome screen
            this.state.unlocked = true;
            app.innerHTML = `
                <div style="
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: var(--r-neutral-bg1);
                    z-index: 1;
                "></div>
                ${renderCreateAccountForm(
                    (name) => this.handleCreateAccountConfirm(name),
                    () => this.hideCreateAccountForm(),
                    this.state.showCreateAccountForm
                )}
                ${renderImportAccountForm(
                    (privateKey, name) => this.handleImportAccountConfirm(privateKey, name),
                    () => this.hideImportAccountForm(),
                    this.state.showImportAccountForm
                )}
            `;
            // Attach form listeners
            setTimeout(() => {
                // Create account form
                document.getElementById('create-account-overlay')?.addEventListener('click', (e) => {
                    if (e.target === e.currentTarget) {
                        this.hideCreateAccountForm();
                    }
                });
                document.getElementById('create-account-cancel')?.addEventListener('click', () => this.hideCreateAccountForm());
                document.getElementById('create-account-confirm')?.addEventListener('click', () => {
                    const nameInput = document.getElementById('create-account-name') as HTMLInputElement;
                    const name = nameInput?.value.trim() || undefined;
                    this.handleCreateAccountConfirm(name);
                });

                // Import account form
                document.getElementById('import-account-overlay')?.addEventListener('click', (e) => {
                    if (e.target === e.currentTarget) {
                        this.hideImportAccountForm();
                    }
                });
                document.getElementById('import-account-cancel')?.addEventListener('click', () => this.hideImportAccountForm());
                document.getElementById('import-account-confirm')?.addEventListener('click', () => {
                    const privateKeyInput = document.getElementById('import-account-private-key') as HTMLTextAreaElement;
                    const nameInput = document.getElementById('import-account-name') as HTMLInputElement;
                    const privateKey = privateKeyInput?.value.trim();
                    const name = nameInput?.value.trim() || undefined;
                    if (privateKey) {
                        this.handleImportAccountConfirm(privateKey, name);
                    }
                });
            }, 50);
            return;
        }

        // Show send screen if requested
        if (this.state.showSendScreen && this.state.selectedAccount) {
            const selectedAccount = this.state.selectedAccount;

            // Prevent send screen for watch-only accounts
            if (selectedAccount.isWatchOnly) {
                this.state.showSendScreen = false;
                this.render();
                return;
            }

            const displayName = getDisplayName(selectedAccount);
            const assets = this.state.unifiedBalanceData?.assets || [];

            // Get ETH balance for display in send screen (like Halo tag does)
            const ethAsset = assets.find(a => a.symbol === 'ETH' || a.symbol === 'WETH');
            const ethBalance = ethAsset ? parseFloat(ethAsset.balance).toFixed(6) : '0.000000';

            app.innerHTML = renderSendScreen({
                accountName: displayName,
                balance: this.state.balance || '0.00', // Keep for backward compatibility
                ethBalance: ethBalance, // ETH balance for send screen display
                assets: assets,
                hideBalance: this.state.sendScreenHideBalance,
                onBack: () => {
                    this.state.showSendScreen = false;
                    this.render();
                },
                onSend: async (params) => {
                    await this.handleSendTransfer(params);
                },
                onToggleVisibility: () => {
                    this.state.sendScreenHideBalance = !this.state.sendScreenHideBalance;
                    this.render();
                },
            });
            // Wait for DOM to be ready before attaching listeners
            setTimeout(() => {
                this.attachSendScreenListeners();
            }, 100);
            return;
        }

        // Show receive screen if requested
        if (this.state.showReceiveScreen && this.state.selectedAccount) {
            const selectedAccount = this.state.selectedAccount;
            const displayName = getDisplayName(selectedAccount);
            app.innerHTML = renderReceiveScreen({
                address: selectedAccount.address,
                accountName: displayName,
                balance: this.state.balance || '0.00',
                chainName: 'Ethereum', // TODO: Get from selected network
                hideBalance: this.state.receiveScreenHideBalance,
                onBack: () => {
                    this.state.showReceiveScreen = false;
                    this.render();
                },
                onCopyAddress: () => {
                    this.handleCopyAddress();
                },
                onToggleVisibility: () => {
                    this.state.receiveScreenHideBalance = !this.state.receiveScreenHideBalance;
                    this.render();
                },
            });
            this.attachReceiveScreenListeners();
            // Initialize QR code after a short delay to ensure DOM is ready
            setTimeout(() => {
                initReceiveScreenQRCode(selectedAccount.address).catch((error) => {
                    console.error('[PopupApp] Failed to initialize QR code:', error);
                });
            }, 100);
            return;
        }

        if (this.state.showTransactionsScreen) {
            const selectedAccount = this.state.selectedAccount;
            app.innerHTML = renderTransactionsScreen({
                accountAddress: selectedAccount?.address,
                accountName: selectedAccount ? getDisplayName(selectedAccount) : undefined,
                transactions: this.state.transactions,
                loading: this.state.transactionsLoading,
                error: this.state.transactionsError,
                hideSpam: this.state.transactionsHideSpam,
                hasMore: this.state.transactionsHasMore,
            });
            this.attachTransactionsScreenListeners();
            return;
        }

        // Render Rabby-style dashboard
        const selectedAccount = this.state.selectedAccount;
        const displayName = selectedAccount ? getDisplayName(selectedAccount) : 'Account';
        const isExpanded = window.location.pathname.includes('expanded.html');

        if (isExpanded) {
            // Expanded view with sidebar layout
            app.innerHTML = `
                <div class="expanded-container">
                    <div class="expanded-sidebar ${this.state.sidebarCollapsed ? 'collapsed' : ''}">
                        ${renderAccountSidebar(
                this.state.accounts,
                selectedAccount,
                (account) => this.handleSelectAccount(account),
                () => this.showAddWalletModal(),
                (account) => this.handleDeleteAccount(account),
                () => this.handleToggleSidebar(),
                this.state.sidebarCollapsed,
                (account) => this.handleEditAccount(account)
            )}
                    </div>
                    <div class="expanded-main">
                        <div class="dashboard">
                            ${renderDashboardHeader(
                selectedAccount,
                this.state.balance,
                displayName,
                () => this.showAccountSelector(),
                () => this.handleCopyAddress(),
                () => this.showAddWalletModal(),
                () => this.handleSettings(),
                () => this.handleExpand(),
                formatAddress,
                true,
                this.state.unifiedBalanceData,
                this.state.unifiedBalanceLoading,
                this.state.historicalBalanceData,
                this.state.historicalBalanceLoading
            )}
                            ${renderUnifiedBalancePanel({
                data: this.state.unifiedBalanceData,
                loading: this.state.unifiedBalanceLoading,
                historicalData: this.state.historicalBalanceData,
                historicalLoading: this.state.historicalBalanceLoading,
            })}
                            ${renderDashboardPanel(getPanelItems(true), true, this.state.selectedAccount?.isWatchOnly || false)}
                            <div class="transaction-section">
                                ${renderDeFiPositions({
                                    portfolio: this.state.portfolioData,
                                    loading: this.state.portfolioLoading,
                                    selectedChainId: this.state.defiSelectedChainId,
                                    onChainClick: (chainId) => this.handleDefiChainClick(chainId),
                                })}
                            </div>
                            <div class="current-connection-wrapper">
                                ${renderCurrentConnection(
                this.state.connectedDApp,
                () => this.handleDisconnectDApp(),
                () => this.handleChainChange(),
                this.state.ethPriceData,
                true,
                this.state.ethPriceLoading,
                this.state.networks.find(n => n.chainId === this.state.selectedNetwork)?.name
            )}
                            </div>
                        </div>
                    </div>
                </div>
                ${renderAddWalletModal(
                ADD_WALLET_OPTIONS,
                (optionId) => this.handleAddWalletOption(optionId),
                () => this.hideAddWalletModal(),
                this.state.showAddWalletModal
            )}
                ${renderCreateAccountForm(
                (name) => this.handleCreateAccountConfirm(name),
                () => this.hideCreateAccountForm(),
                this.state.showCreateAccountForm
            )}
                ${renderImportAccountForm(
                (privateKey, name) => this.handleImportAccountConfirm(privateKey, name),
                () => this.hideImportAccountForm(),
                this.state.showImportAccountForm
            )}
                ${renderCreateMultisigForm(
                (numChips, threshold, name) => this.handleCreateMultisigConfirm(numChips, threshold, name),
                () => this.hideCreateMultisigForm(),
                this.state.showCreateMultisigForm
            )}
                ${this.state.parallelScanState ? renderParallelMultisigScan(
                this.state.parallelScanState,
                (chipInfo) => {
                    // Chip 1 scanned callback (handled in scanChipParallel)
                },
                (chipInfo) => {
                    // Chip 2 scanned callback (handled in scanChipParallel)
                },
                () => {
                    // Cancel - cleanup gates and hide
                    this.cancelParallelMultisigScan();
                },
                this.state.showParallelMultisigScan
            ) : ''}
                ${renderHaloChipNameForm(
                (name) => this.handleHaloChipNameConfirm(name),
                () => this.hideHaloChipNameForm(),
                this.state.showHaloChipNameForm,
                'Add HaLo Chip Account'
            )}
                ${renderFireflyNameForm(
                (name) => this.handleFireflyNameConfirm(name),
                () => this.hideFireflyNameForm(),
                this.state.showFireflyNameForm,
                'Add Firefly Wallet'
            )}
                ${renderSecurityConfirmModal(
                (deleteKey) => this.handleSecurityConfirm(deleteKey),
                () => this.hideSecurityConfirm(),
                this.state.showSecurityConfirm
            )}
                ${renderDeleteAccountModal(
                this.state.accountToDelete,
                () => this.handleDeleteAccountConfirm(),
                () => this.hideDeleteAccountModal(),
                this.state.showDeleteAccountModal
            )}
                ${renderSettingsMenu(
                this.state.showSettingsMenu,
                () => this.hideSettingsMenu(),
                () => this.handleLockWallet(),
                this.state.hasPassword
            )}
                ${renderAccountDetailModal(
                this.state.accountToEdit,
                (address, name) => this.handleUpdateAccountName(address, name),
                (address) => this.handleExportPrivateKey(address),
                (address) => this.handleDeleteAccountFromDetail(address),
                () => this.hideAccountDetailModal(),
                this.state.showAccountDetailModal,
                this.state.accountDetailModalFirstRender
            )}
                ${this.state.showPasswordModal && this.state.passwordModalConfig ? renderPasswordModal(
                this.state.passwordModalConfig.title,
                this.state.passwordModalConfig.message,
                (password) => {
                    // Store callback before hiding
                    const callback = this.state.passwordModalConfig?.onConfirm;
                    this.hidePasswordModal();
                    if (callback) {
                        callback(password);
                    }
                },
                () => this.hidePasswordModal(),
                this.state.showPasswordModal,
                this.state.passwordModalFirstRender
            ) : ''}
            ${this.state.showPrivateKeyModal && this.state.privateKeyToShow ? renderPrivateKeyModal(
                this.state.privateKeyToShow,
                () => this.hidePrivateKeyModal(),
                this.state.showPrivateKeyModal,
                this.state.privateKeyRevealed,
                this.state.privateKeyModalFirstRender
            ) : ''}
            ${renderDelegationModal(
                this.state.delegationModalIsUpgrade,
                this.state.delegationModalIsUpgrade
                    ? (this.state.delegationContractAddress || this.getDefaultDelegatorAddress(this.state.selectedNetwork))
                    : '0x0000000000000000000000000000000000000000',
                () => this.handleApproveDelegation(),
                () => this.hideDelegationModal(),
                this.state.showDelegationModal,
                this.state.delegationModalFirstRender,
                this.state.selectedNetwork,
                this.state.delegationButtonToConfirm,
                () => {
                    this.state.delegationButtonToConfirm = false;
                    this.updateDelegationModal();
                }
            )}
            `;
        } else {
            // Popup view - normal layout
            app.innerHTML = `
                <div class="dashboard">
                    ${renderDashboardHeader(
                selectedAccount,
                this.state.balance,
                displayName,
                () => this.showAccountSelector(),
                () => this.handleCopyAddress(),
                () => this.showAddWalletModal(),
                () => this.handleSettings(),
                () => this.handleExpand(),
                formatAddress,
                false,
                this.state.unifiedBalanceData,
                this.state.unifiedBalanceLoading,
                this.state.historicalBalanceData,
                this.state.historicalBalanceLoading
            )}
                    ${renderUnifiedBalancePanel({
                data: this.state.unifiedBalanceData,
                loading: this.state.unifiedBalanceLoading,
                historicalData: this.state.historicalBalanceData,
                historicalLoading: this.state.historicalBalanceLoading,
            })}
                    ${renderDashboardPanel(getPanelItems(false), false, this.state.selectedAccount?.isWatchOnly || false)}
                    <div style="padding: 0 16px 4px 16px;">
                        ${renderEthPricePanel(this.state.ethPriceData, this.state.ethPriceLoading)}
                    </div>
                        <div class="current-connection-wrapper">
                            ${renderCurrentConnection(
                this.state.connectedDApp,
                () => this.handleDisconnectDApp(),
                () => this.handleChainChange(),
                undefined,
                false,
                false,
                this.state.networks.find(n => n.chainId === this.state.selectedNetwork)?.name,
                this.state.selectedNetwork
            )}
                        </div>
                </div>
                ${renderAccountSelectorModal(
                this.state.accounts,
                this.state.selectedAccount,
                (account) => this.handleSelectAccount(account),
                () => this.hideAccountSelector(),
                this.state.showAccountSelector,
                this.state.accountSelectorFirstRender,
                (account) => this.handleDeleteAccount(account),
                (account) => this.handleEditAccount(account)
            )}
            ${renderNetworkSelectorModal(
                this.state.networks.map(n => ({ chainId: n.chainId, name: n.name, logo: n.logo })),
                this.state.selectedNetwork,
                (chainId) => this.handleSelectNetwork(chainId),
                () => this.hideNetworkSelector(),
                this.state.showNetworkSelector
            )}
            ${renderAccountDetailModal(
                this.state.accountToEdit,
                (address, name) => this.handleUpdateAccountName(address, name),
                (address) => this.handleExportPrivateKey(address),
                (address) => this.handleDeleteAccountFromDetail(address),
                () => this.hideAccountDetailModal(),
                this.state.showAccountDetailModal,
                this.state.accountDetailModalFirstRender
            )}
            ${renderAddWalletModal(
                ADD_WALLET_OPTIONS,
                (optionId) => this.handleAddWalletOption(optionId),
                () => this.hideAddWalletModal(),
                this.state.showAddWalletModal
            )}
            ${renderCreateAccountForm(
                (name) => this.handleCreateAccountConfirm(name),
                () => this.hideCreateAccountForm(),
                this.state.showCreateAccountForm
            )}
            ${renderImportAccountForm(
                (privateKey, name) => this.handleImportAccountConfirm(privateKey, name),
                () => this.hideImportAccountForm(),
                this.state.showImportAccountForm
            )}
            ${renderCreateMultisigForm(
                (numChips, threshold, name) => this.handleCreateMultisigConfirm(numChips, threshold, name),
                () => this.hideCreateMultisigForm(),
                this.state.showCreateMultisigForm
            )}
            ${this.state.parallelScanState ? renderParallelMultisigScan(
                this.state.parallelScanState,
                (chipInfo) => {
                    // Chip 1 scanned callback (handled in scanChipParallel)
                },
                (chipInfo) => {
                    // Chip 2 scanned callback (handled in scanChipParallel)
                },
                () => {
                    // Cancel - cleanup gates and hide
                    this.cancelParallelMultisigScan();
                },
                this.state.showParallelMultisigScan
            ) : ''}
                ${renderHaloChipNameForm(
                (name) => this.handleHaloChipNameConfirm(name),
                () => this.hideHaloChipNameForm(),
                this.state.showHaloChipNameForm,
                'Add HaLo Chip Account'
            )}
            ${renderFireflyNameForm(
                (name) => this.handleFireflyNameConfirm(name),
                () => this.hideFireflyNameForm(),
                this.state.showFireflyNameForm,
                'Add Firefly Wallet'
            )}
            ${renderSecurityConfirmModal(
                (deleteKey) => this.handleSecurityConfirm(deleteKey),
                () => this.hideSecurityConfirm(),
                this.state.showSecurityConfirm
            )}
            ${renderDeleteAccountModal(
                this.state.accountToDelete,
                () => this.handleDeleteAccountConfirm(),
                () => this.hideDeleteAccountModal(),
                this.state.showDeleteAccountModal
            )}
            ${renderSettingsMenu(
                this.state.showSettingsMenu,
                () => this.hideSettingsMenu(),
                () => this.handleLockWallet(),
                this.state.hasPassword
            )}
            ${renderAddContactModal(
                (address, name) => this.handleAddContactConfirm(address, name),
                () => this.hideAddContactModal(),
                this.state.showAddContactModal
            )}
            ${this.state.showPasswordModal && this.state.passwordModalConfig ? renderPasswordModal(
                this.state.passwordModalConfig.title,
                this.state.passwordModalConfig.message,
                (password) => {
                    // Store callback before hiding
                    const callback = this.state.passwordModalConfig?.onConfirm;
                    this.hidePasswordModal();
                    if (callback) {
                        callback(password);
                    }
                },
                () => this.hidePasswordModal(),
                this.state.showPasswordModal,
                this.state.passwordModalFirstRender
            ) : ''}
            ${this.state.showPrivateKeyModal && this.state.privateKeyToShow ? renderPrivateKeyModal(
                this.state.privateKeyToShow,
                () => this.hidePrivateKeyModal(),
                this.state.showPrivateKeyModal,
                this.state.privateKeyRevealed,
                this.state.privateKeyModalFirstRender
            ) : ''}
        `;
        }

        this.attachDashboardListeners();
        
        // Attach DeFi positions listeners after a short delay to ensure DOM is ready
        setTimeout(() => {
            this.attachDeFiPositionsListeners();
        }, 50);

        // Attach parallel scan listeners if visible
        if (this.state.showParallelMultisigScan) {
            this.attachParallelScanListeners();
        }
        // Render charts after DOM is ready
        setTimeout(() => {
            console.log('[PopupApp] Rendering charts after dashboard render');
            this.renderCharts();
        }, 100);

        // If account detail modal is visible, attach its listeners
        if (this.state.showAccountDetailModal) {
            setTimeout(() => {
                this.attachAccountDetailListeners();
            }, 100);
        }

        // If password modal is visible, attach its listeners
        if (this.state.showPasswordModal) {
            setTimeout(() => {
                this.attachPasswordModalListeners();
            }, 100);
        }

        // If private key modal is visible, attach its listeners
        if (this.state.showPrivateKeyModal) {
            setTimeout(() => {
                this.attachPrivateKeyModalListeners();
            }, 100);
        }

        // If network selector modal is visible, attach its listeners
        if (this.state.showNetworkSelector) {
            setTimeout(() => {
                this.attachNetworkSelectorListeners();
            }, 100);
        }

        // Keep the standalone EIP-7702 modal in sync after any re-render
        this.updateEip7702Modal();
        
        // Keep the subscriptions modal in sync after any re-render
        this.updateSubscriptionsModal();
        this.updateSubscriptionSignModal();
    }

    private attachLockScreenListeners() {
        // Remove any existing listeners by cloning and replacing elements
        const unlockBtn = document.getElementById('unlock-btn');
        const passwordInput = document.getElementById('password-input') as HTMLInputElement;
        const createFirstBtn = document.getElementById('create-first-btn');
        const importFirstBtn = document.getElementById('import-first-btn');
        const forgotPasswordLink = document.getElementById('forgot-password-link');

        // Debug: Log button availability
        console.log('[attachLockScreenListeners] Buttons found:', {
            createFirstBtn: !!createFirstBtn,
            importFirstBtn: !!importFirstBtn,
            unlocked: this.state.unlocked,
            hasPassword: this.state.hasPassword,
            accountsCount: this.state.accounts.length
        });

        // Clone buttons to remove old event listeners
        if (createFirstBtn) {
            const newCreateBtn = createFirstBtn.cloneNode(true) as HTMLButtonElement;
            createFirstBtn.parentNode?.replaceChild(newCreateBtn, createFirstBtn);
        }
        if (importFirstBtn) {
            const newImportBtn = importFirstBtn.cloneNode(true) as HTMLButtonElement;
            importFirstBtn.parentNode?.replaceChild(newImportBtn, importFirstBtn);
        }

        // Get fresh references after cloning
        const freshCreateBtn = document.getElementById('create-first-btn');
        const freshImportBtn = document.getElementById('import-first-btn');

        unlockBtn?.addEventListener('click', async () => {
            const password = passwordInput?.value || '';

            // If no password is set and this is the first account creation
            if (!this.state.hasPassword && this.state.accounts.length === 0) {
                if (!password || password.length < 8) {
                    this.state.errorMessage = 'Password must be at least 8 characters long';
                    this.render();
                    return;
                }

                // Set password for first time
                const { setPassword } = await import('../core/password.js');
                await setPassword(password);
                this.state.hasPassword = true;
                this.state.unlocked = true;
                this.state.password = '';
                this.state.errorMessage = undefined;
                await this.loadAccounts();
                await this.loadNetworks();
                this.render();
                return;
            }

            if (!password) {
                this.state.errorMessage = 'Please enter a password';
                this.render();
                return;
            }

            const unlocked = await this.walletService.unlock(password);
            if (unlocked) {
                this.state.unlocked = true;
                this.state.password = '';
                this.state.errorMessage = undefined;
                await this.loadAccounts();
                await this.loadNetworks();
                this.render();
            } else {
                this.state.errorMessage = 'Incorrect password';
                this.render();
            }
        });

        passwordInput?.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                unlockBtn?.click();
            }
        });

        passwordInput?.addEventListener('input', () => {
            // Clear error when user starts typing
            if (this.state.errorMessage) {
                this.state.errorMessage = undefined;
                this.render();
            }
        });

        freshCreateBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[attachLockScreenListeners] Create button clicked');
            // Show create account form directly - password will be set when account is created
            this.state.unlocked = true; // Allow creating first account
            this.showCreateAccountForm();
        });

        freshImportBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[attachLockScreenListeners] Import button clicked');
            // Show import account form directly - password will be set when account is imported
            this.state.unlocked = true; // Allow importing first account
            this.showImportAccountForm();
        });

        forgotPasswordLink?.addEventListener('click', (e) => {
            e.preventDefault();
            // TODO: Implement forgot password flow
            alert('Forgot password functionality coming soon. If you have not set a password yet, you can unlock with any password.');
        });
    }

    private attachDashboardListeners() {
        // Header actions
        document.getElementById('account-selector-btn')?.addEventListener('click', () => this.showAccountSelector());
        // Copy address button (in header next to address)
        document.getElementById('copy-address-btn')?.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering account selector
            this.handleCopyAddress();
        });
        document.getElementById('add-wallet-btn')?.addEventListener('click', () => this.showAddWalletModal());
        document.getElementById('expand-btn')?.addEventListener('click', () => this.handleExpand());
        document.getElementById('settings-btn')?.addEventListener('click', () => this.handleSettings());

        // Current connection (connected DApp)
        document.getElementById('disconnect-dapp-btn')?.addEventListener('click', (e) => {
            const origin = (e.currentTarget as HTMLElement)?.getAttribute('data-origin');
            if (origin) {
                this.handleDisconnectDApp(origin);
            }
        });
        document.getElementById('current-connection-chain-btn')?.addEventListener('click', () => {
            this.handleChainChange();
        });

        // Account selector modal (popup view only)
        document.getElementById('account-selector-close')?.addEventListener('click', () => this.hideAccountSelector());
        document.getElementById('account-selector-overlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.hideAccountSelector();
            }
        });
        document.querySelectorAll('.account-selector-item').forEach(item => {
            item.addEventListener('click', () => {
                const address = item.getAttribute('data-address');
                if (address) {
                    const account = this.state.accounts.find(acc => acc.address === address);
                    if (account) {
                        this.handleSelectAccount(account);
                    }
                }
            });
        });

        // Edit account buttons
        document.querySelectorAll('.account-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const address = btn.getAttribute('data-address');
                if (address) {
                    const account = this.state.accounts.find(acc => acc.address === address);
                    if (account) {
                        this.handleEditAccount(account);
                    }
                }
            });
        });
        // Delete account buttons
        document.querySelectorAll('.account-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const address = btn.getAttribute('data-address');
                if (address) {
                    const account = this.state.accounts.find(acc => acc.address === address);
                    if (account) {
                        this.handleDeleteAccount(account);
                    }
                }
            });
        });

        // Account sidebar items (expanded view)
        document.getElementById('sidebar-add-wallet-btn')?.addEventListener('click', () => this.showAddWalletModal());
        document.getElementById('sidebar-collapse-btn')?.addEventListener('click', () => this.handleToggleSidebar());
        document.querySelectorAll('.account-sidebar-item').forEach(item => {
            item.addEventListener('click', () => {
                const address = item.getAttribute('data-address');
                if (address) {
                    const account = this.state.accounts.find(acc => acc.address === address);
                    if (account) {
                        this.handleSelectAccount(account);
                    }
                }
            });
        });

        // Account sidebar edit buttons (expanded view)
        document.querySelectorAll('.account-sidebar-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const address = btn.getAttribute('data-address');
                if (address) {
                    const account = this.state.accounts.find(acc => acc.address === address);
                    if (account) {
                        this.handleEditAccount(account);
                    }
                }
            });
        });
        // Account sidebar delete buttons (expanded view)
        document.querySelectorAll('.account-sidebar-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const address = btn.getAttribute('data-address');
                if (address) {
                    const account = this.state.accounts.find(acc => acc.address === address);
                    if (account) {
                        this.handleDeleteAccount(account);
                    }
                }
            });
        });

        // Add wallet modal
        document.getElementById('add-wallet-close')?.addEventListener('click', () => this.hideAddWalletModal());
        document.getElementById('add-wallet-overlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.hideAddWalletModal();
            }
        });
        document.querySelectorAll('.add-wallet-option').forEach(item => {
            item.addEventListener('click', () => {
                const optionId = item.getAttribute('data-option-id');
                if (optionId) {
                    this.handleAddWalletOption(optionId);
                }
            });
        });

        // Create account form
        document.getElementById('create-account-overlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.hideCreateAccountForm();
            }
        });
        document.getElementById('create-account-cancel')?.addEventListener('click', () => this.hideCreateAccountForm());
        document.getElementById('create-account-confirm')?.addEventListener('click', () => {
            const nameInput = document.getElementById('create-account-name') as HTMLInputElement;
            const name = nameInput?.value.trim() || undefined;
            this.handleCreateAccountConfirm(name);
        });

        // Import account form
        document.getElementById('import-account-overlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.hideImportAccountForm();
            }
        });
        document.getElementById('import-account-cancel')?.addEventListener('click', () => this.hideImportAccountForm());
        document.getElementById('import-account-confirm')?.addEventListener('click', () => {
            const privateKeyInput = document.getElementById('import-account-private-key') as HTMLTextAreaElement;
            const nameInput = document.getElementById('import-account-name') as HTMLInputElement;
            const privateKey = privateKeyInput?.value.trim();
            const name = nameInput?.value.trim() || undefined;
            if (privateKey) {
                this.handleImportAccountConfirm(privateKey, name);
            }
        });

        // Create multisig form
        document.getElementById('create-multisig-overlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.hideCreateMultisigForm();
            }
        });
        document.getElementById('multisig-cancel')?.addEventListener('click', () => this.hideCreateMultisigForm());
        document.getElementById('multisig-confirm')?.addEventListener('click', () => {
            const numChipsInput = document.getElementById('multisig-num-chips') as HTMLInputElement;
            const thresholdInput = document.getElementById('multisig-threshold') as HTMLInputElement;
            const nameInput = document.getElementById('multisig-name') as HTMLInputElement;
            const numChips = parseInt(numChipsInput?.value || '2');
            const threshold = parseInt(thresholdInput?.value || '2');
            const name = nameInput?.value.trim() || undefined;

            // Validate
            const errorEl = document.getElementById('multisig-error');
            if (numChips < 2 || numChips > 3) {
                if (errorEl) {
                    errorEl.style.display = 'block';
                    errorEl.textContent = 'Please enter 2 or 3 chips';
                }
                return;
            }
            if (threshold < 1 || threshold > numChips) {
                if (errorEl) {
                    errorEl.style.display = 'block';
                    errorEl.textContent = `Threshold must be between 1 and ${numChips}`;
                }
                return;
            }
            if (errorEl) {
                errorEl.style.display = 'none';
            }
            this.handleCreateMultisigConfirm(numChips, threshold, name);
        });

        // Halo chip name form
        document.getElementById('halo-chip-name-overlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.hideHaloChipNameForm();
            }
        });
        document.getElementById('halo-chip-cancel')?.addEventListener('click', () => this.hideHaloChipNameForm());
        document.getElementById('halo-chip-confirm')?.addEventListener('click', () => {
            const nameInput = document.getElementById('halo-chip-name') as HTMLInputElement;
            const name = nameInput?.value.trim() || undefined;
            this.handleHaloChipNameConfirm(name);
        });

        // Firefly name form
        document.getElementById('firefly-name-overlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.hideFireflyNameForm();
            }
        });
        document.getElementById('firefly-cancel')?.addEventListener('click', () => this.hideFireflyNameForm());
        document.getElementById('firefly-confirm')?.addEventListener('click', () => {
            const nameInput = document.getElementById('firefly-name') as HTMLInputElement;
            const name = nameInput?.value.trim() || undefined;
            this.handleFireflyNameConfirm(name);
        });

        // Security confirm modal
        document.getElementById('security-confirm-overlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.hideSecurityConfirm();
            }
        });
        document.getElementById('security-confirm-cancel')?.addEventListener('click', () => this.hideSecurityConfirm());
        document.getElementById('security-confirm-no')?.addEventListener('click', () => {
            this.handleSecurityConfirm(false);
        });
        document.getElementById('security-confirm-yes')?.addEventListener('click', () => {
            this.handleSecurityConfirm(true);
        });

        // Delete account modal
        document.getElementById('delete-account-overlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.hideDeleteAccountModal();
            }
        });
        document.getElementById('delete-account-cancel')?.addEventListener('click', () => this.hideDeleteAccountModal());
        document.getElementById('delete-account-confirm')?.addEventListener('click', () => this.handleDeleteAccountConfirm());

        // Enable/disable confirm button based on checkboxes and password
        const updateDeleteConfirmButton = () => {
            const checkbox1 = document.getElementById('delete-confirm-1') as HTMLInputElement;
            const checkbox2 = document.getElementById('delete-confirm-2') as HTMLInputElement;
            const passwordInput = document.getElementById('delete-account-password') as HTMLInputElement;
            const confirmBtn = document.getElementById('delete-account-confirm') as HTMLButtonElement;

            if (confirmBtn) {
                const isEnabled = checkbox1?.checked && checkbox2?.checked && passwordInput?.value?.trim().length > 0;
                confirmBtn.disabled = !isEnabled;
                confirmBtn.style.opacity = isEnabled ? '1' : '0.5';
                confirmBtn.style.cursor = isEnabled ? 'pointer' : 'not-allowed';
            }
        };

        // Attach listeners to checkboxes and password input
        const checkbox1 = document.getElementById('delete-confirm-1') as HTMLInputElement;
        const checkbox2 = document.getElementById('delete-confirm-2') as HTMLInputElement;
        const passwordInput = document.getElementById('delete-account-password') as HTMLInputElement;

        checkbox1?.addEventListener('change', updateDeleteConfirmButton);
        checkbox2?.addEventListener('change', updateDeleteConfirmButton);
        passwordInput?.addEventListener('input', updateDeleteConfirmButton);

        // Settings menu
        document.getElementById('settings-menu-overlay')?.addEventListener('click', () => this.hideSettingsMenu());
        document.getElementById('settings-menu-close')?.addEventListener('click', () => this.hideSettingsMenu());
        document.getElementById('settings-lock-wallet')?.addEventListener('click', () => {
            this.hideSettingsMenu();
            this.handleLockWallet();
        });
        // Other settings items - for now just log, can be implemented later
        document.getElementById('settings-signature-record')?.addEventListener('click', () => {
            console.log('Signature Record clicked');
            this.hideSettingsMenu();
        });
        document.getElementById('settings-manage-address')?.addEventListener('click', () => {
            console.log('Manage Address clicked');
            this.hideSettingsMenu();
        });
        document.getElementById('settings-ecosystem')?.addEventListener('click', () => {
            console.log('Ecosystem clicked');
            this.hideSettingsMenu();
        });
        document.getElementById('settings-mobile-sync')?.addEventListener('click', () => {
            console.log('Mobile Sync clicked');
            this.hideSettingsMenu();
        });
        document.getElementById('settings-search-dapps')?.addEventListener('click', () => {
            console.log('Search Dapps clicked');
            this.hideSettingsMenu();
        });
        document.getElementById('settings-connected-dapps')?.addEventListener('click', () => {
            console.log('Connected Dapps clicked');
            this.hideSettingsMenu();
        });
        document.getElementById('settings-custom-testnet')?.addEventListener('click', () => {
            console.log('Custom Testnet clicked');
            this.hideSettingsMenu();
        });
        document.getElementById('settings-custom-rpc')?.addEventListener('click', () => {
            console.log('Custom RPC clicked');
            this.hideSettingsMenu();
        });
        document.getElementById('settings-language')?.addEventListener('click', () => {
            console.log('Language clicked');
            this.hideSettingsMenu();
        });
        document.getElementById('settings-theme-mode')?.addEventListener('click', () => {
            console.log('Theme Mode clicked');
            this.hideSettingsMenu();
        });
        document.getElementById('settings-auto-lock')?.addEventListener('click', () => {
            console.log('Auto Lock clicked');
            this.hideSettingsMenu();
        });
        document.getElementById('settings-change-password')?.addEventListener('click', () => {
            this.hideSettingsMenu();
            this.handleChangePassword();
        });
        document.getElementById('settings-clear-pending')?.addEventListener('click', () => {
            console.log('Clear Pending clicked');
            this.hideSettingsMenu();
        });
        document.getElementById('settings-feedback')?.addEventListener('click', () => {
            window.open('https://debank.com/hi/0a110032', '_blank');
            this.hideSettingsMenu();
        });
        document.getElementById('settings-version')?.addEventListener('click', () => {
            console.log('Version clicked');
            this.hideSettingsMenu();
        });
        document.getElementById('settings-supported-chains')?.addEventListener('click', () => {
            console.log('Supported Chains clicked');
            this.hideSettingsMenu();
        });

        // Panel items
        document.getElementById('panel-send')?.addEventListener('click', async () => {
            // Prevent opening send screen for watch-only accounts
            if (this.state.selectedAccount?.isWatchOnly) {
                return;
            }

            // Ensure balances are loaded before showing send screen (especially for Firefly accounts)
            if (!this.state.unifiedBalanceData || this.state.unifiedBalanceData.assets.length === 0) {
                console.log('[PopupApp] Loading balances before showing send screen...');
                await this.loadUnifiedBalances();
            }

            this.state.showSendScreen = true;
            this.render();
        });
        document.getElementById('panel-receive')?.addEventListener('click', () => {
            // Prevent opening receive screen for watch-only accounts
            if (this.state.selectedAccount?.isWatchOnly) {
                return;
            }
            this.state.showReceiveScreen = true;
            this.render();
        });
        document.getElementById('panel-swap')?.addEventListener('click', () => {
            // Prevent swap for watch-only accounts
            if (this.state.selectedAccount?.isWatchOnly) {
                return;
            }
            console.log('Swap clicked');
        });
        document.getElementById('panel-bridge')?.addEventListener('click', () => {
            // Prevent bridge for watch-only accounts
            if (this.state.selectedAccount?.isWatchOnly) {
                return;
            }
            console.log('Bridge clicked');
        });
        document.getElementById('panel-transactions')?.addEventListener('click', () => this.openTransactionsScreen());
        document.getElementById('panel-approvals')?.addEventListener('click', () => console.log('Approvals clicked'));
        document.getElementById('panel-settings')?.addEventListener('click', () => this.handleSettings());
        document.getElementById('panel-x402')?.addEventListener('click', () => {
            this.showSubscriptionsModal();
        });
        document.getElementById('panel-nft')?.addEventListener('click', () => console.log('NFT clicked'));
        document.getElementById('panel-eip7702')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[attachDashboardListeners] EIP-7702 button clicked');
            this.showEip7702Modal();
        });
    }

    private attachDeFiPositionsListeners() {
        // Chain icon clicks in UnifiedBalancePanel - use event delegation for better reliability
        const chainLogosContainer = document.querySelector('.chain-logos');
        if (chainLogosContainer) {
            // Remove any existing listener to avoid duplicates
            const existingHandler = (chainLogosContainer as any)._defiChainClickHandler;
            if (existingHandler) {
                chainLogosContainer.removeEventListener('click', existingHandler);
            }
            
            const handler = (e: Event) => {
                const target = e.target as HTMLElement;
                const chainLogo = target.closest('.chain-logo.clickable');
                if (chainLogo) {
                    const chainId = parseInt(chainLogo.getAttribute('data-chain-id') || '0', 10);
                    if (chainId > 0) {
                        e.stopPropagation();
                        console.log('[attachDeFiPositionsListeners] Chain icon clicked:', chainId);
                        this.handleDefiChainClick(chainId);
                    }
                }
            };
            
            (chainLogosContainer as any)._defiChainClickHandler = handler;
            chainLogosContainer.addEventListener('click', handler);
        }

        // DeFi positions back button
        const backBtn = document.getElementById('defi-positions-back-btn');
        if (backBtn) {
            const newBackBtn = backBtn.cloneNode(true) as HTMLElement;
            backBtn.parentNode?.replaceChild(newBackBtn, backBtn);
            newBackBtn.addEventListener('click', () => {
                this.handleDefiChainClick(null);
            });
        }

        // DeFi positions filter clear button
        const filterClearBtn = document.getElementById('defi-positions-filter-clear');
        if (filterClearBtn) {
            const newFilterClearBtn = filterClearBtn.cloneNode(true) as HTMLElement;
            filterClearBtn.parentNode?.replaceChild(newFilterClearBtn, filterClearBtn);
            newFilterClearBtn.addEventListener('click', () => {
                this.handleDefiChainClick(null);
            });
        }

        // Chain icon clicks in DeFi positions protocol items - use event delegation
        const defiPositionsContainer = document.querySelector('.defi-positions');
        if (defiPositionsContainer) {
            defiPositionsContainer.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const chainIcon = target.closest('.defi-chain-icon[data-chain-id]');
                if (chainIcon) {
                    const chainId = parseInt(chainIcon.getAttribute('data-chain-id') || '0', 10);
                    if (chainId > 0) {
                        e.stopPropagation();
                        this.handleDefiChainClick(chainId);
                    }
                }
            });
        }
    }

    private attachReceiveScreenListeners() {
        document.getElementById('receive-back-btn')?.addEventListener('click', () => {
            this.state.showReceiveScreen = false;
            this.render();
        });

        document.getElementById('receive-copy-btn')?.addEventListener('click', () => {
            if (this.state.selectedAccount) {
                this.handleCopyAddress();
                // Show a brief success message
                const btn = document.getElementById('receive-copy-btn');
                if (btn) {
                    const originalText = btn.innerHTML;
                    btn.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M13.3333 4L6 11.3333L2.66667 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Copied!
                    `;
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                    }, 2000);
                }
            }
        });

        // Toggle visibility (mask balance with ***)
        document.getElementById('receive-toggle-visibility-btn')?.addEventListener('click', () => {
            this.state.receiveScreenHideBalance = !this.state.receiveScreenHideBalance;
            this.render();
        });
    }

    private isEnsName(input: string): boolean {
        // Check if input looks like an ENS name (ends with .eth or other common ENS TLDs)
        const ensPattern = /^[a-z0-9-]+\.(eth|xyz|app|luxe|kred|art|club|design|fashion|game|group|law|media|music|news|online|photo|pics|pink|racing|realestate|restaurant|shop|site|space|tech|travel|vip|website|win|wtf)$/i;
        return ensPattern.test(input.trim());
    }

    private async resolveEnsName(ensName: string): Promise<string | null> {
        try {
            const ethersModule = await loadEthers();
            const ethers = ethersModule.ethers || ethersModule.default || ethersModule;
            const provider = new ethers.JsonRpcProvider('https://mainnet.infura.io/v3/b17509e0e2ce45f48a44289ff1aa3c73');
            const resolved = await provider.resolveName(ensName);
            return resolved;
        } catch (e) {
            console.warn('[SendScreen] Failed to resolve ENS name:', e);
            return null;
        }
    }

    private attachSendScreenListeners() {
        console.log('[SendScreen] Attaching listeners...');

        // Initialize send screen state with defaults
        const defaultToken = 'ETH';
        const defaultChainId = 1; // Ethereum mainnet

        const sendScreenState: any = {
            selectedToken: defaultToken,
            selectedChainId: defaultChainId,
            resolvedRecipientAddress: null, // Store resolved address for ENS names
        };

        // Back button
        const backBtn = document.getElementById('send-back-btn');
        if (backBtn) {
            backBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.state.showSendScreen = false;
                this.render();
            };
            console.log('[SendScreen] Back button attached');
        } else {
            console.warn('[SendScreen] Back button not found');
        }

        // Toggle visibility
        const toggleBtn = document.getElementById('send-toggle-visibility-btn');
        if (toggleBtn) {
            toggleBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.state.sendScreenHideBalance = !this.state.sendScreenHideBalance;
                this.render();
            };
        }

        // Token selector - open modal
        const tokenSelector = document.getElementById('send-token-selector');
        const tokenModal = document.getElementById('send-token-modal-overlay');
        const tokenDisplay = document.getElementById('send-token-display');
        const tokenModalClose = document.getElementById('send-token-modal-close');

        if (tokenSelector && tokenModal) {
            tokenSelector.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[SendScreen] Token selector clicked - opening modal');
                tokenModal.style.display = 'flex';
            });
        }

        // Close token modal
        if (tokenModalClose) {
            tokenModalClose.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (tokenModal) {
                    tokenModal.style.display = 'none';
                }
            });
        }

        // Close token modal when clicking overlay
        if (tokenModal) {
            tokenModal.addEventListener('click', (e) => {
                if (e.target === tokenModal) {
                    tokenModal.style.display = 'none';
                }
            });
        }

        // Token selection - attach listeners after a short delay to ensure DOM is ready
        setTimeout(() => {
            const tokenOptions = document.querySelectorAll('.send-token-option');
            console.log('[SendScreen] Found token options:', tokenOptions.length);
            tokenOptions.forEach((option) => {
                option.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const token = (option as HTMLElement).getAttribute('data-token');
                    console.log('[SendScreen] Token option clicked:', token);
                    if (token) {
                        sendScreenState.selectedToken = token;
                        const asset = this.state.unifiedBalanceData?.assets.find(a => a.symbol === token);
                        const tokenAttrs = getTokenImageAttributes(token, asset?.icon || null);

                        // For Firefly accounts with ETH selected, fetch balance for selected chain if available
                        if (this.state.selectedAccount?.isFireflyAccount && token === 'ETH' && sendScreenState.selectedChainId) {
                            // Fetch balance for the selected chain
                            this.fetchFireflyBalanceForChain(sendScreenState.selectedChainId, sendScreenState).then(() => {
                                // Update balance display after fetching
                                const updatedAsset = this.state.unifiedBalanceData?.assets.find(a => a.symbol === token);
                                const tokenBalance = updatedAsset ? parseFloat(updatedAsset.balance) : 0;
                                const amountBalance = document.getElementById('send-amount-balance');
                                if (amountBalance) {
                                    amountBalance.textContent = `Balance: ${tokenBalance.toFixed(6)} ${token}`;
                                }
                            });
                        }

                        const tokenBalance = asset ? parseFloat(asset.balance) : 0;

                        if (tokenDisplay) {
                            tokenDisplay.innerHTML = `
                                ${tokenAttrs.src ? `
                                    <img src="${tokenAttrs.src}" 
                                         ${tokenAttrs.fallbacks.length > 0 ? `data-fallbacks='${JSON.stringify(tokenAttrs.fallbacks)}'` : ''}
                                         alt="${token}" 
                                         class="send-token-display-icon"
                                         onerror="if(this.dataset.fallbacks) { try { const fallbacks = JSON.parse(this.dataset.fallbacks); const currentIndex = parseInt(this.dataset.fallbackIndex || '0'); if(currentIndex < fallbacks.length) { this.src = fallbacks[currentIndex]; this.dataset.fallbackIndex = (currentIndex + 1).toString(); return; } } catch(e) {} } this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                    <div class="send-token-display-icon-fallback" style="display: none;">${token.charAt(0)}</div>
                                ` : `
                                    <div class="send-token-display-icon-fallback">${token.charAt(0)}</div>
                                `}
                                <span class="send-token-display-symbol">${token}</span>
                            `;
                        }
                        // Update balance display
                        const amountBalance = document.getElementById('send-amount-balance');
                        if (amountBalance) {
                            amountBalance.textContent = `Balance: ${tokenBalance.toFixed(6)} ${token}`;
                        }
                        // Close modal
                        if (tokenModal) {
                            tokenModal.style.display = 'none';
                        }
                        this.updateSendButtonState(sendScreenState);
                    }
                });
            });
        }, 100);

        // Chain selector - open modal
        const chainSelector = document.getElementById('send-chain-selector');
        const chainModal = document.getElementById('send-chain-modal-overlay');
        const chainDisplay = document.getElementById('send-chain-display');
        const chainModalClose = document.getElementById('send-chain-modal-close');

        if (chainSelector && chainModal) {
            chainSelector.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[SendScreen] Chain selector clicked - opening modal');
                chainModal.style.display = 'flex';
            });
        }

        // Close chain modal
        if (chainModalClose) {
            chainModalClose.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (chainModal) {
                    chainModal.style.display = 'none';
                }
            });
        }

        // Close chain modal when clicking overlay
        if (chainModal) {
            chainModal.addEventListener('click', (e) => {
                if (e.target === chainModal) {
                    chainModal.style.display = 'none';
                }
            });
        }

        // Chain selection - attach listeners after a short delay
        setTimeout(() => {
            const chainOptions = document.querySelectorAll('.send-chain-option');
            console.log('[SendScreen] Found chain options:', chainOptions.length);
            chainOptions.forEach((option) => {
                option.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const chainId = (option as HTMLElement).getAttribute('data-chain-id');
                    console.log('[SendScreen] Chain option clicked:', chainId);
                    if (chainId) {
                        sendScreenState.selectedChainId = parseInt(chainId);
                        const chainName = (option as HTMLElement).querySelector('.send-chain-option-name')?.textContent || '';
                        const chainIcon = (option as HTMLElement).querySelector('.send-chain-option-icon')?.getAttribute('src') || '';
                        if (chainDisplay) {
                            chainDisplay.innerHTML = `
                                ${chainIcon ? `
                                    <img src="${chainIcon}" alt="${chainName}" class="send-chain-display-icon">
                                ` : `
                                    <div class="send-chain-display-icon-fallback">${chainName.charAt(0)}</div>
                                `}
                                <span class="send-chain-display-name">${chainName}</span>
                            `;
                        }
                        // Close modal
                        if (chainModal) {
                            chainModal.style.display = 'none';
                        }

                        // For Firefly accounts, fetch balance for the selected chain
                        if (this.state.selectedAccount?.isFireflyAccount) {
                            this.fetchFireflyBalanceForChain(parseInt(chainId), sendScreenState);
                        }

                        this.updateSendButtonState(sendScreenState);
                    }
                });
            });
        }, 100);

        // Amount input
        const amountInput = document.getElementById('send-amount-input') as HTMLInputElement;
        const amountBalance = document.getElementById('send-amount-balance');
        const amountMaxBtn = document.getElementById('send-amount-max');

        if (amountInput) {
            amountInput.disabled = false;
            amountInput.readOnly = false;
            amountInput.addEventListener('input', () => {
                this.updateSendButtonState(sendScreenState);
            });
            console.log('[SendScreen] Amount input attached');
        } else {
            console.warn('[SendScreen] Amount input not found');
        }

        // Max button
        if (amountMaxBtn) {
            (amountMaxBtn as HTMLButtonElement).disabled = false;
            amountMaxBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (sendScreenState.selectedToken && amountInput) {
                    const asset = this.state.unifiedBalanceData?.assets.find(a => a.symbol === sendScreenState.selectedToken);
                    const balance = asset ? parseFloat(asset.balance) : 0;
                    amountInput.value = balance.toString();
                    this.updateSendButtonState(sendScreenState);
                }
            });
        }

        // Recipient input validation with ENS support
        const recipientInput = document.getElementById('send-recipient-input') as HTMLInputElement;
        const recipientError = document.getElementById('send-recipient-error');

        let ensResolveTimeout: ReturnType<typeof setTimeout> | null = null;

        if (recipientInput) {
            recipientInput.disabled = false;
            recipientInput.readOnly = false;
            recipientInput.addEventListener('input', () => {
                const input = recipientInput.value.trim();

                // Clear previous timeout
                if (ensResolveTimeout) {
                    clearTimeout(ensResolveTimeout);
                    ensResolveTimeout = null;
                }

                // Reset resolved address
                sendScreenState.resolvedRecipientAddress = null;

                if (!input) {
                    if (recipientError) {
                        recipientError.style.display = 'none';
                    }
                    this.updateSendButtonState(sendScreenState);
                    return;
                }

                // Check if it's a valid address
                if (isAddress(input)) {
                    if (recipientError) {
                        recipientError.style.display = 'none';
                    }
                    sendScreenState.resolvedRecipientAddress = getAddress(input);
                    this.updateSendButtonState(sendScreenState);
                    return;
                }

                // Check if it looks like an ENS name
                if (this.isEnsName(input)) {
                    if (recipientError) {
                        recipientError.textContent = 'Resolving ENS name...';
                        recipientError.style.display = 'block';
                        recipientError.style.color = 'var(--r-blue-default, #7084ff)';
                    }

                    // Debounce ENS resolution
                    ensResolveTimeout = setTimeout(async () => {
                        const resolved = await this.resolveEnsName(input);
                        if (resolved) {
                            sendScreenState.resolvedRecipientAddress = getAddress(resolved);
                            if (recipientError) {
                                recipientError.textContent = `Resolved: ${resolved}`;
                                recipientError.style.color = 'var(--r-green-default, #27ae60)';
                                recipientError.style.display = 'block';
                            }
                        } else {
                            sendScreenState.resolvedRecipientAddress = null;
                            if (recipientError) {
                                recipientError.textContent = 'ENS name not found';
                                recipientError.style.color = 'var(--r-red-default, #f24822)';
                                recipientError.style.display = 'block';
                            }
                        }
                        this.updateSendButtonState(sendScreenState);
                    }, 500); // 500ms debounce
                } else {
                    // Not a valid address or ENS name
                    sendScreenState.resolvedRecipientAddress = null;
                    if (recipientError) {
                        recipientError.textContent = 'Invalid address or ENS name';
                        recipientError.style.color = 'var(--r-red-default, #f24822)';
                        recipientError.style.display = 'block';
                    }
                    this.updateSendButtonState(sendScreenState);
                }
            });
            console.log('[SendScreen] Recipient input attached with ENS support');
        } else {
            console.warn('[SendScreen] Recipient input not found');
        }

        // Store references for submit handler
        (this as any)._sendScreenState = sendScreenState;

        // Initialize with default values
        setTimeout(() => {
            this.updateSendButtonState(sendScreenState);
        }, 200);

        // Submit button
        const submitBtn = document.getElementById('send-submit-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await this.handleSendSubmit();
            }, false);
        }
    }

    private async fetchFireflyBalanceForChain(chainId: number, sendState: any) {
        try {
            if (!this.state.selectedAccount?.isFireflyAccount || !this.state.selectedAccount?.address) {
                return;
            }

            console.log('[PopupApp] Fetching Firefly balance for chain:', chainId);

            // Get RPC URL for the chain
            const networks = await chrome.runtime.sendMessage({ type: 'GET_NETWORKS' });
            const network = networks.find((n: any) => n.chainId === chainId);
            if (!network || !network.rpcUrl) {
                console.warn('[PopupApp] Network not found for chainId:', chainId);
                return;
            }

            // Fetch ETH balance directly from node
            const balanceResponse = await fetch(network.rpcUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_getBalance',
                    params: [this.state.selectedAccount.address, 'latest'],
                    id: 1,
                }),
            });

            const balanceData = await balanceResponse.json();
            if (balanceData.error) {
                console.error('[PopupApp] Error fetching Firefly balance:', balanceData.error);
                return;
            }

            // Convert hex balance to ETH
            const balanceWeiHex = balanceData.result;
            const balanceWei = BigInt(balanceWeiHex);
            const balanceEth = (Number(balanceWei) / 1e18).toString();
            const balanceNumber = parseFloat(balanceEth);

            // Update balance display if ETH is selected
            if (sendState.selectedToken === 'ETH') {
                const amountBalance = document.getElementById('send-amount-balance');
                if (amountBalance) {
                    amountBalance.textContent = `Balance: ${balanceNumber.toFixed(6)} ETH`;
                }
            }

            // Update unified balance data for this chain
            if (this.state.unifiedBalanceData) {
                const ethAsset = this.state.unifiedBalanceData.assets.find(a => a.symbol === 'ETH');
                if (ethAsset) {
                    // Update the breakdown for this chain
                    if (!ethAsset.breakdown) {
                        ethAsset.breakdown = [];
                    }
                    const chainBreakdown = ethAsset.breakdown.find((b: any) => b.chain?.id === chainId);
                    if (chainBreakdown) {
                        chainBreakdown.balance = balanceEth;
                    } else {
                        // Add new breakdown entry for this chain
                        ethAsset.breakdown.push({
                            chain: {
                                id: chainId,
                                name: network.name || 'Unknown',
                                logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png?v=040',
                            },
                            balance: balanceEth,
                            balanceInFiat: 0, // Will be calculated if needed
                            contractAddress: '0x0000000000000000000000000000000000000000' as `0x${string}`,
                            decimals: 18,
                            isNative: true,
                            universe: 'mainnet' as any,
                        });
                    }
                    // Update total balance
                    ethAsset.balance = balanceEth;
                }
            }

            console.log('[PopupApp] Firefly balance fetched for chain:', chainId, 'balance:', balanceEth);
        } catch (error: any) {
            console.error('[PopupApp] Error fetching Firefly balance for chain:', error);
        }
    }

    private updateSendButtonState(state?: any) {
        const sendState = state || (this as any)._sendScreenState;
        if (!sendState) return;

        const submitBtn = document.getElementById('send-submit-btn');
        const amountInput = document.getElementById('send-amount-input') as HTMLInputElement;
        const recipientInput = document.getElementById('send-recipient-input') as HTMLInputElement;

        const hasToken = !!sendState.selectedToken;
        const hasChain = !!sendState.selectedChainId;
        const hasAmount = amountInput?.value && parseFloat(amountInput.value) > 0;
        // Check if we have a valid address (either direct input or resolved from ENS)
        const hasRecipient = recipientInput?.value && (
            isAddress(recipientInput.value.trim()) ||
            !!sendState.resolvedRecipientAddress
        );

        if (submitBtn) {
            (submitBtn as HTMLButtonElement).disabled = !(hasToken && hasChain && hasAmount && hasRecipient);
        }
    }

    private async handleSendSubmit() {
        const state = (this as any)._sendScreenState;
        if (!state) return;

        const amountInput = document.getElementById('send-amount-input') as HTMLInputElement;
        const recipientInput = document.getElementById('send-recipient-input') as HTMLInputElement;
        const errorMessage = document.getElementById('send-error-message');
        const submitBtn = document.getElementById('send-submit-btn');

        if (!state.selectedToken || !state.selectedChainId || !amountInput?.value || !recipientInput?.value) {
            return;
        }

        const amount = amountInput.value.trim();
        let recipient = recipientInput.value.trim();

        // Use resolved address if available (from ENS), otherwise use input directly
        if (state.resolvedRecipientAddress) {
            recipient = state.resolvedRecipientAddress;
        }

        // Final validation - must be a valid address
        if (!isAddress(recipient)) {
            // Try to resolve ENS one more time if it looks like an ENS name
            if (this.isEnsName(recipient)) {
                if (errorMessage) {
                    errorMessage.textContent = 'Resolving ENS name...';
                    errorMessage.style.display = 'block';
                }
                const resolved = await this.resolveEnsName(recipient);
                if (resolved) {
                    recipient = getAddress(resolved);
                } else {
                    if (errorMessage) {
                        errorMessage.textContent = 'ENS name not found or invalid recipient address';
                        errorMessage.style.display = 'block';
                    }
                    return;
                }
            } else {
                if (errorMessage) {
                    errorMessage.textContent = 'Invalid recipient address';
                    errorMessage.style.display = 'block';
                }
                return;
            }
        }

        // Normalize address
        recipient = getAddress(recipient) as `0x${string}`;

        if (parseFloat(amount) <= 0) {
            if (errorMessage) {
                errorMessage.textContent = 'Amount must be greater than 0';
                errorMessage.style.display = 'block';
            }
            return;
        }

        // Disable button and show loading
        if (submitBtn) {
            this.setButtonLoadingState('send-submit-btn', true, 'Sending...', 'Send');
        }
        if (errorMessage) {
            errorMessage.style.display = 'none';
        }

        try {
            await this.handleSendTransfer({
                token: state.selectedToken,
                amount: amount,
                recipient: recipient,
                chainId: state.selectedChainId,
            });
        } catch (error: any) {
            if (errorMessage) {
                errorMessage.textContent = error.message || 'Transfer failed';
                errorMessage.style.display = 'block';
            }
            if (submitBtn) {
                this.setButtonLoadingState('send-submit-btn', false, 'Sending...', 'Send');
            }
        }
    }

    private async handleSendTransfer(params: {
        token: string;
        amount: string;
        recipient: string;
        chainId: number;
        sourceChains?: number[];
    }): Promise<void> {
        await TransferModule.handleSendTransfer(params, this.getTransferContext());
    }

    private getTransferContext(): TransferModule.TransferContext {
        return {
            state: this.state,
            walletService: this.walletService,
            render: () => this.render(),
            showSuccessMessage: (message, hash, chainId) => this.showSuccessMessage(message, hash, chainId),
            showErrorMessage: (message) => this.showErrorMessage(message),
            loadUnifiedBalances: () => this.loadUnifiedBalances(),
            handleHaloETHTransfer: (params) => this.handleHaloETHTransfer(params),
        };
    }

    private openTransactionsScreen() {
        if (!this.state.selectedAccount) {
            this.showErrorMessage('Select an account to view transactions');
            return;
        }

        this.state.showTransactionsScreen = true;
        this.state.transactionsError = undefined;
        this.render();
        this.loadTransactions(true);
    }

    private closeTransactionsScreen() {
        this.state.showTransactionsScreen = false;
        this.render();
    }

    private async loadTransactions(reset: boolean = false) {
        const account = this.state.selectedAccount;
        if (!account) {
            this.state.transactionsError = 'No account selected';
            this.state.transactionsLoading = false;
            this.render();
            return;
        }

        const normalizedAddress = account.address.toLowerCase();
        const storedAddress = this.state.transactionsAccountAddress?.toLowerCase();
        const addressChanged = normalizedAddress !== storedAddress;

        if (reset || addressChanged) {
            this.state.transactions = [];
            this.state.transactionsOffset = 0;
            this.state.transactionsHasMore = true;
            this.state.transactionsAccountAddress = account.address;
        }

        if (!this.state.transactionsHasMore && !reset) {
            return;
        }

        const offset = reset ? 0 : this.state.transactionsOffset;
        this.state.transactionsLoading = true;
        if (reset) {
            this.state.transactionsError = undefined;
        }
        this.render();

        try {
            const { transactions } = await fetchTransactionsFromOctav({
                address: account.address,
                offset,
                limit: TRANSACTIONS_PAGE_SIZE,
                hideSpam: this.state.transactionsHideSpam,
            });
            this.state.transactions = reset ? transactions : [...this.state.transactions, ...transactions];
            this.state.transactionsOffset = offset + transactions.length;
            this.state.transactionsHasMore = transactions.length === TRANSACTIONS_PAGE_SIZE;
        } catch (error: any) {
            console.error('[Transactions] Failed to load:', error);
            this.state.transactionsError = error.message || 'Failed to load transactions';
        } finally {
            this.state.transactionsLoading = false;
            this.render();
        }
    }

    private attachTransactionsScreenListeners() {
        document.getElementById('transactions-back-btn')?.addEventListener('click', () => {
            this.closeTransactionsScreen();
        });

        document.getElementById('transactions-hide-spam')?.addEventListener('click', () => {
            this.state.transactionsHideSpam = !this.state.transactionsHideSpam;
            this.loadTransactions(true);
        });

        document.getElementById('transactions-load-more')?.addEventListener('click', () => {
            if (!this.state.transactionsLoading) {
                this.loadTransactions(false);
            }
        });

        document.getElementById('transactions-reload-btn')?.addEventListener('click', () => {
            if (!this.state.transactionsLoading) {
                this.loadTransactions(true);
            }
        });
    }

    // handleERC20Transfer is now in app-transfers.ts module

    private async handleHaloETHTransfer(params: {
        amount: string;
        recipient: string;
        chainId: number;
    }): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
        try {
            // Get selected account
            const selectedAccount = await this.walletService.getSelectedAccount();
            if (!selectedAccount || !selectedAccount.isChipAccount || !selectedAccount.chipInfo) {
                throw new Error('Halo chip account not found');
            }

            // Dynamically import ethers to avoid bundling conflicts
            const ethersModule = await loadEthers();
            const ethers = ethersModule.ethers || ethersModule.default || ethersModule;

            // Get provider
            const networks = await this.walletService.getNetworks();
            const network = networks.find(n => n.chainId === params.chainId) || networks[0];
            if (!network || !network.rpcUrl) {
                throw new Error(`Network not found for chainId ${params.chainId}`);
            }
            const provider = new ethers.JsonRpcProvider(network.rpcUrl);

            // Convert amount to wei
            const value = ethers.parseEther(params.amount);

            // Build transaction
            const transaction = {
                to: params.recipient,
                value: value.toString(),
                chainId: params.chainId,
            };

            // Estimate gas
            let gasLimit: bigint;
            try {
                const estimatedGas = await provider.estimateGas({
                    ...transaction,
                    from: selectedAccount.address,
                });
                gasLimit = (estimatedGas * BigInt(120)) / BigInt(100);
            } catch (error) {
                console.warn('[handleHaloETHTransfer] Gas estimation failed, using default:', error);
                gasLimit = BigInt(21000);
            }

            // Get gas price
            const feeData = await provider.getFeeData();
            const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice;
            const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || undefined;

            // Get nonce
            const nonce = await provider.getTransactionCount(selectedAccount.address, 'pending');

            // Build final transaction
            // For EIP-1559 transactions (with maxFeePerGas), type should be 2
            const finalTransaction: any = {
                ...transaction,
                gasLimit: gasLimit,
                maxFeePerGas: maxFeePerGas,
                maxPriorityFeePerGas: maxPriorityFeePerGas,
                nonce: nonce,
                type: maxFeePerGas ? 2 : 0, // Type 2 for EIP-1559, 0 for legacy
            };

            // Show QR code UI for Halo chip signing
            type QRCodeUI = { remove: () => void; updateStatus: (status: string) => void };
            const uiRefs: { qrCodeUI: QRCodeUI | null; removeWaiting: (() => void) | null; gate: any } = {
                qrCodeUI: null,
                removeWaiting: null,
                gate: null,
            };

            try {
                // Ensure HaloUI is available
                let HaloUIInstance = HaloUI;
                if (!HaloUIInstance) {
                    try {
                        const haloUIModule = await import('./halo-ui.js');
                        HaloUIInstance = haloUIModule.HaloUI;
                    } catch (error) {
                        console.warn('[handleHaloETHTransfer] Could not load HaloUI:', error);
                    }
                }

                // Import HaloSigner
                // Use the account address - this is what we expect the signature to recover to
                // The chipInfo should have the correct slot that corresponds to this address
                const expectedAddress = selectedAccount.address;
                const slot = selectedAccount.chipInfo.slot;

                console.log('[handleHaloETHTransfer] Signing with Halo chip:', {
                    accountAddress: expectedAddress,
                    slot: slot,
                    chipInfo: selectedAccount.chipInfo,
                });

                const { HaloSigner } = await import('../halo/halo-signer.js');
                const haloSigner = new HaloSigner(
                    expectedAddress, // This is the address we expect the signature to recover to
                    slot,
                    provider
                );

                // Sign transaction with QR code callback
                const signedTx = await haloSigner.signTransaction(finalTransaction, (pairInfo) => {
                    console.log('[handleHaloETHTransfer] Pairing started, showing QR code:', pairInfo);
                    // Show QR code when pairing starts
                    if (HaloUIInstance) {
                        uiRefs.qrCodeUI = HaloUIInstance.showQRCode(pairInfo.qrCode, pairInfo.execURL, () => {
                            // Cancel handler - could close gateway here if needed
                            console.log('[handleHaloETHTransfer] QR code cancelled');
                            if (uiRefs.qrCodeUI) {
                                uiRefs.qrCodeUI.remove();
                                uiRefs.qrCodeUI = null;
                            }
                            if (uiRefs.removeWaiting) {
                                uiRefs.removeWaiting();
                                uiRefs.removeWaiting = null;
                            }
                        });
                        if (uiRefs.qrCodeUI) {
                            uiRefs.qrCodeUI.updateStatus('Waiting for phone to scan QR code...');
                        }
                    } else {
                        console.error('[handleHaloETHTransfer] HaloUI not available, cannot show QR code');
                    }
                });

                // Wait a bit for QR code to be shown, then update status
                if (uiRefs.qrCodeUI) {
                    setTimeout(() => {
                        if (uiRefs.qrCodeUI) {
                            uiRefs.qrCodeUI.updateStatus('Phone connected! Tap your HaLo chip to your phone when prompted...');
                        }
                    }, 2000);
                }

                // Broadcast transaction
                const txResponse = await provider.broadcastTransaction(signedTx);
                const tx = ethers.Transaction.from(signedTx);
                const txHash = tx.hash || (typeof txResponse === 'string' ? txResponse : txResponse?.hash);

                // Clean up UI
                if (uiRefs.qrCodeUI) {
                    uiRefs.qrCodeUI.remove();
                    uiRefs.qrCodeUI = null;
                }
                if (uiRefs.removeWaiting) {
                    uiRefs.removeWaiting();
                    uiRefs.removeWaiting = null;
                }

                return {
                    success: true,
                    transactionHash: txHash,
                };
            } catch (error: any) {
                // Clean up UI on error
                if (uiRefs.qrCodeUI) {
                    uiRefs.qrCodeUI.remove();
                    uiRefs.qrCodeUI = null;
                }
                if (uiRefs.removeWaiting) {
                    uiRefs.removeWaiting();
                    uiRefs.removeWaiting = null;
                }
                throw error;
            }
        } catch (error: any) {
            console.error('[PopupApp] Halo ETH transfer error:', error);
            return {
                success: false,
                error: error.message || 'Halo ETH transfer failed',
            };
        }
    }

    private async handleCreateAccountConfirm(name?: string) {
        try {
            this.hideCreateAccountForm();

            // If no password is set, prompt to set one
            if (!this.state.hasPassword) {
                const password = prompt('Set a password for your wallet (minimum 8 characters):');
                if (!password || password.length < 8) {
                    this.showErrorMessage('Password must be at least 8 characters long');
                    return;
                }

                const { setPassword } = await import('../core/password.js');
                await setPassword(password);
                this.state.hasPassword = true;
            }

            await this.walletService.createAccount(name);
            this.state.unlocked = true;
            await this.loadAccounts();
            this.render();
            this.showSuccessMessage('Account created successfully!');
        } catch (error: any) {
            this.showErrorMessage('Failed to create account: ' + (error.message || 'Unknown error'));
        }
    }

    private async handleImportAccountConfirm(privateKey: string, name?: string) {
        try {
            if (!privateKey || !privateKey.trim()) {
                this.showErrorMessage('Private key is required');
                return;
            }
            this.hideImportAccountForm();
            await this.walletService.importAccount(privateKey, name);
            this.state.unlocked = true;
            await this.loadAccounts();
            this.render();
            this.showSuccessMessage('Account imported successfully!');
        } catch (error: any) {
            this.showErrorMessage('Failed to import account: ' + (error.message || 'Unknown error'));
        }
    }

    private showSuccessMessage(message: string, transactionHash?: string, chainId?: number) {
        UIModule.showSuccessMessage(message, transactionHash, chainId, { state: this.state });
    }

    private getEtherscanUrl(chainId: number, txHash: string): string {
        return UIModule.getEtherscanUrl(chainId, txHash);
    }

    private showErrorMessage(message: string) {
        UIModule.showErrorMessage(message);
    }

    private showAccountSelector() {
        ModalModule.showAccountSelector(this.getModalContext());
    }

    private hideAccountSelector() {
        ModalModule.hideAccountSelector(this.getModalContext());
    }

    private getModalContext(): ModalModule.ModalContext {
        return {
            state: this.state,
            render: () => this.render(),
        };
    }

    private async handleSelectAccount(account: any) {
        await this.walletService.selectAccount(account.address);
        this.state.selectedAccount = account;
        this.hideAccountSelector();

        // Immediately clear previous balance data to avoid showing stale data
        this.state.balance = '0.00';
        this.state.unifiedBalanceData = {
            totalBalanceUSD: 0,
            assets: [],
            loading: true,
        };
        this.state.unifiedBalanceLoading = true;

        // Clear unified balance cache for the previous account
        unifiedBalanceService.clearCache();

        this.render(); // Render immediately with cleared data

        // Clear portfolio data for previous account
        this.state.portfolioData = null;
        this.state.portfolioLoading = false;
        this.state.defiSelectedChainId = null;

        // Reinitialize unified balance for the new account
        await this.initializeUnifiedBalance(account);
        
        // Load portfolio data for DeFi positions
        await this.loadPortfolioData();

        await this.loadAccounts();

        // Update all connected dapp connections to use the new account
        await this.syncWalletWithConnectedDapps(account.address);

        await this.loadConnectedDApp(); // Reload connected DApp in case account changed
        this.render();
    }

    private async syncWalletWithConnectedDapps(newAccountAddress: string) {
        try {
            // Get all connected dapps
            const connections = await chrome.storage.local.get('dapp_connections');
            const dappConnections = connections.dapp_connections || {};

            // Update all connections to use the new account
            const updatedConnections: any = {};
            for (const [origin, connection] of Object.entries(dappConnections)) {
                updatedConnections[origin] = {
                    ...(connection as any),
                    account: newAccountAddress,
                };
            }

            // Save updated connections
            await chrome.storage.local.set({ dapp_connections: updatedConnections });

            // Notify background script to broadcast account change to all connected dapps
            await chrome.runtime.sendMessage({
                type: 'ACCOUNT_CHANGED',
                account: newAccountAddress,
            });
        } catch (error: any) {
            console.error('Error syncing wallet with connected dapps:', error);
        }
    }

    private async handleCopyAddress() {
        if (this.state.selectedAccount) {
            try {
                // Convert to checksum address like the clone does
                const checksumAddress = getAddress(this.state.selectedAccount.address);
                await navigator.clipboard.writeText(checksumAddress);

                // Show toast notification (same as Account Created)
                this.showSuccessMessage('Copied');
            } catch (error: any) {
                console.error('Failed to copy address:', error);
                this.showErrorMessage('Failed to copy address');
            }
        }
    }

    private showAddWalletModal() {
        ModalModule.showAddWalletModal(this.getModalContext());
    }

    private hideAddWalletModal() {
        ModalModule.hideAddWalletModal(this.getModalContext());
    }

    private handleAddWalletOption(optionId: string) {
        this.hideAddWalletModal();

        if (optionId === 'create-account') {
            this.showCreateAccountForm();
        } else if (optionId === 'import-private-key') {
            this.showImportAccountForm();
        } else if (optionId === 'add-halo-chip') {
            this.showHaloChipNameForm();
        } else if (optionId === 'add-firefly-wallet') {
            this.showFireflyNameForm();
        } else if (optionId === 'create-multisig') {
            this.showCreateMultisigForm();
        } else if (optionId === 'add-contact') {
            this.showAddContactModal();
        }
    }

    private showCreateAccountForm() {
        ModalModule.showCreateAccountForm(this.getModalContext());
    }

    private hideCreateAccountForm() {
        ModalModule.hideCreateAccountForm(this.getModalContext());
    }

    private showImportAccountForm() {
        ModalModule.showImportAccountForm(this.getModalContext());
    }

    private hideImportAccountForm() {
        ModalModule.hideImportAccountForm(this.getModalContext());
    }

    private showCreateMultisigForm() {
        ModalModule.showCreateMultisigForm(this.getModalContext());
    }

    private hideCreateMultisigForm() {
        ModalModule.hideCreateMultisigForm(this.getModalContext());
    }

    private showHaloChipNameForm() {
        ModalModule.showHaloChipNameForm(this.getModalContext());
    }

    private hideHaloChipNameForm() {
        ModalModule.hideHaloChipNameForm(this.getModalContext());
    }

    private showFireflyNameForm() {
        ModalModule.showFireflyNameForm(this.getModalContext());
    }

    private hideFireflyNameForm() {
        ModalModule.hideFireflyNameForm(this.getModalContext());
    }

    private showAddContactModal() {
        ModalModule.showAddContactModal(this.getModalContext());
        this.attachContactModalListeners();
    }

    private hideAddContactModal() {
        ModalModule.hideAddContactModal(this.getModalContext());
    }

    private async handleAddContactConfirm(address: string, name?: string) {
        try {
            if (!address || !address.trim()) {
                this.showErrorMessage('Please enter an address or ENS name');
                return;
            }

            this.hideAddContactModal();

            const response = await chrome.runtime.sendMessage({
                type: 'ADD_WATCH_ADDRESS',
                address: address.trim(),
                name: name?.trim(),
            });

            if (response.success) {
                await this.loadAccounts();
                this.render();
                this.showSuccessMessage(`✅ Contact added! Address: ${formatAddress(response.account.address)}`);
            } else {
                this.showErrorMessage(response.error || 'Failed to add contact');
            }
        } catch (error: any) {
            console.error('Error adding contact:', error);
            this.showErrorMessage('Failed to add contact: ' + (error.message || 'Unknown error'));
        }
    }

    private attachContactModalListeners() {
        setTimeout(() => {
            const overlay = document.getElementById('add-contact-overlay');
            const closeBtn = document.getElementById('add-contact-close');
            const confirmBtn = document.getElementById('add-contact-confirm-btn');
            const addressInput = document.getElementById('contact-address-input') as HTMLTextAreaElement;
            const ensResult = document.getElementById('contact-ens-result');
            const errorDiv = document.getElementById('contact-error');

            const handleClose = () => {
                this.hideAddContactModal();
            };

            const handleConfirm = async () => {
                let address = addressInput?.value?.trim() || '';
                const nameInput = document.getElementById('contact-name-input') as HTMLInputElement;
                const name = nameInput?.value?.trim() || undefined;

                if (!address) {
                    if (errorDiv) {
                        errorDiv.textContent = 'Please enter an address or ENS name';
                        errorDiv.style.display = 'block';
                    }
                    return;
                }

                // If it's an ENS name and we haven't resolved it yet, try to resolve it first
                if (!isAddress(address) && this.isEnsName(address)) {
                    try {
                        const ethersModule = await loadEthers();
                        const ethers = ethersModule.ethers || ethersModule.default || ethersModule;
                        const provider = new ethers.JsonRpcProvider('https://mainnet.infura.io/v3/b17509e0e2ce45f48a44289ff1aa3c73');
                        const resolved = await provider.resolveName(address);
                        if (resolved) {
                            address = resolved; // Use the resolved address
                        }
                    } catch (e) {
                        // If resolution fails, let the wallet method handle the error
                        console.warn('[ContactModal] Failed to pre-resolve ENS:', e);
                    }
                }

                await this.handleAddContactConfirm(address, name);
            };

            const handleAddressChange = async () => {
                const address = addressInput?.value?.trim() || '';
                if (!ensResult || !errorDiv) return;

                errorDiv.style.display = 'none';
                ensResult.style.display = 'none';

                if (!address) return;

                // Check if it's a valid address
                if (isAddress(address)) {
                    return;
                }

                // Try to resolve ENS
                try {
                    const ethersModule = await loadEthers();
                    const ethers = ethersModule.ethers || ethersModule.default || ethersModule;
                    const provider = new ethers.JsonRpcProvider('https://mainnet.infura.io/v3/b17509e0e2ce45f48a44289ff1aa3c73');
                    const resolved = await provider.resolveName(address);
                    if (resolved && ensResult) {
                        ensResult.innerHTML = `
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span>${resolved}</span>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" style="cursor: pointer;">
                                    <path d="M6 4L10 8L6 12" stroke-width="2" stroke-linecap="round"/>
                                </svg>
                            </div>
                        `;
                        ensResult.style.display = 'block';
                        ensResult.onclick = () => {
                            if (addressInput) {
                                addressInput.value = resolved;
                                ensResult!.style.display = 'none';
                            }
                        };
                    }
                } catch (e) {
                    // Not a valid ENS or address, ignore
                }
            };

            overlay?.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    handleClose();
                }
            });

            closeBtn?.addEventListener('click', handleClose);
            confirmBtn?.addEventListener('click', handleConfirm);
            addressInput?.addEventListener('input', handleAddressChange);
            addressInput?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleConfirm();
                }
            });
        }, 100);
    }

    private async handleHaloChipNameConfirm(name?: string) {
        try {
            this.hideHaloChipNameForm();

            const result = await this.haloService.addChipAccount(name);

            await this.loadAccounts();
            this.state.unlocked = true;
            this.render();

            this.showSuccessMessage('✅ HaLo Chip Account Added! Address: ' + formatAddress(result.chipAddress));
        } catch (error: any) {
            this.showErrorMessage('Failed to add chip account: ' + (error.message || 'Unknown error'));
        }
    }

    private async handleFireflyNameConfirm(name?: string) {
        try {
            this.hideFireflyNameForm();

            const result = await this.fireflyService.addFireflyAccount(name);

            await this.loadAccounts();
            this.state.unlocked = true;
            this.render();

            this.showSuccessMessage('✅ Firefly Wallet Added! Address: ' + formatAddress(result.fireflyAddress));
        } catch (error: any) {
            this.showErrorMessage('Failed to add Firefly wallet: ' + (error.message || 'Unknown error'));
        }
    }

    private async handleCreateMultisigConfirm(numChips: number, threshold: number, name?: string) {
        try {
            this.hideCreateMultisigForm();

            // Check if we're in expanded view and doing 2/2 multisig
            const isExpanded = window.location.pathname.includes('expanded.html');
            const isTwoTwoMultisig = numChips === 2 && threshold === 2;

            if (isExpanded && isTwoTwoMultisig) {
                // Use parallel scanning in expanded view
                await this.handleParallelMultisigScan(numChips, threshold, name);
            } else {
                // Use sequential scanning (original flow)
                const response = await this.haloService.createMultisigAccount(numChips, threshold, name);

                await this.loadAccounts();
                this.state.unlocked = true;
                this.render();

                // Step 2: Deploy multisig contract using first chip
                // Get current chain ID
                const selectedAccount = await this.walletService.getSelectedAccount();
                const chainId = selectedAccount?.chainId || this.state.selectedAccount?.chainId || 1;

                try {
                    // Show deployment progress
                    this.showSuccessMessage('Deploying multisig contract... Please scan first Halo chip.');

                    // Deploy multisig contract (will prompt for chip scan)
                    // Factory address will be retrieved from config
                    const deployment = await multisigService.deployMultisig(
                        response.account,
                        null, // Will use factory address from config
                        chainId
                    );

                    // Update account to mark as deployed
                    await this.loadAccounts();
                    this.render();

                    // Show success with transaction hash immediately after broadcast
                    this.showSuccessMessage(
                        `✅ Multisig deployment submitted! Address: ${formatAddress(deployment.address)}`,
                        deployment.txHash,
                        chainId
                    );
                } catch (deployError: any) {
                    // Account was created but deployment failed
                    console.error('Multisig deployment failed:', deployError);
                    this.showErrorMessage(
                        `Multisig account created but deployment failed: ${deployError.message}. ` +
                        `You can deploy it later from the account details.`
                    );
                }
            }
        } catch (error: any) {
            this.showErrorMessage('Failed to create multisig account: ' + (error.message || 'Unknown error'));
        }
    }

    private async handleParallelMultisigScan(numChips: number, threshold: number, name?: string) {
        // Initialize parallel scan state
        this.state.parallelScanState = {
            chip1: { status: 'pending' },
            chip2: { status: 'pending' },
        };
        this.state.showParallelMultisigScan = true;
        this.render();

        try {
            // Start both gateways in parallel
            const { LibHaLoAdapter } = await import('../halo/libhalo-adapter.js');

            // Start chip 1 scanning
            const chip1Promise = this.scanChipParallel(1, LibHaLoAdapter);

            // Start chip 2 scanning
            const chip2Promise = this.scanChipParallel(2, LibHaLoAdapter);

            // Wait for both chips to be scanned
            const [chip1Info, chip2Info] = await Promise.all([chip1Promise, chip2Promise]);

            // Both chips scanned, create multisig account
            const chips = [chip1Info, chip2Info];
            const response = await chrome.runtime.sendMessage({
                type: 'CREATE_MULTISIG_ACCOUNT',
                chips: chips,
                threshold: threshold,
                name: name || undefined,
            });

            if (!response || !response.success) {
                throw new Error(response?.error || 'Failed to create multisig account');
            }

            await this.loadAccounts();
            this.state.unlocked = true;

            // Deploy multisig using gas station
            const selectedAccount = await this.walletService.getSelectedAccount();
            const chainId = selectedAccount?.chainId || this.state.selectedAccount?.chainId || 1;

            // Update UI to show deploying
            this.state.parallelScanState!.chip1.status = 'done';
            this.state.parallelScanState!.chip2.status = 'done';
            this.render();

            // Deploy using gas station
            const deployment = await this.deployMultisigWithGasStation(response.account, chainId);

            // Update UI with deployment transaction
            if (this.state.parallelScanState) {
                this.state.parallelScanState.deploymentTx = {
                    hash: deployment.txHash,
                    address: deployment.address,
                    chainId: chainId,
                };
                this.render();

                // Wait 5 seconds to let user see the transaction hash
                await new Promise(resolve => setTimeout(resolve, 5000));
            }

            // Hide parallel scan UI
            this.state.showParallelMultisigScan = false;
            this.state.parallelScanState = undefined;
            this.render();

            // Show success with transaction hash immediately after broadcast
            this.showSuccessMessage(
                `✅ Multisig deployment submitted! Address: ${formatAddress(deployment.address)}`,
                deployment.txHash,
                chainId
            );
        } catch (error: any) {
            console.error('Parallel multisig scan error:', error);
            this.showErrorMessage('Failed to create multisig: ' + (error.message || 'Unknown error'));
            this.state.showParallelMultisigScan = false;
            this.state.parallelScanState = undefined;
            this.render();
        }
    }

    private async scanChipParallel(chipNumber: 1 | 2, LibHaLoAdapter: any): Promise<any> {
        const chipKey = chipNumber === 1 ? 'chip1' : 'chip2';

        try {
            // Update status to scanning
            if (this.state.parallelScanState) {
                this.state.parallelScanState[chipKey].status = 'scanning';
                this.render();
            }

            // Create gateway
            const gate = await LibHaLoAdapter.createGateway();
            if (!gate) {
                throw new Error(`Failed to initialize HaLo Gateway for chip ${chipNumber}`);
            }

            // Store gate for cleanup
            if (this.state.parallelScanState) {
                this.state.parallelScanState[chipKey].gate = gate;
            }

            // Start pairing to get QR code
            const pairInfo = await gate.startPairing();

            // Update UI with QR code
            if (this.state.parallelScanState) {
                this.state.parallelScanState[chipKey].qrCode = pairInfo.qrCode;
                this.state.parallelScanState[chipKey].execURL = pairInfo.execURL;
                this.render();
            }

            // Wait for phone to connect
            await gate.waitConnected();

            // Update status to connected
            if (this.state.parallelScanState) {
                this.state.parallelScanState[chipKey].status = 'connected';
                this.render();
            }

            // Get key info from chip
            const result = await gate.execHaloCmd({
                name: 'get_key_info',
                keyNo: 1,
            });

            await gate.close();

            // Derive address from public key
            const publicKey = result.publicKey;
            const { loadEthers } = await import('./ethers-loader');
            const ethersModule = await loadEthers();
            const ethers = ethersModule.ethers || ethersModule.default || ethersModule;
            const chipAddress = result.address || ethers.computeAddress('0x' + publicKey);

            const chipInfo = {
                address: chipAddress.toLowerCase(),
                publicKey: publicKey,
                slot: 1,
                name: `Chip ${chipNumber}`,
                linkedAt: Date.now(),
            };

            // Update status to done
            if (this.state.parallelScanState) {
                this.state.parallelScanState[chipKey].status = 'done';
                this.state.parallelScanState[chipKey].chipInfo = chipInfo;
                this.render();
            }

            return chipInfo;
        } catch (error: any) {
            // Update status to error
            if (this.state.parallelScanState) {
                this.state.parallelScanState[chipKey].status = 'error';
                this.render();
            }
            throw error;
        }
    }

    private async deployMultisigWithGasStation(account: any, chainId: number): Promise<{ address: string; txHash: string }> {
        const { getGasStationSigner, isGasStationConfigured } = await import('../core/gas-station.js');

        if (!(await isGasStationConfigured())) {
            throw new Error('Gas station not configured. Please configure the gas station private key.');
        }

        const { getMultisigFactoryAddress } = await import('../core/multisig-config.js');
        const factoryAddress = getMultisigFactoryAddress(chainId);

        // Get network RPC URL
        const networks = await chrome.runtime.sendMessage({ type: 'GET_NETWORKS' });
        const networksArray = networks && networks.success ? networks.networks : [];
        const network = networksArray.find((n: any) => n.chainId === chainId);
        if (!network || !network.rpcUrl) {
            throw new Error(`Network not found for chainId ${chainId}`);
        }

        const { loadEthers } = await import('./ethers-loader');
        const ethersModule = await loadEthers();
        const ethers = ethersModule.ethers || ethersModule.default || ethersModule;
        const provider = new ethers.JsonRpcProvider(network.rpcUrl);

        // Get gas station signer
        const gasStationSigner = await getGasStationSigner(provider);

        // Normalize and sort owner addresses
        const chips = account.multisig.chips;
        const threshold = account.multisig.threshold;
        const owners = chips.map((c: any) => ethers.getAddress(c.address)).sort();

        // Create salt with randomness to ensure unique address each time
        // This prevents CREATE2 reverts when trying to deploy the same multisig multiple times
        const randomSalt = ethers.hexlify(ethers.randomBytes(32));
        const salt = ethers.keccak256(
            ethers.toUtf8Bytes(owners.join('') + threshold.toString() + randomSalt)
        );
        console.log('[deployMultisig] Using random salt:', salt);

        // Deploy via factory using gas station
        const FACTORY_ABI = [
            'function createMultisig(address[] calldata owners, uint256 threshold, bytes32 salt) external returns (address)',
            'function computeAddress(address[] calldata owners, uint256 threshold, bytes32 salt) external view returns (address)',
            'event MultisigCreated(address indexed multisig, address[] owners, uint256 threshold)',
        ];

        const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, gasStationSigner);
        const data = factory.interface.encodeFunctionData('createMultisig', [owners, threshold, salt]);

        // Get gas price (skip gas estimation and use hardcoded 2M gas limit)
        const feeData = await provider.getFeeData();

        // Use hardcoded gas limit of 2,000,000 instead of estimating
        // This is enough for successful deployment (~300k), but won't waste too much on reverts
        const gasLimit = BigInt(2000000);
        console.log('[deployMultisig] Using hardcoded gas limit:', gasLimit.toString());

        const transaction = {
            to: factoryAddress,
            data: data,
            value: '0x0',
            gasLimit: gasLimit,
            maxFeePerGas: feeData.maxFeePerGas?.toString(),
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
            chainId: chainId,
            nonce: await provider.getTransactionCount(await gasStationSigner.getAddress(), 'pending'),
        };

        // Send transaction
        const txResponse = await gasStationSigner.sendTransaction(transaction);
        const transactionHash = txResponse.hash;

        // Compute expected address (will be confirmed when transaction is mined)
        const factoryContract = new ethers.Contract(factoryAddress, FACTORY_ABI, provider);
        const expectedAddress = await factoryContract.computeAddress(owners, threshold, salt);

        // Return transaction hash immediately, then wait for confirmation in background
        // This allows UI to show the transaction right away
        (async () => {
            try {
                // Wait for transaction receipt in background
                const receipt = await provider.waitForTransaction(transactionHash, 1);

                if (!receipt || receipt.status !== 1) {
                    console.error('[PopupApp] Deployment transaction failed:', transactionHash);
                    return;
                }

                // Extract deployed address from event
                const factoryInterface = new ethers.Interface(FACTORY_ABI);
                const event = receipt.logs.find((log: any) => {
                    try {
                        const parsed = factoryInterface.parseLog(log);
                        return parsed?.name === 'MultisigCreated';
                    } catch {
                        return false;
                    }
                });

                if (!event) {
                    console.error('[PopupApp] Failed to find MultisigCreated event');
                    return;
                }

                const parsedEvent = factoryInterface.parseLog(event);
                const deployedAddress = parsedEvent?.args[0];

                // Update account to mark as deployed
                await chrome.runtime.sendMessage({
                    type: 'UPDATE_MULTISIG_DEPLOYED',
                    address: account.address,
                    deployedAddress: deployedAddress,
                    chainId: chainId,
                });
            } catch (error) {
                console.error('[PopupApp] Error waiting for deployment confirmation:', error);
            }
        })();

        // Return immediately with transaction hash (address will be updated later)
        return {
            address: expectedAddress, // Use computed address (will be confirmed when mined)
            txHash: transactionHash,
        };
    }

    private cancelParallelMultisigScan() {
        // Cleanup gates
        if (this.state.parallelScanState) {
            if (this.state.parallelScanState.chip1.gate) {
                try {
                    this.state.parallelScanState.chip1.gate.close();
                } catch (e) {
                    console.error('Error closing chip1 gate:', e);
                }
            }
            if (this.state.parallelScanState.chip2.gate) {
                try {
                    this.state.parallelScanState.chip2.gate.close();
                } catch (e) {
                    console.error('Error closing chip2 gate:', e);
                }
            }
        }

        this.state.showParallelMultisigScan = false;
        this.state.parallelScanState = undefined;
        this.render();
    }

    private attachParallelScanListeners() {
        setTimeout(() => {
            const cancelBtn = document.getElementById('parallel-scan-cancel');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    this.cancelParallelMultisigScan();
                });
            }
        }, 50);
    }

    private async handleLinkHalo() {
        try {
            if (!this.state.selectedAccount) {
                this.showErrorMessage('Please select an account first');
                return;
            }

            // Show security confirmation modal
            this.state.showSecurityConfirm = true;
            this.render();
        } catch (error: any) {
            this.showErrorMessage('Failed to link account: ' + (error.message || 'Unknown error'));
        }
    }

    private showSecurityConfirm() {
        ModalModule.showSecurityConfirm(this.getModalContext());
    }

    private hideSecurityConfirm() {
        ModalModule.hideSecurityConfirm(this.getModalContext());
    }

    private async handleSecurityConfirm(deleteKey: boolean) {
        try {
            this.hideSecurityConfirm();

            if (!this.state.selectedAccount) {
                this.showErrorMessage('Please select an account first');
                return;
            }

            const response = await this.haloService.linkAccount(
                this.state.selectedAccount.address,
                deleteKey
            );

            await this.loadAccounts();
            this.render();

            const message = response.privateKeyDeleted
                ? '✅ Account secured with HaLo chip! Private key deleted.'
                : '✅ Account linked to HaLo chip!';

            this.showSuccessMessage(message);
        } catch (error: any) {
            this.showErrorMessage('Failed to link account: ' + (error.message || 'Unknown error'));
        }
    }

    private handleToggleSidebar() {
        this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
        this.render();
    }

    private handleSettings() {
        // Show settings slide-up menu
        this.state.showSettingsMenu = true;
        this.render();
    }

    private hideSettingsMenu() {
        ModalModule.hideSettingsMenu(this.getModalContext());
    }

    async handleLockWallet() {
        try {
            await this.walletService.lock();
            this.state.unlocked = false;
            this.state.password = '';
            this.render();
        } catch (error: any) {
            console.error('Error locking wallet:', error);
            this.showErrorMessage('Failed to lock wallet');
        }
    }

    async handleChangePassword() {
        if (!this.state.hasPassword) {
            // Set password for the first time
            const newPassword = prompt('Set a password for your wallet (minimum 8 characters):');
            if (!newPassword || newPassword.length < 8) {
                this.showErrorMessage('Password must be at least 8 characters long');
                return;
            }

            const confirmPassword = prompt('Confirm password:');
            if (newPassword !== confirmPassword) {
                this.showErrorMessage('Passwords do not match');
                return;
            }

            try {
                const { setPassword } = await import('../core/password.js');
                await setPassword(newPassword);
                this.state.hasPassword = true;
                this.showSuccessMessage('Password set successfully');
            } catch (error: any) {
                this.showErrorMessage('Failed to set password: ' + (error.message || 'Unknown error'));
            }
        } else {
            // Change existing password
            const oldPassword = prompt('Enter current password:');
            if (!oldPassword) return;

            // Verify old password
            const { verifyPassword } = await import('../core/password.js');
            const isValid = await verifyPassword(oldPassword);
            if (!isValid) {
                this.showErrorMessage('Incorrect password');
                return;
            }

            const newPassword = prompt('Enter new password (minimum 8 characters):');
            if (!newPassword || newPassword.length < 8) {
                this.showErrorMessage('Password must be at least 8 characters long');
                return;
            }

            const confirmPassword = prompt('Confirm new password:');
            if (newPassword !== confirmPassword) {
                this.showErrorMessage('Passwords do not match');
                return;
            }

            try {
                const { setPassword } = await import('../core/password.js');
                await setPassword(newPassword);
                this.showSuccessMessage('Password changed successfully');
            } catch (error: any) {
                this.showErrorMessage('Failed to change password: ' + (error.message || 'Unknown error'));
            }
        }
    }

    private async handleExpand() {
        try {
            // Open expanded view in a new tab
            const expandedUrl = chrome.runtime.getURL('popup/expanded.html');
            await chrome.tabs.create({
                url: expandedUrl,
                active: true
            });
            // Optionally close the popup
            window.close();
        } catch (error: any) {
            console.error('Failed to open expanded view:', error);
            this.showErrorMessage('Failed to open expanded view: ' + (error.message || 'Unknown error'));
        }
    }

    private getTransactionsForAccount(account?: any): Transaction[] {
        // TODO: Load actual transactions from blockchain
        // For now, return empty array or mock data
        if (!account) return [];

        // Mock transactions - replace with actual data fetching
        return [];
    }

    async handleDisconnectDApp(origin?: string) {
        try {
            const targetOrigin = origin || this.state.connectedDApp?.origin;
            if (!targetOrigin) return;

            // Remove from storage
            const connections = await chrome.storage.local.get('dapp_connections');
            const dappConnections = connections.dapp_connections || {};
            delete dappConnections[targetOrigin];
            await chrome.storage.local.set({ dapp_connections: dappConnections });

            // Reload connected DApp
            await this.loadConnectedDApp();
            this.render();

            this.showSuccessMessage('DApp disconnected');
        } catch (error: any) {
            console.error('Error disconnecting DApp:', error);
            this.showErrorMessage('Failed to disconnect DApp');
        }
    }

    handleChainChange() {
        this.state.showNetworkSelector = true;
        this.render();
        // Listeners will be attached in attachListeners() via setTimeout
    }

    hideNetworkSelector() {
        ModalModule.hideNetworkSelector(this.getModalContext());
    }

    async handleSelectNetwork(chainId: number) {
        try {
            const { WalletService } = await import('./services/wallet-service.js');
            const walletService = new WalletService();
            await walletService.switchNetwork(chainId);

            // Update local state
            this.state.selectedNetwork = chainId;

            // IMPORTANT: Reset delegation status when switching networks
            // Delegation is network-specific, so we need to re-check on the new network
            this.state.delegationStatus = null;
            this.state.delegationStatusAddress = null;

            this.hideNetworkSelector();

            // Reload data for new network
            await this.loadAccounts();
            await this.loadUnifiedBalances();

            // Re-check delegation status on the new network if modal is open
            if (this.state.showEip7702Modal && this.state.eip7702ModalAccountAddress) {
                console.log('[handleSelectNetwork] Re-checking delegation on new network:', chainId);
                this.checkDelegationStatus(this.state.eip7702ModalAccountAddress);
            } else if (this.state.showAccountDetailModal && this.state.accountToEdit) {
                console.log('[handleSelectNetwork] Re-checking delegation on new network:', chainId);
                this.checkDelegationStatus(this.state.accountToEdit.address);
            }

            // Update delegation modal if it's open to reflect new network
            if (this.state.showDelegationModal) {
                // For Zircuit, reset to Zircuit delegator address
                if (chainId === 48900 && this.state.delegationModalIsUpgrade) {
                    this.state.delegationContractAddress = this.getDefaultDelegatorAddress(48900);
                }
                this.updateDelegationModal();
            }

            this.showSuccessMessage('Network switched successfully');
        } catch (error: any) {
            console.error('Error switching network:', error);
            this.showErrorMessage(error.message || 'Failed to switch network');
        }
    }

    attachNetworkSelectorListeners() {
        // Close button
        const closeBtn = document.getElementById('network-selector-close');
        if (closeBtn) {
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.hideNetworkSelector();
            };
        }

        // Overlay click
        const overlay = document.getElementById('network-selector-overlay');
        if (overlay) {
            overlay.onclick = (e) => {
                if (e.target === e.currentTarget) {
                    this.hideNetworkSelector();
                }
            };
        }

        // Network option clicks - use event delegation on the modal container
        const modal = document.querySelector('.network-selector-modal') as HTMLElement | null;
        if (modal) {
            modal.onclick = (e) => {
                const target = e.target as HTMLElement;
                const networkOption = target.closest('.network-option');
                if (networkOption) {
                    e.stopPropagation();
                    const chainId = parseInt(networkOption.getAttribute('data-chain-id') || '1');
                    this.handleSelectNetwork(chainId);
                }
            };
        }
    }

    handleDeleteAccount(account: any) {
        // Check if this is the last account
        if (this.state.accounts.length <= 1) {
            this.showErrorMessage('Cannot delete the last account');
            return;
        }

        // Show delete confirmation modal
        this.state.accountToDelete = account;
        this.state.showDeleteAccountModal = true;
        this.render();
        // Update button state after modal is rendered
        setTimeout(() => {
            const updateDeleteConfirmButton = () => {
                const checkbox1 = document.getElementById('delete-confirm-1') as HTMLInputElement;
                const checkbox2 = document.getElementById('delete-confirm-2') as HTMLInputElement;
                const passwordInput = document.getElementById('delete-account-password') as HTMLInputElement;
                const confirmBtn = document.getElementById('delete-account-confirm') as HTMLButtonElement;

                if (confirmBtn) {
                    const isEnabled = checkbox1?.checked && checkbox2?.checked && passwordInput?.value?.trim().length > 0;
                    confirmBtn.disabled = !isEnabled;
                    confirmBtn.style.opacity = isEnabled ? '1' : '0.5';
                    confirmBtn.style.cursor = isEnabled ? 'pointer' : 'not-allowed';
                }
            };
            updateDeleteConfirmButton();
        }, 100);
    }

    hideDeleteAccountModal() {
        ModalModule.hideDeleteAccountModal(this.getModalContext());
    }

    private handleEditAccount(account: any) {
        // Check if modal already exists and if it's the same account (to avoid re-animation)
        const modalExists = document.getElementById('account-detail-overlay') !== null;
        const isSameAccount = this.state.accountToEdit?.address?.toLowerCase() === account.address?.toLowerCase();

        this.state.accountToEdit = account;
        this.state.delegationTargetAddress = account.address;
        this.state.showAccountDetailModal = true;
        // Only animate on first render or when switching to a different account
        this.state.accountDetailModalFirstRender = !modalExists || !isSameAccount;
        this.hideAccountSelector();

        // Render the modal (or update if already exists)
        this.render();

        // Mark that we've rendered once
        if (this.state.accountDetailModalFirstRender) {
            setTimeout(() => {
                this.state.accountDetailModalFirstRender = false;
            }, 350); // After animation completes
        } else {
            this.state.accountDetailModalFirstRender = false;
        }

        // Attach listeners after render completes
        setTimeout(() => {
            this.attachAccountDetailListeners();
            // Check delegation status if not a watch-only account (after modal is rendered)
            if (!account.isWatchOnly) {
                this.checkDelegationStatus(account.address);
            }
        }, 100);
    }

    private hideAccountDetailModal() {
        ModalModule.hideAccountDetailModal(this.getModalContext());
    }

    private async handleUpdateAccountName(address: string, name: string) {
        try {
            if (!name || !name.trim()) {
                this.showErrorMessage('Name cannot be empty');
                return;
            }

            const response = await chrome.runtime.sendMessage({
                type: 'UPDATE_ACCOUNT_NAME',
                address: address,
                name: name.trim(),
            });

            if (response.success) {
                await this.loadAccounts();
                this.hideAccountDetailModal(); // Close the modal after successful update
                this.render();
                this.showSuccessMessage('Account name updated successfully');
            } else {
                this.showErrorMessage(response.error || 'Failed to update account name');
            }
        } catch (error: any) {
            console.error('Error updating account name:', error);
            this.showErrorMessage('Failed to update account name: ' + (error.message || 'Unknown error'));
        }
    }

    private handleExportPrivateKey(address: string) {
        // Check if account detail modal is showing - if so, keep it visible in background
        const accountDetailModalShowing = this.state.showAccountDetailModal ||
            document.getElementById('account-detail-overlay') !== null;

        // Show password modal without animation if transitioning from account detail modal
        // DO NOT hide the account detail modal - keep it in background
        this.state.passwordModalConfig = {
            title: 'Export Private Key',
            message: 'Enter your password to export the private key. Make sure you are in a secure location.',
            onConfirm: async (password: string) => {
                await this.doExportPrivateKey(address, password);
            },
        };
        this.state.showPasswordModal = true;
        // Don't animate if we're transitioning from account detail modal
        this.state.passwordModalFirstRender = !accountDetailModalShowing;
        this.render();
        // Mark that we've rendered once
        if (!accountDetailModalShowing) {
            setTimeout(() => {
                this.state.passwordModalFirstRender = false;
            }, 350); // After animation completes
        } else {
            this.state.passwordModalFirstRender = false;
        }
        this.attachPasswordModalListeners();
    }

    private async doExportPrivateKey(address: string, password: string) {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'EXPORT_PRIVATE_KEY',
                address: address,
                password: password,
            });

            if (response.success) {
                // Show private key in a modal (better than confirm)
                // Pass false for isFirstRender since we're transitioning from password modal
                this.showPrivateKeyModal(response.privateKey, false);
            } else {
                this.showErrorMessage(response.error || 'Failed to export private key');
            }
        } catch (error: any) {
            console.error('Error exporting private key:', error);
            this.showErrorMessage('Failed to export private key: ' + (error.message || 'Unknown error'));
        }
    }

    private showPrivateKeyModal(privateKey: string, shouldAnimate: boolean = true) {
        ModalModule.showPrivateKeyModal(privateKey, shouldAnimate, this.getModalContext());
    }

    private hidePrivateKeyModal() {
        ModalModule.hidePrivateKeyModal(this.getModalContext());
    }

    private revealPrivateKey() {
        // Update the content without re-rendering the entire modal
        const keyText = document.getElementById('private-key-text');
        const showKeyBtn = document.getElementById('show-private-key-btn');
        const copyBtn = document.getElementById('private-key-copy-btn');
        const closeBtnFooter = document.getElementById('private-key-close-btn');

        if (this.state.privateKeyToShow && keyText && showKeyBtn) {
            // Hide the "show key" button
            showKeyBtn.style.display = 'none';

            // Show the private key
            keyText.textContent = this.state.privateKeyToShow;
            const keyContainer = keyText.parentElement;
            if (keyContainer) {
                keyContainer.style.display = 'block';
            }

            // Show the copy button
            if (copyBtn) {
                copyBtn.style.display = 'block';
            }

            // Update state
            this.state.privateKeyRevealed = true;
        }
    }

    private attachPrivateKeyModalListeners() {
        setTimeout(() => {
            const overlay = document.getElementById('private-key-modal-overlay');
            const closeBtn = document.getElementById('private-key-modal-close');
            const closeBtnFooter = document.getElementById('private-key-close-btn');
            const copyBtn = document.getElementById('private-key-copy-btn');
            const showKeyBtn = document.getElementById('show-private-key-btn');

            if (!overlay) return; // Modal not in DOM yet

            // Remove old listeners by cloning and replacing (cleaner than tracking)
            // But for simplicity, we'll just attach - DOM recreation handles cleanup

            // Close button in header
            if (closeBtn) {
                closeBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.hidePrivateKeyModal();
                };
            }

            // Close button in footer
            if (closeBtnFooter) {
                closeBtnFooter.onclick = (e) => {
                    e.stopPropagation();
                    this.hidePrivateKeyModal();
                };
            }

            // Copy button (only visible when key is revealed)
            if (copyBtn) {
                copyBtn.onclick = async (e) => {
                    e.stopPropagation();
                    if (this.state.privateKeyToShow) {
                        try {
                            await navigator.clipboard.writeText(this.state.privateKeyToShow);
                            this.showSuccessMessage('Private key copied to clipboard');
                        } catch (error) {
                            console.error('Failed to copy private key:', error);
                            this.showErrorMessage('Failed to copy private key');
                        }
                    }
                };
            }

            // Show key button (only visible when key is hidden)
            if (showKeyBtn) {
                showKeyBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.revealPrivateKey();
                };
            }

            // Close on overlay click
            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    this.hidePrivateKeyModal();
                }
            };
        }, 100);
    }

    private showPasswordModal(title: string, message: string, onConfirm: (password: string) => void) {
        ModalModule.showPasswordModal(title, message, onConfirm, this.getModalContext());
        this.attachPasswordModalListeners();
    }

    private hidePasswordModal() {
        ModalModule.hidePasswordModal(this.getModalContext());
    }

    private attachPasswordModalListeners() {
        setTimeout(() => {
            const overlay = document.getElementById('password-modal-overlay');
            const closeBtn = document.getElementById('password-modal-cancel');
            const confirmBtn = document.getElementById('password-modal-confirm');
            const passwordInput = document.getElementById('password-modal-input') as HTMLInputElement;
            const errorDiv = document.getElementById('password-modal-error');

            // Store the callback before hiding modal (which clears state)
            const config = this.state.passwordModalConfig;
            if (!config) {
                console.error('[PasswordModal] No config found');
                return;
            }

            const handleConfirm = () => {
                const password = passwordInput?.value?.trim() || '';
                if (!password) {
                    if (errorDiv) {
                        errorDiv.textContent = 'Please enter your password';
                        errorDiv.style.display = 'block';
                    }
                    return;
                }
                // Hide modal first, then call callback
                this.hidePasswordModal();
                // Use stored config instead of state (which gets cleared)
                if (config && config.onConfirm) {
                    config.onConfirm(password);
                }
            };

            overlay?.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.hidePasswordModal();
                }
            });

            closeBtn?.addEventListener('click', () => {
                this.hidePasswordModal();
            });

            confirmBtn?.addEventListener('click', handleConfirm);
            passwordInput?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirm();
                }
            });
        }, 100);
    }

    private handleDeleteAccountFromDetail(address: string) {
        const account = this.state.accounts.find(acc => acc.address.toLowerCase() === address.toLowerCase());
        if (account) {
            this.hideAccountDetailModal();
            this.handleDeleteAccount(account);
        }
    }

    private async checkDelegationStatus(address: string) {
        const normalizedAddress = address?.toLowerCase();
        const requestId = ++this.delegationRequestId;
        try {
            this.state.delegationLoading = true;
            this.state.delegationStatusAddress = normalizedAddress;
            if (this.delegationLoadingTimeout) {
                window.clearTimeout(this.delegationLoadingTimeout);
                this.delegationLoadingTimeout = undefined;
            }
            // Only update the delegation section, don't re-render entire modal
            this.updateDelegationSection();

            console.log('[checkDelegationStatus] Sending CHECK_DELEGATION message:', {
                address,
                chainId: this.state.selectedNetwork
            });

            const response = await chrome.runtime.sendMessage({
                type: 'CHECK_DELEGATION',
                address: address,
                chainId: this.state.selectedNetwork
            });

            console.log('[checkDelegationStatus] Received response:', response);

            if (requestId !== this.delegationRequestId) {
                return;
            }

            if (response && response.success) {
                // Store the chainId with the delegation status so we know which network it's delegated on
                this.state.delegationStatus = {
                    ...response.delegationStatus,
                    chainId: this.state.selectedNetwork
                };
                this.state.delegationStatusAddress = normalizedAddress;
                this.scheduleDelegationLoadingCompletion(1000);
                console.log('[checkDelegationStatus] Delegation status updated:', this.state.delegationStatus);
            } else {
                const errorMsg = response?.error || 'Unknown error checking delegation';
                console.error('[checkDelegationStatus] Failed to check delegation:', errorMsg);
                this.state.delegationLoading = false;
                this.updateDelegationSection();
            }
        } catch (error: any) {
            if (requestId !== this.delegationRequestId) {
                return;
            }
            console.error('[checkDelegationStatus] Error checking delegation:', error);
            this.state.delegationLoading = false;
            this.updateDelegationSection();
        }
    }

    private scheduleDelegationLoadingCompletion(delayMs: number) {
        if (this.delegationLoadingTimeout) {
            window.clearTimeout(this.delegationLoadingTimeout);
        }
        this.delegationLoadingTimeout = window.setTimeout(() => {
            this.state.delegationLoading = false;
            this.updateDelegationSection();
            this.delegationLoadingTimeout = undefined;
        }, delayMs);
    }

    /**
     * Update delegation UI blocks (account detail + standalone modal)
     * without re-rendering the entire app
     */
    private updateDelegationSection() {
        this.updateAccountDetailDelegationSection();
        this.updateEip7702Modal();
    }

    /**
     * Update only the delegation section in the Account Detail modal
     * without re-rendering the entire modal (prevents slide-up animation)
     */
    private updateAccountDetailDelegationSection() {
        if (!this.state.showAccountDetailModal || !this.state.accountToEdit) {
            return;
        }

        if (this.state.accountToEdit.isWatchOnly) {
            return;
        }

        // Try both possible IDs for compatibility
        const smartAccountSection = document.getElementById('smart-account-section') ||
            document.getElementById('smart-account-upgrade-section');
        if (smartAccountSection) {
            const accountAddress = this.state.accountToEdit.address?.toLowerCase();
            const isCurrentAccount = accountAddress && accountAddress === this.state.delegationStatusAddress;
            smartAccountSection.innerHTML = renderSmartAccountUpgrade(
                this.state.accountToEdit,
                isCurrentAccount ? this.state.delegationStatus : null,
                this.state.delegationLoading && !!isCurrentAccount,
                () => this.showDelegationModal(true),
                () => this.showDelegationModal(false),
                this.state.delegationTransactionHash,
                this.state.selectedNetwork
            );
            // Re-attach listeners for the new content
            this.attachDelegationListeners();
        }
    }

    /**
     * Update only the delegation modal overlay without re-rendering the entire app
     * This prevents the Smart Account section from disappearing/reappearing
     */
    private updateDelegationModal() {
        const app = document.getElementById('app');
        if (!app) return;

        // Find the delegation modal container in the DOM
        const existingModal = document.getElementById('delegation-modal-overlay');
        const modalHTML = renderDelegationModal(
            this.state.delegationModalIsUpgrade,
            this.state.delegationModalIsUpgrade
                ? (this.state.delegationContractAddress || this.getDefaultDelegatorAddress(this.state.selectedNetwork))
                : '0x0000000000000000000000000000000000000000',
            () => this.handleApproveDelegation(),
            () => this.hideDelegationModal(),
            this.state.showDelegationModal,
            this.state.delegationModalFirstRender,
            this.state.selectedNetwork,
            this.state.delegationButtonToConfirm,
            () => {
                this.state.delegationButtonToConfirm = false;
                this.updateDelegationModal();
            }
        );

        if (this.state.showDelegationModal) {
            // Insert or update the modal
            if (existingModal) {
                // Replace existing modal
                existingModal.outerHTML = modalHTML;
            } else {
                // Insert new modal at the end of the app container
                app.insertAdjacentHTML('beforeend', modalHTML);
            }
            // Attach listeners after render completes
            setTimeout(() => {
                this.attachDelegationModalListeners();
            }, 100);
        } else {
            // Remove modal if it exists
            if (existingModal) {
                existingModal.remove();
            }
        }
    }

    private showEip7702Modal() {
        const selectedAccount = this.state.selectedAccount;
        if (!selectedAccount) {
            this.showErrorMessage('Please select an account first.');
            return;
        }

        const modalExists = document.getElementById('eip7702-modal-root') !== null;
        const normalizedAddress = selectedAccount.address?.toLowerCase() || null;
        const isDifferentAccount = normalizedAddress !== this.state.delegationStatusAddress;

        if (isDifferentAccount) {
            this.state.delegationStatus = null;
        }

        this.state.delegationLoading = true;
        this.state.delegationStatusAddress = normalizedAddress;
        this.state.showEip7702Modal = true;
        this.state.delegationTargetAddress = selectedAccount.address;
        this.state.eip7702ModalAccountAddress = selectedAccount.address?.toLowerCase() || null;
        this.state.eip7702ModalFirstRender = !modalExists;
        this.updateEip7702Modal();
        this.checkDelegationStatus(selectedAccount.address);
        if (this.state.eip7702ModalFirstRender) {
            this.state.eip7702ModalFirstRender = false;
        }
    }

    private hideEip7702Modal() {
        this.state.showEip7702Modal = false;
        this.state.eip7702ModalFirstRender = true;
        this.state.eip7702ModalAccountAddress = null;
        this.updateEip7702Modal();
    }

    private updateEip7702Modal() {
        const app = document.getElementById('app');
        if (!app) {
            return;
        }

        const existingModal = document.getElementById('eip7702-modal-root');

        if (!this.state.showEip7702Modal) {
            if (existingModal) {
                existingModal.remove();
            }
            return;
        }

        const targetAddress = this.state.eip7702ModalAccountAddress;
        const modalAccount = this.state.accounts.find((account) =>
            account.address?.toLowerCase() === targetAddress
        ) || this.state.selectedAccount;
        const accountAddress = modalAccount?.address?.toLowerCase();
        const isCurrentAccount = accountAddress && accountAddress === this.state.delegationStatusAddress;

        const modalHTML = renderEip7702Modal({
            visible: this.state.showEip7702Modal,
            account: modalAccount,
            delegationStatus: isCurrentAccount ? this.state.delegationStatus : null,
            isLoading: !!(this.state.delegationLoading && isCurrentAccount),
            isFirstRender: this.state.eip7702ModalFirstRender,
            transactionHash: this.state.delegationTransactionHash,
            chainId: this.state.selectedNetwork,
            networks: this.state.networks,
        });

        if (existingModal) {
            existingModal.outerHTML = modalHTML;
        } else {
            app.insertAdjacentHTML('beforeend', modalHTML);
        }

        setTimeout(() => {
            this.attachEip7702ModalListeners();
            this.attachDelegationListeners();
        }, 50);
    }

    private attachEip7702ModalListeners() {
        const overlay = document.getElementById('eip7702-modal-overlay');
        const closeBtn = document.getElementById('eip7702-modal-close');
        const networkSelector = document.getElementById('eip7702-network-selector') as HTMLSelectElement;

        overlay?.addEventListener('click', (event) => {
            if (event.target === overlay) {
                this.hideEip7702Modal();
            }
        });

        closeBtn?.addEventListener('click', () => {
            this.hideEip7702Modal();
        });

        networkSelector?.addEventListener('change', async (event) => {
            const selectedChainId = parseInt((event.target as HTMLSelectElement).value, 10);
            if (selectedChainId !== this.state.selectedNetwork) {
                console.log('[attachEip7702ModalListeners] Network changed in modal:', selectedChainId);
                // Update the selected network
                this.state.selectedNetwork = selectedChainId;
                // Switch network in the wallet
                await this.walletService.switchNetwork(selectedChainId);
                // Re-check delegation status for the new network
                if (this.state.eip7702ModalAccountAddress) {
                    this.checkDelegationStatus(this.state.eip7702ModalAccountAddress);
                }
                // Update the modal to reflect the new network (this will update the icon)
                this.updateEip7702Modal();
            }
        });
    }

    private showSubscriptionsModal() {
        const modalExists = document.getElementById('subscriptions-modal-root') !== null;
        this.state.showSubscriptionsModal = true;
        this.state.subscriptionsModalFirstRender = !modalExists;
        this.updateSubscriptionsModal();
        this.updateSubscriptionSignModal();
        if (this.state.subscriptionsModalFirstRender) {
            this.state.subscriptionsModalFirstRender = false;
        }
    }

    private hideSubscriptionsModal() {
        this.state.showSubscriptionsModal = false;
        this.state.subscriptionsModalFirstRender = true;
        this.updateSubscriptionsModal();
        this.updateSubscriptionSignModal();
    }

    private updateSubscriptionsModal() {
        const app = document.getElementById('app');
        if (!app) {
            return;
        }

        const existingModal = document.getElementById('subscriptions-modal-root');

        if (!this.state.showSubscriptionsModal) {
            if (existingModal) {
                existingModal.remove();
            }
            return;
        }

        const modalHTML = renderSubscriptionsModal({
            visible: this.state.showSubscriptionsModal,
            isFirstRender: this.state.subscriptionsModalFirstRender,
        });

        if (existingModal) {
            existingModal.outerHTML = modalHTML;
        } else {
            app.insertAdjacentHTML('beforeend', modalHTML);
        }

        setTimeout(() => {
            this.attachSubscriptionsModalListeners();
        }, 50);
    }

    private attachSubscriptionsModalListeners() {
        const overlay = document.getElementById('subscriptions-modal-overlay');
        const closeBtn = document.getElementById('subscriptions-modal-close');

        overlay?.addEventListener('click', (event) => {
            if (event.target === overlay) {
                this.hideSubscriptionsModal();
            }
        });

        closeBtn?.addEventListener('click', () => {
            this.hideSubscriptionsModal();
        });

        // Add click listeners for subscription service cards
        const subscriptionServices = ['bankless', 'spotify', 'netflix', 'youtube', 'amazon', 'apple', 'disney'];
        subscriptionServices.forEach(serviceId => {
            const serviceBtn = document.getElementById(`subscription-${serviceId}`);
            serviceBtn?.addEventListener('click', () => {
                if (serviceId === 'bankless') {
                    this.handleBanklessSubscription();
                } else {
                    console.log(`Subscription service clicked: ${serviceId}`);
                    // TODO: Implement subscription setup functionality for other services
                }
            });
        });
    }

    private async handleBanklessSubscription() {
        try {
            const account = this.state.selectedAccount;
            if (!account) {
                return;
            }

            // Reset state
            this.state.subscriptionFlow = {
                serviceId: 'bankless',
                status: 'fetching',
                paymentRequirements: null,
            };
            this.updateSubscriptionSignModal();

            // Use X402Client to handle 402 payment flow properly
            const { X402Client } = await import('./services/x402-client.js');

            const response = await X402Client.get('https://express-ern9krf5s-emanherawys-projects.vercel.app/api/verify');

            if (!response.success) {
                throw new Error(response.error || 'Failed to fetch payment requirements');
            }

            // Check if payment is required (402)
            if (!response.paymentRequired || !response.paymentRequirements) {
                // If no payment required, we're done
                console.log('[handleBanklessSubscription] No payment required, subscription verified');
                this.state.subscriptionFlow.status = 'success';
                this.updateSubscriptionSignModal();
                return;
            }

            console.log('[handleBanklessSubscription] Payment required:', response.paymentRequirements);

            // Update state with payment requirements
            this.state.subscriptionFlow = {
                serviceId: 'bankless',
                status: 'signing',
                paymentRequirements: response.paymentRequirements,
            };
            this.updateSubscriptionSignModal();
            this.attachSubscriptionSignModalListeners();
        } catch (error: any) {
            console.error('Error fetching subscription requirements:', error);
            // Don't show error state, just reset
            this.hideSubscriptionSignModal();
        }
    }

    private async handleSubscriptionSign() {
        try {
            const account = this.state.selectedAccount;
            if (!account) {
                return;
            }

            // Check if this is a Halo chip account
            const isHaloChipAccount = account.isChipAccount && account.chipInfo;
            
            if (isHaloChipAccount) {
                // Sign with Halo chip
                await this.handleHaloSubscriptionSign(account);
            } else {
                // Regular account signing with x402
                await this.handleX402SubscriptionSign(account);
            }
        } catch (error: any) {
            console.error('Error signing subscription:', error);
            // Don't show error state, just reset to idle
            this.hideSubscriptionSignModal();
        }
    }

    private async handleHaloSubscriptionSign(account: any) {
        try {
            // Update to processing state
            this.state.subscriptionFlow.status = 'processing';
            this.updateSubscriptionSignModal();

            // Import HaloUI and HaloChip
            const { HaloUI } = await import('./halo-ui.js');
            const { HaloChip } = await import('../halo/halo.js');
            
            let qrCodeUI: { remove: () => void; updateStatus: (status: string) => void } | null = null;

            // Sign the payment requirements message
            const messageToSign = JSON.stringify(this.state.subscriptionFlow.paymentRequirements);
            
            // Use LibHaLoAdapter directly for EIP-191 message signing
            const { LibHaLoAdapter } = await import('../halo/libhalo-adapter.js');
            
            // Sign with Halo chip (EIP-191 message signing, not digest)
            const signResponse = await LibHaLoAdapter.signMessage(
                messageToSign,
                account.chipInfo.slot,
                undefined, // password
                (pairInfo) => {
                    console.log('[handleHaloSubscriptionSign] Pairing started, showing QR code:', pairInfo);
                    // Show QR code when pairing starts
                    qrCodeUI = HaloUI.showQRCode(pairInfo.qrCode, pairInfo.execURL, () => {
                        // Cancel handler
                        console.log('[handleHaloSubscriptionSign] QR code cancelled');
                        if (qrCodeUI) {
                            qrCodeUI.remove();
                            qrCodeUI = null;
                        }
                        this.hideSubscriptionSignModal();
                    });
                    if (qrCodeUI) {
                        qrCodeUI.updateStatus('Waiting for phone to scan QR code...');
                    }
                },
                false // useDigest = false for EIP-191 messages
            );

            // Wait a bit for QR code to be shown, then update status
            if (qrCodeUI) {
                setTimeout(() => {
                    if (qrCodeUI) {
                        qrCodeUI.updateStatus('Phone connected! Tap your HaLo chip to your phone when prompted...');
                    }
                }, 2000);
            }

            if (!signResponse) {
                throw new Error('Failed to sign with Halo chip');
            }

            // Clean up QR code UI
            if (qrCodeUI) {
                qrCodeUI.remove();
                qrCodeUI = null;
            }

            // Simulate processing delay
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Update to success state
            this.state.subscriptionFlow.status = 'success';
            this.updateSubscriptionSignModal();
        } catch (error: any) {
            console.error('Error signing with Halo chip:', error);
            // Clean up QR code UI if it exists
            // Don't show error, just reset
            this.hideSubscriptionSignModal();
        }
    }

    private async handleX402SubscriptionSign(account: any) {
        try {
            // Update to processing state
            this.state.subscriptionFlow.status = 'processing';
            this.updateSubscriptionSignModal();

            // Get payment requirements
            const paymentRequirements = this.state.subscriptionFlow.paymentRequirements;
            if (!paymentRequirements) {
                throw new Error('No payment requirements available');
            }

            console.log('[handleX402SubscriptionSign] Creating x402 payment...');

            // Create x402 payment in background script (for security - private keys stay in background)
            const paymentResponse = await chrome.runtime.sendMessage({
                type: 'CREATE_X402_PAYMENT',
                address: account.address,
                paymentRequirements: paymentRequirements,
            });

            if (!paymentResponse.success || !paymentResponse.encodedPayment) {
                throw new Error(paymentResponse.error || 'Failed to create x402 payment');
            }

            const encodedPayment = paymentResponse.encodedPayment;
            console.log('[handleX402SubscriptionSign] Payment created, submitting...');

            // Use X402Client to submit payment
            const { X402Client } = await import('./services/x402-client.js');

            const verifyResponse = await X402Client.getWithPayment(
                'https://express-ern9krf5s-emanherawys-projects.vercel.app/api/verify',
                encodedPayment
            );

            if (!verifyResponse.success) {
                throw new Error(verifyResponse.error || 'Verification failed');
            }

            console.log('[handleX402SubscriptionSign] Payment verified successfully:', verifyResponse.data);

            // Simulate processing delay
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Update to success state
            this.state.subscriptionFlow.status = 'success';
            this.updateSubscriptionSignModal();
        } catch (error: any) {
            console.error('Error signing subscription with x402:', error);
            // Don't show error, just reset
            this.hideSubscriptionSignModal();
        }
    }

    private updateSubscriptionSignModal() {
        const app = document.getElementById('app');
        if (!app) {
            return;
        }

        const existingModal = document.getElementById('subscription-sign-modal-root');
        const isVisible = this.state.subscriptionFlow.status !== 'idle';

        if (!isVisible) {
            if (existingModal) {
                existingModal.remove();
            }
            return;
        }

        const serviceName = this.state.subscriptionFlow.serviceId === 'bankless' 
            ? 'Bankless Podcast' 
            : 'Subscription Service';

        const modalHTML = renderSubscriptionSignModal({
            visible: isVisible,
            serviceName,
            paymentRequirements: this.state.subscriptionFlow.paymentRequirements,
            status: this.state.subscriptionFlow.status as 'signing' | 'processing' | 'success',
            error: undefined,
        });

        if (existingModal) {
            existingModal.outerHTML = modalHTML;
        } else {
            app.insertAdjacentHTML('beforeend', modalHTML);
        }

        setTimeout(() => {
            this.attachSubscriptionSignModalListeners();
        }, 50);
    }

    private attachSubscriptionSignModalListeners() {
        const overlay = document.getElementById('subscription-sign-modal-overlay');
        const closeBtn = document.getElementById('subscription-sign-modal-close');
        const cancelBtn = document.getElementById('subscription-sign-modal-cancel');
        const signBtn = document.getElementById('subscription-sign-modal-sign');
        const doneBtn = document.getElementById('subscription-sign-modal-done');

        overlay?.addEventListener('click', (event) => {
            if (event.target === overlay && 
                this.state.subscriptionFlow.status !== 'processing' && 
                this.state.subscriptionFlow.status !== 'success' &&
                this.state.subscriptionFlow.status !== 'signing') {
                this.hideSubscriptionSignModal();
            }
        });

        closeBtn?.addEventListener('click', () => {
            this.hideSubscriptionSignModal();
        });

        cancelBtn?.addEventListener('click', () => {
            this.hideSubscriptionSignModal();
        });

        signBtn?.addEventListener('click', () => {
            this.handleSubscriptionSign();
        });

        doneBtn?.addEventListener('click', () => {
            this.hideSubscriptionSignModal();
            // Also close the subscriptions modal
            this.hideSubscriptionsModal();
        });
    }

    private hideSubscriptionSignModal() {
        this.state.subscriptionFlow = {
            serviceId: null,
            status: 'idle',
            paymentRequirements: null,
            error: undefined,
        };
        this.updateSubscriptionSignModal();
    }

    /**
     * Get default delegator address for a chain
     */
    private getDefaultDelegatorAddress(chainId: number): string {
        // Zircuit Mainnet - only one option
        if (chainId === 48900) {
            return '0xFDcEdae8367942f22813AB078aA3569fabDe943F';
        }
        // Default for other chains
        return '0x63c0c19a282a1b52b07dd5a65b58948a07dae32b';
    }

    /**
     * Attach listeners for the smart account upgrade/reset buttons
     */
    private attachDelegationListeners() {
        const upgradeButtons = document.querySelectorAll<HTMLButtonElement>('[data-smart-account-action="upgrade"]');
        const resetButtons = document.querySelectorAll<HTMLButtonElement>('[data-smart-account-action="reset"]');

        upgradeButtons.forEach((button) => {
            const newButton = button.cloneNode(true) as HTMLButtonElement;
            button.parentNode?.replaceChild(newButton, button);
            newButton.addEventListener('click', () => {
                const address = newButton.dataset.delegationAddress;
                if (address) {
                    this.state.delegationTargetAddress = address;
                }
                this.showDelegationModal(true);
            });
        });

        resetButtons.forEach((button) => {
            const newButton = button.cloneNode(true) as HTMLButtonElement;
            button.parentNode?.replaceChild(newButton, button);
            newButton.addEventListener('click', () => {
                const address = newButton.dataset.delegationAddress;
                if (address) {
                    this.state.delegationTargetAddress = address;
                }
                this.showDelegationModal(false);
            });
        });
    }

    private showDelegationModal(isUpgrade: boolean) {
        // Check if modal already exists (to avoid re-animation)
        const modalExists = document.getElementById('delegation-modal-overlay') !== null;
        this.state.showDelegationModal = true;
        this.state.delegationModalIsUpgrade = isUpgrade;
        // Only animate on first render
        this.state.delegationModalFirstRender = !modalExists;
        // Reset button state when opening modal
        this.state.delegationButtonToConfirm = false;
        // For Zircuit, always reset to the Zircuit delegator address
        if (isUpgrade && this.state.selectedNetwork === 48900) {
            this.state.delegationContractAddress = this.getDefaultDelegatorAddress(48900);
        }
        // Update only the delegation modal, not the entire app
        this.updateDelegationModal();
        // Mark that we've rendered once
        if (this.state.delegationModalFirstRender) {
            setTimeout(() => {
                this.state.delegationModalFirstRender = false;
            }, 350); // After animation completes
        } else {
            this.state.delegationModalFirstRender = false;
        }
    }

    private hideDelegationModal() {
        this.state.showDelegationModal = false;
        // Reset first render flag when closing so it animates on next open
        this.state.delegationModalFirstRender = true;
        // Reset button state
        this.state.delegationButtonToConfirm = false;
        // Update only the delegation modal, not the entire app
        this.updateDelegationModal();
    }

    /**
     * Helper function to set button loading state with spinner
     */
    private setButtonLoadingState(buttonId: string, isLoading: boolean, loadingText: string, originalText: string) {
        const button = document.getElementById(buttonId) as HTMLButtonElement;
        if (!button) return;

        if (isLoading) {
            button.disabled = true;
            button.innerHTML = `
                <span style="display: inline-flex; align-items: center; gap: 8px;">
                    <svg width="16" height="16" viewBox="0 0 16 16" style="animation: spin 1s linear infinite; transform-origin: center;">
                        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="44" stroke-dashoffset="11" stroke-linecap="round" opacity="0.8"/>
                    </svg>
                    ${loadingText}
                </span>
            `;
        } else {
            button.disabled = false;
            button.textContent = originalText;
        }
    }

    private async handleApproveDelegation() {
        const targetAddress = this.state.delegationTargetAddress || this.state.accountToEdit?.address;
        if (!targetAddress) {
            return;
        }

        // Reset button state
        this.state.delegationButtonToConfirm = false;

        // Get buttons to disable
        const approveBtn = document.getElementById('delegation-approve-btn');
        const confirmBtn = document.getElementById('delegation-confirm-btn');
        const actionText = this.state.delegationModalIsUpgrade ? 'Upgrade' : 'Reset Delegation';
        const loadingText = this.state.delegationModalIsUpgrade ? 'Upgrading...' : 'Revoking...';

        // Disable buttons and show loading state
        if (approveBtn) {
            this.setButtonLoadingState('delegation-approve-btn', true, loadingText, actionText);
        }
        if (confirmBtn) {
            this.setButtonLoadingState('delegation-confirm-btn', true, 'Confirming...', 'Confirm');
        }

        try {
            const messageType = this.state.delegationModalIsUpgrade ? 'UPGRADE_TO_SMART_ACCOUNT' : 'CLEAR_DELEGATION';

            // Get the contract address from input if upgrade
            let contractAddress = '0x0000000000000000000000000000000000000000';
            if (this.state.delegationModalIsUpgrade) {
                const delegatorInput = document.getElementById('delegator-address-input') as HTMLInputElement;
                contractAddress = delegatorInput?.value || this.state.delegationContractAddress || this.getDefaultDelegatorAddress(this.state.selectedNetwork);

                // Validate address format
                if (!contractAddress.startsWith('0x') || contractAddress.length !== 42) {
                    this.showErrorMessage('Invalid contract address format');
                    // Restore button state
                    if (approveBtn) {
                        this.setButtonLoadingState('delegation-approve-btn', false, loadingText, actionText);
                    }
                    if (confirmBtn) {
                        this.setButtonLoadingState('delegation-confirm-btn', false, 'Confirming...', 'Confirm');
                    }
                    return;
                }
            }

            const response = await chrome.runtime.sendMessage({
                type: messageType,
                address: targetAddress,
                chainId: this.state.selectedNetwork,
                contractAddress: contractAddress
            });

            if (response.success && response.transactionHash) {
                this.state.delegationTransactionHash = response.transactionHash;
                this.hideDelegationModal();
                // Refresh delegation status after a delay
                setTimeout(() => {
                    this.checkDelegationStatus(targetAddress);
                }, 5000);
                // Don't re-render entire modal, just update delegation section
                this.updateDelegationSection();
                // Pass transaction hash as separate parameter to make it clickable
                this.showSuccessMessage('Transaction submitted', response.transactionHash, this.state.selectedNetwork);
            } else {
                this.showErrorMessage(response.error || 'Failed to submit transaction');
                // Restore button state on error
                if (approveBtn) {
                    this.setButtonLoadingState('delegation-approve-btn', false, loadingText, actionText);
                }
                if (confirmBtn) {
                    this.setButtonLoadingState('delegation-confirm-btn', false, 'Confirming...', 'Confirm');
                }
            }
        } catch (error: any) {
            this.showErrorMessage(error.message || 'Failed to submit transaction');
            // Restore button state on error
            if (approveBtn) {
                this.setButtonLoadingState('delegation-approve-btn', false, loadingText, actionText);
            }
            if (confirmBtn) {
                this.setButtonLoadingState('delegation-confirm-btn', false, 'Confirming...', 'Confirm');
            }
        }
    }

    private attachDelegationModalListeners() {
        setTimeout(() => {
            const overlay = document.getElementById('delegation-modal-overlay');
            const closeBtn = document.getElementById('delegation-modal-close');
            const approveBtn = document.getElementById('delegation-approve-btn');
            const rejectBtn = document.getElementById('delegation-reject-btn');
            const delegatorSelect = document.getElementById('delegator-select') as HTMLSelectElement;
            const delegatorInput = document.getElementById('delegator-address-input') as HTMLInputElement;
            const etherscanLink = document.getElementById('delegator-etherscan-link') as HTMLAnchorElement;

            // Initialize readonly state based on current selection
            if (delegatorSelect && delegatorInput && this.state.delegationModalIsUpgrade) {
                // For Zircuit, always use the Zircuit delegator and make everything readonly
                if (this.state.selectedNetwork === 48900) {
                    const zircuitAddress = this.getDefaultDelegatorAddress(48900);
                    delegatorSelect.value = zircuitAddress;
                    delegatorSelect.disabled = true;
                    delegatorInput.value = zircuitAddress;
                    delegatorInput.readOnly = true;
                    delegatorInput.style.background = 'var(--r-neutral-bg1)';
                    delegatorInput.style.cursor = 'not-allowed';
                    this.state.delegationContractAddress = zircuitAddress;
                } else {
                    const selectedValue = delegatorSelect.value;
                    if (selectedValue !== 'custom') {
                        delegatorInput.readOnly = true;
                        delegatorInput.style.background = 'var(--r-neutral-bg1)';
                        delegatorInput.style.cursor = 'not-allowed';
                    } else {
                        delegatorInput.readOnly = false;
                        delegatorInput.style.background = 'var(--r-neutral-bg2)';
                        delegatorInput.style.cursor = 'text';
                    }
                }
            }

            overlay?.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    // Reset button state when clicking outside
                    this.state.delegationButtonToConfirm = false;
                    this.hideDelegationModal();
                }
            });

            closeBtn?.addEventListener('click', () => {
                this.hideDelegationModal();
            });

            approveBtn?.addEventListener('click', () => {
                if (this.state.delegationModalIsUpgrade && !this.state.delegationButtonToConfirm) {
                    // First click: show confirm state
                    this.state.delegationButtonToConfirm = true;
                    this.updateDelegationModal();
                } else {
                    // Second click or non-upgrade: actually confirm
                    this.handleApproveDelegation();
                }
            });

            // Handle confirm button (when in toConfirm state)
            const confirmBtn = document.getElementById('delegation-confirm-btn');
            confirmBtn?.addEventListener('click', () => {
                this.handleApproveDelegation();
            });

            // Handle cancel confirm button (X button)
            const cancelConfirmBtn = document.getElementById('delegation-cancel-confirm-btn');
            cancelConfirmBtn?.addEventListener('click', () => {
                this.state.delegationButtonToConfirm = false;
                this.updateDelegationModal();
            });

            rejectBtn?.addEventListener('click', () => {
                this.hideDelegationModal();
            });

            // Handle delegator selection dropdown (only for non-Zircuit chains)
            if (delegatorSelect && this.state.delegationModalIsUpgrade && this.state.selectedNetwork !== 48900) {
                delegatorSelect.addEventListener('change', (e) => {
                    const selectedValue = (e.target as HTMLSelectElement).value;
                    if (selectedValue !== 'custom') {
                        // Predefined option selected - make input readonly
                        delegatorInput.value = selectedValue;
                        delegatorInput.readOnly = true;
                        delegatorInput.style.background = 'var(--r-neutral-bg1)';
                        delegatorInput.style.cursor = 'not-allowed';
                        this.state.delegationContractAddress = selectedValue;
                        // Update Etherscan link
                        if (etherscanLink) {
                            const chainMap: Record<number, string> = {
                                1: 'etherscan.io',
                                11155111: 'sepolia.etherscan.io',
                                5: 'goerli.etherscan.io',
                                10: 'optimistic.etherscan.io',
                                42161: 'arbiscan.io',
                                8453: 'basescan.org',
                                137: 'polygonscan.com',
                                56: 'bscscan.com',
                                48900: 'explorer.zircuit.com'
                            };
                            const domain = chainMap[this.state.selectedNetwork] || 'etherscan.io';
                            etherscanLink.href = `https://${domain}/address/${selectedValue}#code`;
                        }
                    } else {
                        // Custom option selected - make input editable and clear it
                        delegatorInput.value = '';
                        delegatorInput.readOnly = false;
                        delegatorInput.style.background = 'var(--r-neutral-bg2)';
                        delegatorInput.style.cursor = 'text';
                        this.state.delegationContractAddress = '';
                        delegatorInput.focus();
                    }
                });
            }

            // For Zircuit, ensure input is always readonly and set to Zircuit address
            if (this.state.delegationModalIsUpgrade && this.state.selectedNetwork === 48900 && delegatorInput) {
                const zircuitAddress = this.getDefaultDelegatorAddress(48900);
                delegatorInput.value = zircuitAddress;
                delegatorInput.readOnly = true;
                delegatorInput.style.background = 'var(--r-neutral-bg1)';
                delegatorInput.style.cursor = 'not-allowed';
                this.state.delegationContractAddress = zircuitAddress;
                // Update Etherscan link
                if (etherscanLink) {
                    etherscanLink.href = `https://explorer.zircuit.com/address/${zircuitAddress}#code`;
                }
            }

            // Handle custom address input (only when not readonly)
            if (delegatorInput && this.state.delegationModalIsUpgrade) {
                delegatorInput.addEventListener('input', (e) => {
                    if (delegatorInput.readOnly) {
                        e.preventDefault();
                        return;
                    }
                    const value = (e.target as HTMLInputElement).value;
                    this.state.delegationContractAddress = value;
                    // Update Etherscan link
                    if (etherscanLink && value.startsWith('0x') && value.length === 42) {
                        const chainMap: Record<number, string> = {
                            1: 'etherscan.io',
                            11155111: 'sepolia.etherscan.io',
                            5: 'goerli.etherscan.io',
                            10: 'optimistic.etherscan.io',
                            42161: 'arbiscan.io',
                            8453: 'basescan.org',
                            137: 'polygonscan.com',
                            56: 'bscscan.com'
                        };
                        const domain = chainMap[this.state.selectedNetwork] || 'etherscan.io';
                        etherscanLink.href = `https://${domain}/address/${value}#code`;
                    }
                });
            }
        }, 100);
    }

    private attachAccountDetailListeners() {
        setTimeout(() => {
            const overlay = document.getElementById('account-detail-overlay');
            const closeBtn = document.getElementById('account-detail-close');
            const copyAddressBtn = document.getElementById('copy-address-btn');
            const saveNameBtn = document.getElementById('save-name-btn');
            const exportKeyBtn = document.getElementById('export-private-key-btn');
            const deleteBtn = document.getElementById('delete-account-btn');
            const nameInput = document.getElementById('account-name-input') as HTMLInputElement;

            overlay?.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.hideAccountDetailModal();
                }
            });

            closeBtn?.addEventListener('click', () => {
                this.hideAccountDetailModal();
            });

            copyAddressBtn?.addEventListener('click', async () => {
                if (this.state.accountToEdit) {
                    await navigator.clipboard.writeText(this.state.accountToEdit.address);
                    this.showSuccessMessage('Address copied to clipboard');
                }
            });

            saveNameBtn?.addEventListener('click', () => {
                if (this.state.accountToEdit && nameInput) {
                    const newName = nameInput.value.trim();
                    if (newName) {
                        this.handleUpdateAccountName(this.state.accountToEdit.address, newName);
                    }
                }
            });

            nameInput?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && this.state.accountToEdit) {
                    const newName = nameInput.value.trim();
                    if (newName) {
                        this.handleUpdateAccountName(this.state.accountToEdit.address, newName);
                    }
                }
            });

            exportKeyBtn?.addEventListener('click', () => {
                if (this.state.accountToEdit) {
                    this.handleExportPrivateKey(this.state.accountToEdit.address);
                }
            });

            deleteBtn?.addEventListener('click', () => {
                if (this.state.accountToEdit) {
                    this.handleDeleteAccountFromDetail(this.state.accountToEdit.address);
                }
            });

            // Inject Smart Account Upgrade component (use updateDelegationSection to avoid re-rendering)
            this.updateDelegationSection();
        }, 100);
    }

    async handleDeleteAccountConfirm() {
        try {
            if (!this.state.accountToDelete) {
                return;
            }

            // Get checkboxes and password
            const checkbox1 = document.getElementById('delete-confirm-1') as HTMLInputElement;
            const checkbox2 = document.getElementById('delete-confirm-2') as HTMLInputElement;
            const passwordInput = document.getElementById('delete-account-password') as HTMLInputElement;
            const errorDiv = document.getElementById('delete-account-password-error') as HTMLDivElement;
            const confirmBtn = document.getElementById('delete-account-confirm') as HTMLButtonElement;

            if (!checkbox1?.checked || !checkbox2?.checked) {
                if (errorDiv) {
                    errorDiv.textContent = 'Please confirm both statements';
                    errorDiv.style.display = 'block';
                }
                return;
            }

            const password = passwordInput?.value || '';
            if (!password) {
                if (errorDiv) {
                    errorDiv.textContent = 'Please enter your password';
                    errorDiv.style.display = 'block';
                }
                return;
            }

            // Verify password
            const { verifyPassword } = await import('../core/password.js');
            const isValid = await verifyPassword(password);
            if (!isValid) {
                if (errorDiv) {
                    errorDiv.textContent = 'Incorrect password';
                    errorDiv.style.display = 'block';
                }
                return;
            }

            if (errorDiv) {
                errorDiv.style.display = 'none';
            }

            // Store address before hiding modal (which clears accountToDelete)
            const addressToDelete = this.state.accountToDelete.address;

            this.hideDeleteAccountModal();

            // Delete the account
            await this.walletService.deleteAccount(addressToDelete);

            // Reload accounts
            await this.loadAccounts();

            // Reload connected DApp
            await this.loadConnectedDApp();

            this.render();

            this.showSuccessMessage('Account deleted successfully');
        } catch (error: any) {
            console.error('Error deleting account:', error);
            this.showErrorMessage('Failed to delete account: ' + (error.message || 'Unknown error'));
        }
    }
}

