import { renderWalletSelectorModal, EIP6963ProviderInfo } from '../popup/components/WalletSelectorModal';
import { WalletService } from '../popup/services/wallet-service';
import { renderConnectModal, Account } from './components/ConnectModal';

interface ConnectionRequest {
    origin: string;
    name: string;
    icon: string;
    providers: EIP6963ProviderInfo[];
    tabId?: number;
}

class NotificationApp {
    private walletService: WalletService;
    private connectionRequest?: ConnectionRequest;
    private selectedProvider?: EIP6963ProviderInfo;
    private showWalletSelector: boolean = false;
    private accounts: Account[] = [];
    private selectedAccount: Account | null = null;

    constructor() {
        this.walletService = new WalletService();
        this.init();
    }

    async init() {
        try {
            // Get pending connection from storage (includes tabId)
            const storage = await chrome.storage.local.get('pendingConnection');
            const pending = storage.pendingConnection;

            // Parse query parameters
            const urlParams = new URLSearchParams(window.location.search);
            const origin = urlParams.get('origin') || pending?.origin || '';
            const name = urlParams.get('name') || pending?.name || 'Unknown DApp';
            const icon = urlParams.get('icon') || pending?.icon || '';
            const providersJson = urlParams.get('providers') || JSON.stringify(pending?.providers || []);
            const providers = JSON.parse(decodeURIComponent(providersJson)) as EIP6963ProviderInfo[];

            this.connectionRequest = {
                origin,
                name,
                icon,
                providers,
                tabId: pending?.tabId,
            };

            // Load accounts
            const accounts = await this.walletService.getAccounts();
            this.accounts = accounts.map((acc: any) => ({
                address: acc.address,
                name: acc.name,
                isChipAccount: acc.isChipAccount,
                multisig: acc.multisig,
                haloLinked: acc.haloLinked,
            }));

            // Get selected account
            const selected = await this.walletService.getSelectedAccount();
            if (selected) {
                this.selectedAccount = {
                    address: selected.address,
                    name: selected.name,
                    isChipAccount: selected.isChipAccount,
                    multisig: selected.multisig,
                    haloLinked: selected.haloLinked,
                };
            } else if (this.accounts.length > 0) {
                this.selectedAccount = this.accounts[0];
            }

            // Check if we should show wallet selector (if other wallets detected)
            if (providers.length > 0) {
                this.showWalletSelector = true;
            }

            this.render();
        } catch (error) {
            console.error('Error initializing notification:', error);
            this.renderError();
        }
    }

    render() {
        const app = document.getElementById('app');
        if (!app) return;

        if (this.showWalletSelector && this.connectionRequest) {
            app.innerHTML = `
                <div class="notification-container">
                    ${renderWalletSelectorModal(
                this.connectionRequest.providers,
                (provider) => this.handleWalletSelect(provider),
                () => this.handleReject(),
                true
            )}
                </div>
            `;
            this.attachListeners();
        } else {
            // Show connect confirmation directly
            this.renderConnectConfirmation();
        }
    }

    renderConnectConfirmation() {
        const app = document.getElementById('app');
        if (!app || !this.connectionRequest) return;

        app.innerHTML = renderConnectModal(
            this.connectionRequest.name,
            this.connectionRequest.origin,
            this.connectionRequest.icon,
            this.accounts,
            this.selectedAccount,
            (account) => this.handleSelectAccount(account),
            () => this.handleConnect(),
            () => this.handleReject(),
            true // showAccountSelector
        );

        // Attach account selector listeners
        document.querySelectorAll('.connect-account-option').forEach(option => {
            option.addEventListener('click', () => {
                const address = option.getAttribute('data-address');
                const account = this.accounts.find(acc => acc.address.toLowerCase() === address?.toLowerCase());
                if (account) {
                    this.handleSelectAccount(account);
                }
            });
        });

        document.getElementById('connect-btn')?.addEventListener('click', () => this.handleConnect());
        document.getElementById('cancel-btn')?.addEventListener('click', () => this.handleReject());
    }

