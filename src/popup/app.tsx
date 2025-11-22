import { WalletService } from './services/wallet-service';
import { HaloService } from './services/halo-service';
import { formatAddress, getDisplayName } from './utils/account';
import { renderDashboardHeader } from './components/DashboardHeader';
import { renderDashboardPanel, DEFAULT_PANEL_ITEMS } from './components/DashboardPanel';
import { renderLockScreen } from './components/LockScreen';
import { renderAccountSelectorModal } from './components/AccountSelectorModal';
import { renderAccountSidebar } from './components/AccountSidebar';
import { renderTransactionList, Transaction } from './components/TransactionList';
import { renderAddWalletModal, ADD_WALLET_OPTIONS } from './components/AddWalletModal';
import { renderAddContactModal } from './components/AddContactModal';
import { renderCurrentConnection, ConnectedDApp } from './components/CurrentConnection';
import { renderCreateAccountForm } from './components/CreateAccountForm';
import { renderImportAccountForm } from './components/ImportAccountForm';
import { renderCreateMultisigForm } from './components/CreateMultisigForm';
import { renderHaloChipNameForm } from './components/HaloChipNameForm';
import { renderSecurityConfirmModal } from './components/SecurityConfirmModal';
import { renderDeleteAccountModal } from './components/DeleteAccountModal';
import { renderSettingsMenu } from './components/SettingsMenu';
import { renderEthPricePanel, EthPriceData } from './components/EthPricePanel';
import { ethPriceService } from './services/eth-price-service';
import { ethers } from 'ethers';

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
    showAddWalletModal: boolean;
    showCreateAccountForm: boolean;
    showImportAccountForm: boolean;
    showCreateMultisigForm: boolean;
    showHaloChipNameForm: boolean;
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
        showAddWalletModal: false,
        showCreateAccountForm: false,
        showImportAccountForm: false,
        showCreateMultisigForm: false,
        showHaloChipNameForm: false,
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
    };

    private walletService: WalletService;
    private haloService: HaloService;

    constructor() {
        this.walletService = new WalletService();
        this.haloService = new HaloService();
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
            this.state.balance = '0.00'; // TODO: Load actual balance
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
                this.state.sidebarCollapsed
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
                true
            )}
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
                false
            )}
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
                (account) => this.handleDeleteAccount(account)
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
        `;
        }

        this.attachDashboardListeners();
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
        document.getElementById('panel-send')?.addEventListener('click', () => console.log('Send clicked'));
        document.getElementById('panel-receive')?.addEventListener('click', () => console.log('Receive clicked'));
        document.getElementById('panel-swap')?.addEventListener('click', () => console.log('Swap clicked'));
        document.getElementById('panel-bridge')?.addEventListener('click', () => console.log('Bridge clicked'));
        document.getElementById('panel-transactions')?.addEventListener('click', () => console.log('Transactions clicked'));
        document.getElementById('panel-approvals')?.addEventListener('click', () => console.log('Approvals clicked'));
        document.getElementById('panel-settings')?.addEventListener('click', () => this.handleSettings());
        document.getElementById('panel-nft')?.addEventListener('click', () => console.log('NFT clicked'));
        document.getElementById('panel-ecology')?.addEventListener('click', () => console.log('Ecology clicked'));
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

    private showSuccessMessage(message: string) {
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
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
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
        this.state.showAccountSelector = true;
        this.render();
    }

    private hideAccountSelector() {
        this.state.showAccountSelector = false;
        this.render();
    }

    private async handleSelectAccount(account: any) {
        await this.walletService.selectAccount(account.address);
        this.state.selectedAccount = account;
        this.hideAccountSelector();
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
                const checksumAddress = ethers.getAddress(this.state.selectedAccount.address);
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
                if (ethers.isAddress(address)) {
                    return;
                }

                // Try to resolve ENS
                try {
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
    }

    hideDeleteAccountModal() {
        this.state.showDeleteAccountModal = false;
        this.state.accountToDelete = undefined;
        this.render();
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

            this.hideDeleteAccountModal();

            // Delete the account
            await this.walletService.deleteAccount(this.state.accountToDelete.address);

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

