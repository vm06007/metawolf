import { WalletService } from './services/wallet-service';
import { HaloService } from './services/halo-service';
import { FireflyService } from './services/firefly-service';
import { formatAddress, getDisplayName } from './utils/account';
import { renderDashboardHeader } from './components/DashboardHeader';
import { renderDashboardPanel, DEFAULT_PANEL_ITEMS } from './components/DashboardPanel';
import { renderLockScreen } from './components/LockScreen';
import { renderAccountSelectorModal } from './components/AccountSelectorModal';
import { renderAccountDetailModal } from './components/AccountDetailModal';
import { renderSmartAccountUpgrade } from './components/SmartAccountUpgrade';
import { renderDelegationModal } from './components/DelegationModal';
import { renderPasswordModal } from './components/PasswordModal';
import { renderAccountSidebar } from './components/AccountSidebar';
import { renderTransactionList, Transaction } from './components/TransactionList';
import { renderAddWalletModal, ADD_WALLET_OPTIONS } from './components/AddWalletModal';
import { renderAddContactModal } from './components/AddContactModal';
import { renderCurrentConnection, ConnectedDApp } from './components/CurrentConnection';
import { renderCreateAccountForm } from './components/CreateAccountForm';
import { renderImportAccountForm } from './components/ImportAccountForm';
import { renderCreateMultisigForm } from './components/CreateMultisigForm';
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
import { ethPriceService } from './services/eth-price-service';
import { unifiedBalanceService, UnifiedBalanceData } from './services/unified-balance-service';
import { transferService } from './services/transfer-service';
import { createEIP1193Provider } from './services/eip1193-provider';
import { fetchTransactionsFromOctav, OctavTransaction } from './services/transactions-service';
import { HaloUI } from './halo-ui';
import { isAddress, getAddress } from '@ethersproject/address';
import { loadEthers } from './ethers-loader';

const TRANSACTIONS_PAGE_SIZE = 20;

interface AppState {
    unlocked: boolean;
    accounts: any[];
    selectedAccount?: any;
    balance: string;
    networks: any[];
    selectedNetwork: number;
    loading: boolean;
    password: string;
    hasPassword: boolean;
    showAccountSelector: boolean;
    accountSelectorFirstRender: boolean;
    showAddWalletModal: boolean;
    showCreateAccountForm: boolean;
    showImportAccountForm: boolean;
    showCreateMultisigForm: boolean;
    showHaloChipNameForm: boolean;
    showFireflyNameForm: boolean;
    showSecurityConfirm: boolean;
    pendingHaloLink?: { deleteKey: boolean };
    connectedDApp: ConnectedDApp | null;
    showDeleteAccountModal: boolean;
    accountToDelete?: any;
    errorMessage?: string;
    showSettingsMenu: boolean;
    showChangePasswordModal: boolean;
    ethPriceData: EthPriceData | null;
    ethPriceLoading: boolean;
    sidebarCollapsed: boolean;
    showAddContactModal: boolean;
    showAccountDetailModal: boolean;
    accountToEdit?: any;
    accountDetailModalFirstRender: boolean;
    showPasswordModal: boolean;
    passwordModalConfig?: {
        title: string;
        message: string;
        onConfirm: (password: string) => void;
    };
    passwordModalFirstRender: boolean;
    showPrivateKeyModal: boolean;
    privateKeyToShow?: string;
    privateKeyRevealed: boolean;
    privateKeyModalFirstRender: boolean;
    unifiedBalanceData: UnifiedBalanceData | null;
    unifiedBalanceLoading: boolean;
    showReceiveScreen: boolean;
    receiveScreenHideBalance: boolean;
    showSendScreen: boolean;
    sendScreenHideBalance: boolean;
    delegationStatus: {
        isDelegated: boolean;
        delegateAddress: string | null;
        codeHash: string;
    } | null;
    delegationLoading: boolean;
    showDelegationModal: boolean;
    delegationModalIsUpgrade: boolean;
    delegationModalFirstRender: boolean;
    delegationContractAddress: string | null;
    delegationTransactionHash: string | null;
    delegationButtonToConfirm: boolean;
    showTransactionsScreen: boolean;
    transactions: OctavTransaction[];
    transactionsLoading: boolean;
    transactionsError?: string;
    transactionsOffset: number;
    transactionsHasMore: boolean;
    transactionsHideSpam: boolean;
    transactionsAccountAddress?: string;
}