    handleSelectAccount(account: Account) {
        this.selectedAccount = account;
        // Re-render to update selection
        this.renderConnectConfirmation();
    }

    renderError() {
        const app = document.getElementById('app');
        if (!app) return;
        app.innerHTML = `
            <div style="
                padding: 40px 20px;
                text-align: center;
                color: var(--r-neutral-foot);
            ">
                <div>Error loading connection request</div>
            </div>
        `;
    }

    attachListeners() {
        // Wallet selector modal listeners
        document.getElementById('wallet-selector-overlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.handleReject();
            }
        });

        document.getElementById('wallet-selector-close')?.addEventListener('click', () => this.handleReject());

        document.querySelectorAll('.wallet-option').forEach(option => {
            option.addEventListener('click', () => {
                const walletId = option.getAttribute('data-wallet-id');
                const rdns = option.getAttribute('data-rdns');

                if (walletId === 'wolfy') {
                    this.handleWalletSelect(undefined);
                } else {
                    const provider = this.connectionRequest?.providers.find(p => p.uuid === walletId);
                    if (provider) {
                        this.handleWalletSelect(provider);
                    }
                }
            });
        });
    }

    async handleWalletSelect(provider?: EIP6963ProviderInfo) {
        this.selectedProvider = provider;
        this.showWalletSelector = false;

        if (provider) {
            // User selected another wallet - switch provider
            await this.handleSwitchProvider(provider);
        } else {
            // User selected Wolfy - show connect confirmation
            this.renderConnectConfirmation();
        }
    }

    async handleSwitchProvider(provider: EIP6963ProviderInfo) {
        try {
            // Store provider preference for this origin
            if (this.connectionRequest) {
                await chrome.storage.local.set({
                    [`dapp_provider_${this.connectionRequest.origin}`]: {
                        rdns: provider.rdns,
                        name: provider.name,
                    }
                });
            }

            // Close window and reject connection
            window.close();
        } catch (error) {
            console.error('Error switching provider:', error);
        }
    }

    async handleConnect() {
        try {
            if (!this.connectionRequest || !this.selectedAccount) {
                console.error('Missing connection request or selected account');
                return;
            }

            const accountAddress = this.selectedAccount.address;
            const accountAddresses = [accountAddress];

            // Store connection permission in background
            await chrome.runtime.sendMessage({
                type: 'APPROVE_CONNECTION',
                origin: this.connectionRequest.origin,
                account: accountAddress,
            });

            // Store connection in local storage
            const connections = await chrome.storage.local.get('dapp_connections') || {};
            const dappConnections = connections.dapp_connections || {};
            dappConnections[this.connectionRequest.origin] = {
                name: this.connectionRequest.name,
                icon: this.connectionRequest.icon,
                account: accountAddress,
                connectedAt: Date.now(),
            };
            await chrome.storage.local.set({
                dapp_connections: dappConnections,
                pendingConnection: null
            });

            // Send response to content script so it can respond to inpage script
            if (this.connectionRequest.tabId) {
                try {
                    await chrome.tabs.sendMessage(this.connectionRequest.tabId, {
                        type: 'CONNECT_APPROVED',
                        origin: this.connectionRequest.origin,
                        accounts: accountAddresses,
                    });
                    console.log('[Notification] Sent CONNECT_APPROVED to content script with accounts:', accountAddresses);
                } catch (error) {
                    console.error('[Notification] Error sending to content script:', error);
                    // Tab might be closed, but we still want to close the window
                }
            }

            window.close();
        } catch (error) {
            console.error('Error connecting:', error);
            // Still close window on error
            window.close();
        }
    }

    handleReject() {
        // Send rejection back
        if (this.connectionRequest) {
            chrome.runtime.sendMessage({
                type: 'REJECT_CONNECTION',
                origin: this.connectionRequest.origin,
            });

            if (this.connectionRequest.tabId) {
                chrome.tabs.sendMessage(this.connectionRequest.tabId, {
                    type: 'CONNECT_REJECTED',
                }).catch(() => {
                    // Tab might be closed, ignore
                });
            }
        }
        window.close();
    }
}

// Initialize app
const app = new NotificationApp();

