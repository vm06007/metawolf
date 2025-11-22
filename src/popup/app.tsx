import { WalletService } from './services/wallet-service';
import { HaloService } from './services/halo-service';
import { renderLockScreen } from './components/LockScreen';
import { ConnectedDApp } from './components/CurrentConnection';
import { EthPriceData } from './components/EthPricePanel';
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
    };

    private walletService: WalletService;
    private haloService: HaloService;

    constructor() {
        this.walletService = new WalletService();
        this.haloService = new HaloService();
    }

    async init() {
        try {
            if (!chrome.runtime || !chrome.runtime.id) {
                return;
            }
            await this.wakeServiceWorker();
            await new Promise(resolve => setTimeout(resolve, 200));
            await Promise.all([
                this.loadAccounts(),
                this.loadNetworks(),
                this.loadConnectedDApp(),
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
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length > 0 && tabs[0].url) {
                try {
                    const url = new URL(tabs[0].url);
                    const origin = url.origin;
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
            this.state.connectedDApp = null;
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

        if (this.state.hasPassword && !this.state.unlocked) {
            app.innerHTML = renderLockScreen(
                this.state.accounts.length > 0,
                this.state.password,
                this.state.errorMessage
            );
            this.attachLockScreenListeners();
            return;
        }

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
            if (this.state.errorMessage) {
                this.state.errorMessage = undefined;
                this.render();
            }
        });

        createFirstBtn?.addEventListener('click', () => {
            this.state.unlocked = true;
            this.showAddWalletModal();
        });

        importFirstBtn?.addEventListener('click', () => {
            this.state.unlocked = true;
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
        await this.loadConnectedDApp(); // Reload connected DApp in case account changed
        this.render();
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

    private handleSettings() {
        this.state.showSettingsMenu = true;
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

            const checkbox1 = document.getElementById('delete-confirm-1') as HTMLInputElement;
            const checkbox2 = document.getElementById('delete-confirm-2') as HTMLInputElement;
            const passwordInput = document.getElementById('delete-account-password') as HTMLInputElement;
            const errorDiv = document.getElementById('delete-account-password-error') as HTMLDivElement;

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
            await this.walletService.deleteAccount(this.state.accountToDelete.address);
            await this.loadAccounts();
            await this.loadConnectedDApp();
            this.render();
        } catch (error: any) {
            this.showErrorMessage('Failed to delete account: ' + (error.message || 'Unknown error'));
        }
    }
}