export class PopupApp {
    public state: AppState = {
        unlocked: false,
        accounts: [],
        selectedAccount: undefined,
        balance: '0.00',
        networks: [],
        selectedNetwork: 1,
        loading: true,
        password: '',
        hasPassword: false,
        showAccountSelector: false,
        accountSelectorFirstRender: true,
        showAddWalletModal: false,
        showCreateAccountForm: false,
        showImportAccountForm: false,
        showCreateMultisigForm: false,
        showHaloChipNameForm: false,
        showFireflyNameForm: false,
        showSecurityConfirm: false,
        pendingHaloLink: undefined,
        connectedDApp: null,
        showDeleteAccountModal: false,
        accountToDelete: undefined,
        errorMessage: undefined,
        showSettingsMenu: false,
        showChangePasswordModal: false,
        ethPriceData: null,
        ethPriceLoading: false,
        sidebarCollapsed: false,
        showAddContactModal: false,
        showAccountDetailModal: false,
        accountToEdit: undefined,
        accountDetailModalFirstRender: true,
        showPasswordModal: false,
        passwordModalConfig: undefined,
        passwordModalFirstRender: true,
        showPrivateKeyModal: false,
        privateKeyToShow: undefined,
        privateKeyRevealed: false,
        privateKeyModalFirstRender: true,
        unifiedBalanceData: null,
        unifiedBalanceLoading: false,
        showReceiveScreen: false,
        receiveScreenHideBalance: false,
        showSendScreen: false,
        sendScreenHideBalance: false,
        delegationStatus: null,
        delegationLoading: false,
        showDelegationModal: false,
        delegationModalIsUpgrade: true,
        delegationModalFirstRender: true,
        delegationContractAddress: null,
        delegationTransactionHash: null,
        delegationButtonToConfirm: false,
        showTransactionsScreen: false,
        transactions: [],
        transactionsLoading: false,
        transactionsError: undefined,
        transactionsOffset: 0,
        transactionsHasMore: false,
        transactionsHideSpam: true,
        transactionsAccountAddress: undefined,
    };

    private walletService: WalletService;
    private haloService: HaloService;
    private fireflyService: FireflyService;

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
        if (!account || !account.address) {
            return;
        }

        // For Halo chip accounts, fetch balance directly from node (no SDK needed)
        if (account.isChipAccount && account.chipInfo) {
            console.log('[PopupApp] Halo chip account detected, fetching balance directly from node');
            await this.loadUnifiedBalances();
            return;
        }

        // Find a non-watch-only account to use for signing
        // If the selected account is watch-only, find the first non-watch-only account
        let accountToUse = account;
        if (account.isWatchOnly) {
            const nonWatchOnlyAccount = this.state.accounts.find(acc => !acc.isWatchOnly);
            if (!nonWatchOnlyAccount) {
                console.warn('[PopupApp] No non-watch-only accounts available for unified balance');
                this.state.unifiedBalanceLoading = false;
                this.state.unifiedBalanceData = {
                    totalBalanceUSD: 0,
                    assets: [],
                    loading: false,
                    error: 'No accounts with private keys available. Unified balance requires a signable account.',
                };
                return;
            }
            accountToUse = nonWatchOnlyAccount;
            console.log(`[PopupApp] Selected account is watch-only, using account ${accountToUse.address} instead`);
        }

        // Ensure Buffer is available before initializing SDK
        if (typeof (window as any).Buffer === 'undefined') {
            console.warn('[PopupApp] Buffer not available, waiting for polyfills...');
            // Wait a bit for polyfills to load
            await new Promise(resolve => setTimeout(resolve, 100));

            if (typeof (window as any).Buffer === 'undefined') {
                console.error('[PopupApp] Buffer still not available after wait');
                this.state.unifiedBalanceLoading = false;
                this.state.unifiedBalanceData = {
                    totalBalanceUSD: 0,
                    assets: [],
                    loading: false,
                    error: 'Buffer polyfill not loaded',
                };
                return;
            }
        }

        try {
            // Clean up previous SDK instance
            unifiedBalanceService.deinit();

            // Get a provider for Ethereum mainnet (Nexus SDK needs a provider)
            // Dynamically import ethers to avoid bundling conflicts
            const ethersModule = await loadEthers();
            const ethers = ethersModule.ethers || ethersModule.default || ethersModule;
            const provider = new ethers.JsonRpcProvider('https://mainnet.infura.io/v3/db2e296c0a0f475fb6c3a3281a0c39d6');

            // Create EIP-1193 provider wrapper
            // Use a non-watch-only account for signing (required for SIWE)
            const eip1193Provider = createEIP1193Provider(provider, accountToUse.address);

            // Initialize the SDK
            // This may fail in browser extension context due to domain validation
            // We handle the error and show a user-friendly message
            await unifiedBalanceService.initialize(eip1193Provider, 'mainnet');

            // Set SDK for transfer service
            const sdk = (unifiedBalanceService as any).sdk;
            if (sdk) {
                transferService.setSDK(sdk);
            }

            // Fetch unified balances
            await this.loadUnifiedBalances();
            this.render(); // Update UI after loading
        } catch (error: any) {
            console.error('[PopupApp] Error initializing unified balance:', error);
            this.state.unifiedBalanceLoading = false;
            this.state.unifiedBalanceData = {
                totalBalanceUSD: 0,
                assets: [],
                loading: false,
                error: error.message || 'Failed to initialize unified balance',
            };
            this.render(); // Update UI to show error
        }
    }

    async loadUnifiedBalances() {
        try {
            this.state.unifiedBalanceLoading = true;
            this.render(); // Show loading state

            // Pass selected account to unified balance service
            // This allows it to detect Halo chip accounts and fetch balance directly from node
            const data = await unifiedBalanceService.getUnifiedBalances(this.state.selectedAccount);
            this.state.unifiedBalanceData = data;

            // Update the balance display with total USD value
            if (data.totalBalanceUSD > 0) {
                this.state.balance = data.totalBalanceUSD.toFixed(2);
            }

            console.log('[PopupApp] Unified balances loaded:', {
                totalUSD: data.totalBalanceUSD,
                assetCount: data.assets.length,
                hasError: !!data.error
            });
        } catch (error: any) {
            console.error('[PopupApp] Error loading unified balances:', error);
            this.state.unifiedBalanceData = {
                totalBalanceUSD: 0,
                assets: [],
                loading: false,
                error: error.message || 'Failed to load unified balances',
            };
        } finally {
            this.state.unifiedBalanceLoading = false;
            this.render(); // Update UI with results
        }
    }

    async loadNetworks() {
        this.state.networks = await this.walletService.getNetworks();
        if (this.state.networks.length > 0) {
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

        // If no password is set and no accounts, show welcome screen
        if (!this.state.hasPassword && this.state.accounts.length === 0) {
            app.innerHTML = renderLockScreen(
                false,
                '',
                undefined
            );
            this.attachLockScreenListeners();
            return;
        }

        // Show send screen if requested
        if (this.state.showSendScreen && this.state.selectedAccount) {
            const selectedAccount = this.state.selectedAccount;
            const displayName = getDisplayName(selectedAccount);
            const assets = this.state.unifiedBalanceData?.assets || [];
            app.innerHTML = renderSendScreen({
                accountName: displayName,
                balance: this.state.balance || '0.00',
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
                this.state.unifiedBalanceLoading
            )}
                            ${renderUnifiedBalancePanel({
                data: this.state.unifiedBalanceData,
                loading: this.state.unifiedBalanceLoading,
            })}
                            ${renderDashboardPanel(DEFAULT_PANEL_ITEMS, true)}
                            <div class="transaction-section">
                                ${renderTransactionList(this.getTransactionsForAccount(selectedAccount), selectedAccount)}
                            </div>
                            <div class="current-connection-wrapper">
                                ${renderCurrentConnection(
                this.state.connectedDApp,
                () => this.handleDisconnectDApp(),
                () => this.handleChainChange(),
                this.state.ethPriceData,
                true,
                this.state.ethPriceLoading
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
                    ? (this.state.delegationContractAddress || '0x63c0c19a282a1b52b07dd5a65b58948a07dae32b')
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
                this.state.unifiedBalanceLoading
            )}
                    ${renderUnifiedBalancePanel({
                data: this.state.unifiedBalanceData,
                loading: this.state.unifiedBalanceLoading,
            })}
                    ${renderDashboardPanel(DEFAULT_PANEL_ITEMS)}
                    <div style="padding: 0 16px 4px 16px;">
                        ${renderEthPricePanel(this.state.ethPriceData, this.state.ethPriceLoading)}
                    </div>
                        <div class="current-connection-wrapper">
                            ${renderCurrentConnection(
                this.state.connectedDApp,
                () => this.handleDisconnectDApp(),
                () => this.handleChainChange(),
                undefined,
                false
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
    }

    private attachLockScreenListeners() {
        const unlockBtn = document.getElementById('unlock-btn');
        const passwordInput = document.getElementById('password-input') as HTMLInputElement;
        const createFirstBtn = document.getElementById('create-first-btn');
        const importFirstBtn = document.getElementById('import-first-btn');
        const forgotPasswordLink = document.getElementById('forgot-password-link');

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

        createFirstBtn?.addEventListener('click', () => {
            // Show create account form - password will be set when account is created
            this.state.unlocked = true; // Allow creating first account
            this.showAddWalletModal();
        });

        importFirstBtn?.addEventListener('click', () => {
            // Show import account form - password will be set when account is imported
            this.state.unlocked = true; // Allow importing first account
            this.showAddWalletModal();
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
        document.getElementById('panel-send')?.addEventListener('click', () => {
            this.state.showSendScreen = true;
            this.render();
        });
        document.getElementById('panel-receive')?.addEventListener('click', () => {
            this.state.showReceiveScreen = true;
            this.render();
        });
        document.getElementById('panel-swap')?.addEventListener('click', () => console.log('Swap clicked'));
        document.getElementById('panel-bridge')?.addEventListener('click', () => console.log('Bridge clicked'));
        document.getElementById('panel-transactions')?.addEventListener('click', () => this.openTransactionsScreen());
        document.getElementById('panel-approvals')?.addEventListener('click', () => console.log('Approvals clicked'));
        document.getElementById('panel-settings')?.addEventListener('click', () => this.handleSettings());
        document.getElementById('panel-nft')?.addEventListener('click', () => console.log('NFT clicked'));
        document.getElementById('panel-ecology')?.addEventListener('click', () => console.log('Ecology clicked'));
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

    private attachSendScreenListeners() {
        console.log('[SendScreen] Attaching listeners...');

        // Initialize send screen state with defaults
        const defaultToken = 'ETH';
        const defaultChainId = 1; // Ethereum mainnet

        const sendScreenState: any = {
            selectedToken: defaultToken,
            selectedChainId: defaultChainId,
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
                        const tokenIcon = asset?.icon || (token === 'ETH' ? 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png' : null);
                        const tokenBalance = asset ? parseFloat(asset.balance) : 0;

                        if (tokenDisplay) {
                            tokenDisplay.innerHTML = `
                                ${tokenIcon ? `
                                    <img src="${tokenIcon}" alt="${token}" class="send-token-display-icon">
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

        // Recipient input validation
        const recipientInput = document.getElementById('send-recipient-input') as HTMLInputElement;
        const recipientError = document.getElementById('send-recipient-error');

        if (recipientInput) {
            recipientInput.disabled = false;
            recipientInput.readOnly = false;
            recipientInput.addEventListener('input', () => {
                const address = recipientInput.value.trim();
                if (address && recipientError) {
                    if (isAddress(address)) {
                        recipientError.style.display = 'none';
                    } else {
                        recipientError.textContent = 'Invalid address';
                        recipientError.style.display = 'block';
                    }
                } else if (recipientError) {
                    recipientError.style.display = 'none';
                }
                this.updateSendButtonState(sendScreenState);
            });
            console.log('[SendScreen] Recipient input attached');
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

    private updateSendButtonState(state?: any) {
        const sendState = state || (this as any)._sendScreenState;
        if (!sendState) return;

        const submitBtn = document.getElementById('send-submit-btn');
        const amountInput = document.getElementById('send-amount-input') as HTMLInputElement;
        const recipientInput = document.getElementById('send-recipient-input') as HTMLInputElement;

        const hasToken = !!sendState.selectedToken;
        const hasChain = !!sendState.selectedChainId;
        const hasAmount = amountInput?.value && parseFloat(amountInput.value) > 0;
        const hasRecipient = recipientInput?.value && isAddress(recipientInput.value.trim());

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
        const recipient = recipientInput.value.trim() as `0x${string}`;

        if (!isAddress(recipient)) {
            if (errorMessage) {
                errorMessage.textContent = 'Invalid recipient address';
                errorMessage.style.display = 'block';
            }
            return;
        }

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
        try {
            // Check if this is a native token (ETH) or ERC20 token
            const isNative = params.token.toUpperCase() === 'ETH' ||
                params.token.toUpperCase() === 'MATIC' ||
                params.token.toUpperCase() === 'BNB' ||
                params.token.toUpperCase() === 'AVAX';

            // Check if account is Halo chip account
            const selectedAccount = await this.walletService.getSelectedAccount();
            const isHaloChipAccount = selectedAccount?.isChipAccount && selectedAccount?.chipInfo;

            if (isNative && isHaloChipAccount) {
                // Handle ETH transfer with Halo chip (show QR code)
                const result = await this.handleHaloETHTransfer({
                    amount: params.amount,
                    recipient: params.recipient,
                    chainId: params.chainId,
                });

                if (result.success) {
                    this.showSuccessMessage('Transfer successful!', result.transactionHash, params.chainId);
                    await this.loadUnifiedBalances();
                    this.state.showSendScreen = false;
                    this.render();
                } else {
                    throw new Error(result.error || 'Transfer failed');
                }
            } else if (isNative) {
                // Use Nexus SDK for native token transfers (cross-chain support)
                const result = await transferService.transfer({
                    token: params.token,
                    amount: params.amount,
                    chainId: params.chainId,
                    recipient: params.recipient as `0x${string}`,
                    sourceChains: params.sourceChains,
                });

                if (result.success) {
                    this.showSuccessMessage('Transfer successful!', result.transactionHash, params.chainId);
                    await this.loadUnifiedBalances();
                    this.state.showSendScreen = false;
                    this.render();
                } else {
                    throw new Error(result.error || 'Transfer failed');
                }
            } else {
                // ERC20 token transfer - call token contract directly
                const result = await this.handleERC20Transfer({
                    token: params.token,
                    amount: params.amount,
                    recipient: params.recipient,
                    chainId: params.chainId,
                });

                if (result.success) {
                    this.showSuccessMessage('Transfer successful!', result.transactionHash, params.chainId);
                    await this.loadUnifiedBalances();
                    this.state.showSendScreen = false;
                    this.render();
                } else {
                    throw new Error(result.error || 'Transfer failed');
                }
            }
        } catch (error: any) {
            console.error('[PopupApp] Transfer error:', error);
            throw error;
        }
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

    private async handleERC20Transfer(params: {
        token: string;
        amount: string;
        recipient: string;
        chainId: number;
    }): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
        try {
            // Get token info from unified balance
            const asset = this.state.unifiedBalanceData?.assets.find(a => a.symbol === params.token);
            if (!asset) {
                throw new Error(`Token ${params.token} not found in balance`);
            }

            // Get token contract address
            // Try to get from asset, or use a known address mapping
            let tokenContractAddress: string | null = null;

            // Check if asset has contractAddress property
            if ((asset as any).contractAddress) {
                tokenContractAddress = (asset as any).contractAddress;
            } else if ((asset as any).address) {
                tokenContractAddress = (asset as any).address;
            } else {
                // Import and use the helper function
                const { getTokenContractAddress } = await import('./utils/erc20');
                tokenContractAddress = getTokenContractAddress(params.token, params.chainId);
            }

            if (!tokenContractAddress) {
                throw new Error(`Token contract address not found for ${params.token} on chain ${params.chainId}`);
            }

            // Get token decimals (default to 18)
            const decimals = (asset as any).decimals || 18;

            // Dynamically import ethers to avoid bundling conflicts
            const ethersModule = await loadEthers();
            const ethers = ethersModule.ethers || ethersModule.default || ethersModule;

            // Convert amount to token's smallest unit
            const amountBigInt = ethers.parseUnits(params.amount, decimals);

            // Encode ERC20 transfer function call
            const { encodeERC20Transfer } = await import('./utils/erc20');
            const data = encodeERC20Transfer(params.recipient, amountBigInt);

            // Get selected account
            const selectedAccount = await this.walletService.getSelectedAccount();
            if (!selectedAccount) {
                throw new Error('No account selected');
            }

            // Get provider - create it from the network
            const networks = await this.walletService.getNetworks();
            const network = networks.find(n => n.chainId === params.chainId) || networks[0];
            if (!network || !network.rpcUrl) {
                throw new Error(`Network not found for chainId ${params.chainId}`);
            }
            const provider = new ethers.JsonRpcProvider(network.rpcUrl);

            // Build transaction
            const transaction = {
                to: tokenContractAddress,
                value: '0x0', // No ETH sent for ERC20 transfers
                data: data,
                chainId: params.chainId,
            };

            // Estimate gas
            let gasLimit: bigint;
            try {
                const estimatedGas = await provider.estimateGas({
                    ...transaction,
                    from: selectedAccount.address,
                });
                // Add 20% buffer
                gasLimit = (estimatedGas * BigInt(120)) / BigInt(100);
            } catch (error) {
                console.warn('[handleERC20Transfer] Gas estimation failed, using default:', error);
                // Default gas limit for ERC20 transfer is usually around 65,000
                gasLimit = BigInt(65000);
            }

            // Get gas price
            const feeData = await provider.getFeeData();
            const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice;
            const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || undefined;

            // Build final transaction
            const finalTransaction: any = {
                ...transaction,
                gasLimit: gasLimit,
                maxFeePerGas: maxFeePerGas,
                maxPriorityFeePerGas: maxPriorityFeePerGas,
            };

            // Sign and send transaction via background script
            const response = await chrome.runtime.sendMessage({
                type: 'SEND_TRANSACTION',
                transaction: {
                    to: finalTransaction.to,
                    value: finalTransaction.value,
                    data: finalTransaction.data,
                    gasLimit: finalTransaction.gasLimit.toString(),
                    maxFeePerGas: finalTransaction.maxFeePerGas?.toString(),
                    maxPriorityFeePerGas: finalTransaction.maxPriorityFeePerGas?.toString(),
                    chainId: finalTransaction.chainId,
                },
                address: selectedAccount.address,
            });

            if (chrome.runtime.lastError) {
                throw new Error(chrome.runtime.lastError.message);
            }

            if (response?.success && response?.transactionHash) {
                return {
                    success: true,
                    transactionHash: response.transactionHash,
                };
            } else {
                throw new Error(response?.error || 'Transaction failed');
            }
        } catch (error: any) {
            console.error('[PopupApp] ERC20 transfer error:', error);
            return {
                success: false,
                error: error.message || 'ERC20 transfer failed',
            };
        }
    }

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
        // TODO: Replace with proper toast/notification component
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--r-green-default);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;

        if (transactionHash) {
            // Truncate hash: first 4 and last 4 characters (e.g., "0x12...abcd")
            const truncatedHash = transactionHash.length > 8
                ? `${transactionHash.slice(0, 4)}...${transactionHash.slice(-4)}`
                : transactionHash;

            // Determine chain ID for Etherscan URL (use provided chainId or default to mainnet)
            const txChainId = chainId || this.state.selectedAccount?.chainId || 1;
            const etherscanUrl = this.getEtherscanUrl(txChainId, transactionHash);

            // Create simple text with clickable hash, matching the style of other success messages
            const hashLink = document.createElement('a');
            hashLink.href = etherscanUrl;
            hashLink.target = '_blank';
            hashLink.rel = 'noopener noreferrer';
            hashLink.style.cssText = `
                color: white;
                text-decoration: underline;
                cursor: pointer;
            `;
            hashLink.textContent = truncatedHash;

            notification.textContent = `${message} `;
            notification.appendChild(hashLink);
        } else {
            notification.textContent = message;
        }

        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    private getEtherscanUrl(chainId: number, txHash: string): string {
        // Map chain IDs to block explorers
        const explorers: Record<number, string> = {
            1: 'https://etherscan.io/tx', // Ethereum Mainnet
            11155111: 'https://sepolia.etherscan.io/tx', // Sepolia
            5: 'https://goerli.etherscan.io/tx', // Goerli
            137: 'https://polygonscan.com/tx', // Polygon
            42161: 'https://arbiscan.io/tx', // Arbitrum
            10: 'https://optimistic.etherscan.io/tx', // Optimism
            56: 'https://bscscan.com/tx', // BSC
            43114: 'https://snowtrace.io/tx', // Avalanche
        };

        const baseUrl = explorers[chainId] || explorers[1]; // Default to Etherscan
        return `${baseUrl}/${txHash}`;
    }

    private showErrorMessage(message: string) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--r-red-default);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    private showAccountSelector() {
        // Check if modal already exists (to avoid re-animation)
        const modalExists = document.getElementById('account-selector-overlay') !== null;
        this.state.showAccountSelector = true;
        // Only animate on first render
        this.state.accountSelectorFirstRender = !modalExists;
        this.render();
        // Mark that we've rendered once
        if (this.state.accountSelectorFirstRender) {
            setTimeout(() => {
                this.state.accountSelectorFirstRender = false;
            }, 350); // After animation completes
        } else {
            this.state.accountSelectorFirstRender = false;
        }
    }

    private hideAccountSelector() {
        this.state.showAccountSelector = false;
        // Reset first render flag when closing so it animates on next open
        this.state.accountSelectorFirstRender = true;
        this.render();
    }

    private async handleSelectAccount(account: any) {
        await this.walletService.selectAccount(account.address);
        this.state.selectedAccount = account;
        this.hideAccountSelector();

        // Reinitialize unified balance for the new account
        await this.initializeUnifiedBalance(account);

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
        this.state.showAddWalletModal = true;
        this.render();
    }

    private hideAddWalletModal() {
        this.state.showAddWalletModal = false;
        this.render();
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
        this.state.showCreateAccountForm = true;
        this.render();
    }

    private hideCreateAccountForm() {
        this.state.showCreateAccountForm = false;
        this.render();
    }

    private showImportAccountForm() {
        this.state.showImportAccountForm = true;
        this.render();
    }

    private hideImportAccountForm() {
        this.state.showImportAccountForm = false;
        this.render();
    }

    private showCreateMultisigForm() {
        this.state.showCreateMultisigForm = true;
        this.render();
    }

    private hideCreateMultisigForm() {
        this.state.showCreateMultisigForm = false;
        this.render();
    }

    private showHaloChipNameForm() {
        this.state.showHaloChipNameForm = true;
        this.render();
    }

    private hideHaloChipNameForm() {
        this.state.showHaloChipNameForm = false;
        this.render();
    }

    private showFireflyNameForm() {
        this.state.showFireflyNameForm = true;
        this.render();
    }

    private hideFireflyNameForm() {
        this.state.showFireflyNameForm = false;
        this.render();
    }

    private showAddContactModal() {
        this.state.showAddContactModal = true;
        this.render();
        this.attachContactModalListeners();
    }

    private hideAddContactModal() {
        this.state.showAddContactModal = false;
        this.render();
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
                const address = addressInput?.value?.trim() || '';
                const nameInput = document.getElementById('contact-name-input') as HTMLInputElement;
                const name = nameInput?.value?.trim() || undefined;

                if (!address) {
                    if (errorDiv) {
                        errorDiv.textContent = 'Please enter an address or ENS name';
                        errorDiv.style.display = 'block';
                    }
                    return;
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
                    const provider = new ethers.JsonRpcProvider('https://mainnet.infura.io/v3/db2e296c0a0f475fb6c3a3281a0c39d6');
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

            const response = await this.haloService.createMultisigAccount(numChips, threshold, name);

            await this.loadAccounts();
            this.state.unlocked = true;
            this.render();

            this.showSuccessMessage(`✅ Multisig Account Created! Address: ${formatAddress(response.account.address)}`);
        } catch (error: any) {
            this.showErrorMessage('Failed to create multisig account: ' + (error.message || 'Unknown error'));
        }
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
        this.state.showSecurityConfirm = true;
        this.render();
    }

    private hideSecurityConfirm() {
        this.state.showSecurityConfirm = false;
        this.state.pendingHaloLink = undefined;
        this.render();
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
        this.state.showSettingsMenu = false;
        this.render();
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
        // TODO: Implement chain selector modal
        console.log('Chain change requested');
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
        this.state.showDeleteAccountModal = false;
        this.state.accountToDelete = undefined;
        this.render();
    }

    private handleEditAccount(account: any) {
        // Check if modal already exists and if it's the same account (to avoid re-animation)
        const modalExists = document.getElementById('account-detail-overlay') !== null;
        const isSameAccount = this.state.accountToEdit?.address?.toLowerCase() === account.address?.toLowerCase();
        
        this.state.accountToEdit = account;
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
        this.state.showAccountDetailModal = false;
        this.state.accountToEdit = undefined;
        // Reset first render flag when closing so it animates on next open
        this.state.accountDetailModalFirstRender = true;
        this.render();
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
        // Check if modal is already showing (to avoid re-animation)
        const wasShowing = this.state.showPrivateKeyModal;
        const modalExists = document.getElementById('private-key-modal-overlay') !== null;
        // Check if password modal is currently showing (before it gets closed)
        const passwordModalWasShowing = this.state.showPasswordModal || document.getElementById('password-modal-overlay') !== null;

        this.state.privateKeyToShow = privateKey;
        this.state.showPrivateKeyModal = true;
        this.state.privateKeyRevealed = false; // Start with key hidden

        // If password modal was just showing, don't animate (smooth transition)
        // Also respect the shouldAnimate parameter
        const actuallyAnimate = shouldAnimate && !passwordModalWasShowing;

        if (!wasShowing && !modalExists) {
            // First time showing - allow animation only if requested and password modal isn't showing
            this.state.privateKeyModalFirstRender = actuallyAnimate;
            this.render();
            // Mark that we've rendered once
            if (actuallyAnimate) {
                setTimeout(() => {
                    this.state.privateKeyModalFirstRender = false;
                }, 350); // After animation completes
            } else {
                // If no animation, mark immediately
                this.state.privateKeyModalFirstRender = false;
            }
        } else if (wasShowing || modalExists) {
            // If modal was already showing or exists in DOM, just update the content without re-rendering
            const showKeyBtn = document.getElementById('show-private-key-btn');
            const keyContainer = document.getElementById('private-key-container');
            const copyBtn = document.getElementById('private-key-copy-btn');
            const keyText = document.getElementById('private-key-text');

            if (showKeyBtn) showKeyBtn.style.display = 'block';
            if (keyContainer) keyContainer.style.display = 'none';
            if (copyBtn) copyBtn.style.display = 'none';
            if (keyText) keyText.textContent = '';

            // Update state without animation
            this.state.privateKeyModalFirstRender = false;
        }
    }

    private hidePrivateKeyModal() {
        this.state.showPrivateKeyModal = false;
        this.state.privateKeyToShow = undefined;
        this.state.privateKeyRevealed = false;
        // Reset first render flag when closing so it animates on next open
        this.state.privateKeyModalFirstRender = true;
        this.render();
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
        // Check if modal already exists or if we're transitioning from another modal
        const modalExists = document.getElementById('password-modal-overlay') !== null;
        const accountDetailModalShowing = this.state.showAccountDetailModal ||
            document.getElementById('account-detail-overlay') !== null;

        this.state.passwordModalConfig = { title, message, onConfirm };
        this.state.showPasswordModal = true;
        // Don't animate if modal exists or we're transitioning from account detail modal
        this.state.passwordModalFirstRender = !modalExists && !accountDetailModalShowing;
        this.render();
        // Mark that we've rendered once
        if (this.state.passwordModalFirstRender) {
            setTimeout(() => {
                this.state.passwordModalFirstRender = false;
            }, 350); // After animation completes
        } else {
            this.state.passwordModalFirstRender = false;
        }
        this.attachPasswordModalListeners();
    }

    private hidePasswordModal() {
        this.state.showPasswordModal = false;
        this.state.passwordModalConfig = undefined;
        // Reset first render flag when closing so it animates on next open (if not transitioning)
        this.state.passwordModalFirstRender = true;
        this.render();
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
        try {
            this.state.delegationLoading = true;
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
            
            if (response && response.success) {
                this.state.delegationStatus = response.delegationStatus;
                this.state.delegationLoading = false;
                // Update only the delegation section, not the entire modal
                this.updateDelegationSection();
                console.log('[checkDelegationStatus] Delegation status updated:', response.delegationStatus);
            } else {
                const errorMsg = response?.error || 'Unknown error checking delegation';
                console.error('[checkDelegationStatus] Failed to check delegation:', errorMsg);
                this.state.delegationLoading = false;
                this.updateDelegationSection();
            }
        } catch (error: any) {
            console.error('[checkDelegationStatus] Error checking delegation:', error);
            this.state.delegationLoading = false;
            this.updateDelegationSection();
        }
    }

    /**
     * Update only the delegation section in the Account Detail modal
     * without re-rendering the entire modal (prevents slide-up animation)
     */
    private updateDelegationSection() {
        if (!this.state.showAccountDetailModal || !this.state.accountToEdit) {
            return;
        }

        // Try both possible IDs for compatibility
        const smartAccountSection = document.getElementById('smart-account-section') || 
                                   document.getElementById('smart-account-upgrade-section');
        if (smartAccountSection && this.state.accountToEdit && !this.state.accountToEdit.isWatchOnly) {
            smartAccountSection.innerHTML = renderSmartAccountUpgrade(
                this.state.accountToEdit,
                this.state.delegationStatus,
                this.state.delegationLoading,
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
                ? (this.state.delegationContractAddress || '0x63c0c19a282a1b52b07dd5a65b58948a07dae32b')
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

    /**
     * Attach listeners for the smart account upgrade/reset buttons
     */
    private attachDelegationListeners() {
        const upgradeBtn = document.getElementById('upgrade-smart-account-btn');
        const resetBtn = document.getElementById('reset-delegation-btn');
        
        // Remove existing listeners to prevent duplicates
        const newUpgradeBtn = upgradeBtn?.cloneNode(true);
        const newResetBtn = resetBtn?.cloneNode(true);
        
        if (upgradeBtn && newUpgradeBtn) {
            upgradeBtn.parentNode?.replaceChild(newUpgradeBtn, upgradeBtn);
            newUpgradeBtn.addEventListener('click', () => {
                this.showDelegationModal(true);
            });
        }
        
        if (resetBtn && newResetBtn) {
            resetBtn.parentNode?.replaceChild(newResetBtn, resetBtn);
            newResetBtn.addEventListener('click', () => {
                this.showDelegationModal(false);
            });
        }
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
        if (!this.state.accountToEdit) return;
        
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
            const address = this.state.accountToEdit.address;
            const messageType = this.state.delegationModalIsUpgrade ? 'UPGRADE_TO_SMART_ACCOUNT' : 'CLEAR_DELEGATION';
            
            // Get the contract address from input if upgrade
            let contractAddress = '0x0000000000000000000000000000000000000000';
            if (this.state.delegationModalIsUpgrade) {
                const delegatorInput = document.getElementById('delegator-address-input') as HTMLInputElement;
                contractAddress = delegatorInput?.value || this.state.delegationContractAddress || '0x63c0c19a282a1b52b07dd5a65b58948a07dae32b';
                
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
                address: address,
                chainId: this.state.selectedNetwork,
                contractAddress: contractAddress
            });
            
            if (response.success && response.transactionHash) {
                this.state.delegationTransactionHash = response.transactionHash;
                this.hideDelegationModal();
                // Refresh delegation status after a delay
                setTimeout(() => {
                    this.checkDelegationStatus(address);
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
            
            // Handle delegator selection dropdown
            if (delegatorSelect && this.state.delegationModalIsUpgrade) {
                delegatorSelect.addEventListener('change', (e) => {
                    const selectedValue = (e.target as HTMLSelectElement).value;
                    if (selectedValue !== 'custom') {
                        delegatorInput.value = selectedValue;
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
                                56: 'bscscan.com'
                            };
                            const domain = chainMap[this.state.selectedNetwork] || 'etherscan.io';
                            etherscanLink.href = `https://${domain}/address/${selectedValue}#code`;
                        }
                    }
                });
            }
            
            // Handle custom address input
            if (delegatorInput && this.state.delegationModalIsUpgrade) {
                delegatorInput.addEventListener('input', (e) => {
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
                
                // When user selects "custom", focus the input
                if (delegatorSelect) {
                    delegatorSelect.addEventListener('change', (e) => {
                        if ((e.target as HTMLSelectElement).value === 'custom') {
                            delegatorInput.focus();
                        }
                    });
                }
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

