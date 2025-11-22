import { renderWalletSelectorModal, EIP6963ProviderInfo } from '../popup/components/WalletSelectorModal';
import { WalletService } from '../popup/services/wallet-service';
import { renderConnectModal, Account } from './components/ConnectModal';
import { renderSignatureModal, SignatureRequest } from './components/SignatureModal';
import { renderTransactionModal, TransactionRequest } from './components/TransactionModal';
import { renderTransactionSuccess } from './components/TransactionSuccess';
import { renderBatchedCallsModal, BatchedCallsRequest, BatchedCallsSimulation } from './components/BatchedCallsModal';

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
    private signatureRequest?: SignatureRequest;
    private transactionRequest?: TransactionRequest;
    private batchedCallsRequest?: BatchedCallsRequest;
    private transactionSuccess?: { hash: string; chainId: number };
    private showAdvancedSettings: boolean = false;
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
            // Parse query parameters
            const urlParams = new URLSearchParams(window.location.search);
            const type = urlParams.get('type');
            const requestId = urlParams.get('requestId');

            // Check if this is a signature request
            if (type === 'sign' && requestId) {
                await this.initSignatureRequest(requestId);
                return;
            }
            
            // Check if this is a transaction request
            if (type === 'transaction' && requestId) {
                await this.initTransactionRequest(requestId);
                return;
            }

            // Check if this is a batched calls request
            if (type === 'batched-calls' && requestId) {
                await this.initBatchedCallsRequest(requestId);
                return;
            }

            // Otherwise, handle connection request
            // Get pending connection from storage (includes tabId)
            const storage = await chrome.storage.local.get('pendingConnection');
            const pending = storage.pendingConnection;

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

            await this.render();
        } catch (error) {
            console.error('Error initializing notification:', error);
            this.renderError();
        }
    }

    async initSignatureRequest(requestId: string) {
        try {
            // Get pending signature from storage
            const storage = await chrome.storage.local.get('pendingSignature');
            const pendingSignature = storage.pendingSignature;

            if (!pendingSignature || pendingSignature.id !== requestId) {
                console.error('Signature request not found:', requestId);
                this.renderError('Signature request not found');
                return;
            }

            this.signatureRequest = pendingSignature as SignatureRequest;
            await this.renderSignatureModal();
        } catch (error) {
            console.error('Error initializing signature request:', error);
            this.renderError('Error loading signature request');
        }
    }

    async initTransactionRequest(requestId: string) {
        try {
            // Get pending transaction from storage
            const storage = await chrome.storage.local.get('pendingTransaction');
            const pendingTransaction = storage.pendingTransaction;

            if (!pendingTransaction || pendingTransaction.id !== requestId) {
                console.error('Transaction request not found:', requestId);
                this.renderError('Transaction request not found');
                return;
            }

            this.transactionRequest = pendingTransaction as TransactionRequest;
            this.renderTransactionModal();
        } catch (error) {
            console.error('Error initializing transaction request:', error);
            this.renderError('Error loading transaction request');
        }
    }

    async render() {
        const app = document.getElementById('app');
        if (!app) return;

        // If signature request, render signature modal
        if (this.signatureRequest) {
            await this.renderSignatureModal();
            return;
        }
        
        // If transaction success, render success screen
        if (this.transactionSuccess) {
            this.renderTransactionSuccess();
            return;
        }
        
        // If transaction request, render transaction modal
        if (this.transactionRequest) {
            this.renderTransactionModal();
            return;
        }

        // If batched calls request, render batched calls modal
        if (this.batchedCallsRequest) {
            this.renderBatchedCallsModal();
            return;
        }

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

    async renderSignatureModal() {
        const app = document.getElementById('app');
        if (!app || !this.signatureRequest) return;

        app.innerHTML = await renderSignatureModal(
            this.signatureRequest,
            () => this.handleApproveSignature(),
            () => this.handleRejectSignature()
        );

        // Attach listeners
        document.getElementById('approve-signature-btn')?.addEventListener('click', () => {
            this.handleApproveSignature();
        });
        document.getElementById('reject-signature-btn')?.addEventListener('click', () => {
            this.handleRejectSignature();
        });
    }

    renderTransactionModal() {
        const app = document.getElementById('app');
        if (!app || !this.transactionRequest) return;

        app.innerHTML = renderTransactionModal(
            this.transactionRequest,
            () => this.handleApproveTransaction(),
            () => this.handleRejectTransaction(),
            undefined, // simulationResult - can be added later
            this.showAdvancedSettings,
            () => {
                this.showAdvancedSettings = !this.showAdvancedSettings;
                this.renderTransactionModal();
            },
            (value: string) => {
                // Update gas limit in transaction request
                if (this.transactionRequest) {
                    this.transactionRequest.transaction.gasLimit = value;
                }
            },
            (value: string) => {
                // Update nonce in transaction request
                if (this.transactionRequest) {
                    this.transactionRequest.transaction.nonce = parseInt(value) || undefined;
                }
            }
        );

        // Attach listeners
        document.getElementById('approve-transaction-btn')?.addEventListener('click', () => {
            this.handleApproveTransaction();
        });
        document.getElementById('reject-transaction-btn')?.addEventListener('click', () => {
            this.handleRejectTransaction();
        });
        document.getElementById('advanced-settings-btn')?.addEventListener('click', () => {
            this.showAdvancedSettings = true;
            this.renderTransactionModal();
        });
        document.getElementById('close-advanced-btn')?.addEventListener('click', () => {
            this.showAdvancedSettings = false;
            this.renderTransactionModal();
        });
        const gasLimitInput = document.getElementById('gas-limit-input') as HTMLInputElement;
        if (gasLimitInput) {
            gasLimitInput.addEventListener('change', (e) => {
                const value = (e.target as HTMLInputElement).value;
                if (this.transactionRequest) {
                    this.transactionRequest.transaction.gasLimit = value;
                }
            });
        }
        const nonceInput = document.getElementById('nonce-input') as HTMLInputElement;
        if (nonceInput) {
            nonceInput.addEventListener('change', (e) => {
                const value = (e.target as HTMLInputElement).value;
                if (this.transactionRequest) {
                    this.transactionRequest.transaction.nonce = parseInt(value) || undefined;
                }
            });
        }
    }

    renderTransactionSuccess() {
        const app = document.getElementById('app');
        if (!app || !this.transactionSuccess) return;

        app.innerHTML = renderTransactionSuccess(
            this.transactionSuccess.hash,
            this.transactionSuccess.chainId,
            () => this.handleCloseSuccess()
        );

        // Attach listener
        document.getElementById('close-success-btn')?.addEventListener('click', () => {
            this.handleCloseSuccess();
        });
    }

    async pollTransactionStatus(txHash: string, chainId: number) {
        console.log('[Notification] Starting status polling for tx:', txHash);
        
        // Poll every 2 seconds for up to 2 minutes
        const maxAttempts = 60; // 2 minutes
        let attempts = 0;
        
        const poll = async () => {
            attempts++;
            console.log(`[Notification] Polling attempt ${attempts}/${maxAttempts}`);
            
            try {
                const response = await chrome.runtime.sendMessage({
                    type: 'GET_TRANSACTION_RECEIPT',
                    txHash: txHash,
                    chainId: chainId,
                });
                
                if (response?.success && response?.receipt) {
                    console.log('[Notification] Transaction confirmed!', response.receipt);
                    // Update status in UI
                    const statusEl = document.getElementById('tx-status');
                    if (statusEl) {
                        if (response.receipt.status === 1) {
                            statusEl.innerHTML = `
                                <div style="color: var(--r-green-default); font-weight: 500;">
                                    ✓ Confirmed in block ${response.receipt.blockNumber}
                                </div>
                            `;
                        } else {
                            statusEl.innerHTML = `
                                <div style="color: var(--r-red-default); font-weight: 500;">
                                    ✗ Transaction failed
                                </div>
                            `;
                        }
                    }
                    return; // Stop polling
                } else if (attempts < maxAttempts) {
                    // Continue polling
                    setTimeout(poll, 2000);
                } else {
                    console.log('[Notification] Polling timeout after', maxAttempts, 'attempts');
                    const statusEl = document.getElementById('tx-status');
                    if (statusEl) {
                        statusEl.innerHTML = `
                            <div style="color: var(--r-neutral-body);">
                                Transaction pending...
                            </div>
                        `;
                    }
                }
            } catch (error) {
                console.error('[Notification] Error polling status:', error);
                if (attempts < maxAttempts) {
                    setTimeout(poll, 2000);
                }
            }
        };
        
        // Start polling
        setTimeout(poll, 2000); // Wait 2 seconds before first poll
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

    renderError(message?: string) {
        const app = document.getElementById('app');
        if (!app) return;
        app.innerHTML = `
            <div style="
                padding: 40px 20px;
                text-align: center;
                color: var(--r-neutral-foot);
            ">
                <div>${message || 'Error loading request'}</div>
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

    async handleApproveSignature() {
        try {
            if (!this.signatureRequest) {
                console.error('No signature request to approve');
                return;
            }

            const approveBtn = document.getElementById('approve-signature-btn') as HTMLButtonElement;
            if (approveBtn) {
                approveBtn.disabled = true;
                approveBtn.textContent = 'Signing...';
            }

            // Send approval to background script
            const response = await chrome.runtime.sendMessage({
                type: 'APPROVE_SIGNATURE',
                requestId: this.signatureRequest.id,
            });

            if (response?.success) {
                window.close();
            } else {
                alert('Failed to sign message: ' + (response?.error || 'Unknown error'));
                if (approveBtn) {
                    approveBtn.disabled = false;
                    approveBtn.textContent = 'Sign';
                }
            }
        } catch (error) {
            console.error('Error approving signature:', error);
            alert('Failed to sign message: ' + (error as Error).message);
            const approveBtn = document.getElementById('approve-signature-btn') as HTMLButtonElement;
            if (approveBtn) {
                approveBtn.disabled = false;
                approveBtn.textContent = 'Sign';
            }
        }
    }

    handleRejectSignature() {
        if (!this.signatureRequest) {
            window.close();
            return;
        }

        // Send rejection to background script
        chrome.runtime.sendMessage({
            type: 'REJECT_SIGNATURE',
            requestId: this.signatureRequest.id,
        }).catch((error) => {
            console.error('Error rejecting signature:', error);
        });

        window.close();
    }

    async handleApproveTransaction() {
        try {
            if (!this.transactionRequest) {
                console.error('No transaction request to approve');
                return;
            }

            const approveBtn = document.getElementById('approve-transaction-btn') as HTMLButtonElement;
            if (approveBtn) {
                approveBtn.disabled = true;
                approveBtn.textContent = 'Confirming...';
            }

            // Send approval to background script with updated transaction (including advanced settings)
            const response = await chrome.runtime.sendMessage({
                type: 'APPROVE_TRANSACTION',
                requestId: this.transactionRequest.id,
                transaction: this.transactionRequest.transaction, // Send updated transaction
            });

            if (response?.success && response?.transactionHash) {
                // Show success screen with transaction hash
                const chainId = this.transactionRequest.transaction.chainId || 1;
                this.transactionSuccess = {
                    hash: response.transactionHash,
                    chainId: chainId,
                };
                this.transactionRequest = undefined; // Clear request
                this.renderTransactionSuccess();
            } else {
                alert('Failed to send transaction: ' + (response?.error || 'Unknown error'));
                if (approveBtn) {
                    approveBtn.disabled = false;
                    approveBtn.textContent = 'Confirm';
                }
            }
        } catch (error) {
            console.error('Error approving transaction:', error);
            alert('Failed to send transaction: ' + (error as Error).message);
            const approveBtn = document.getElementById('approve-transaction-btn') as HTMLButtonElement;
            if (approveBtn) {
                approveBtn.disabled = false;
                approveBtn.textContent = 'Confirm';
            }
        }
    }

    handleRejectTransaction() {
        if (!this.transactionRequest) {
            window.close();
            return;
        }

        // Send rejection to background script
        chrome.runtime.sendMessage({
            type: 'REJECT_TRANSACTION',
            requestId: this.transactionRequest.id,
        }).catch((error) => {
            console.error('Error rejecting transaction:', error);
        });

        window.close();
    }

    handleCloseSuccess() {
        window.close();
    }

    async initBatchedCallsRequest(requestId: string) {
        try {
            // Get pending batched calls from storage
            const storage = await chrome.storage.local.get('pendingBatchedCalls');
            const pendingBatchedCalls = storage.pendingBatchedCalls;

            if (!pendingBatchedCalls || pendingBatchedCalls.id !== requestId) {
                console.error('Batched calls request not found:', requestId);
                this.renderError('Batched calls request not found');
                return;
            }

            this.batchedCallsRequest = pendingBatchedCalls as BatchedCallsRequest;
            this.renderBatchedCallsModal();
        } catch (error) {
            console.error('Error initializing batched calls request:', error);
            this.renderError('Error loading batched calls request');
        }
    }

    renderBatchedCallsModal() {
        const app = document.getElementById('app');
        if (!app || !this.batchedCallsRequest) return;

        // TODO: Add simulation support later
        const simulation: BatchedCallsSimulation | undefined = undefined;

        app.innerHTML = renderBatchedCallsModal(
            this.batchedCallsRequest,
            () => this.handleApproveBatchedCalls(),
            () => this.handleRejectBatchedCalls(),
            simulation
        );

        // Attach listeners
        document.getElementById('approve-batched-calls-btn')?.addEventListener('click', () => {
            this.handleApproveBatchedCalls();
        });
        document.getElementById('reject-batched-calls-btn')?.addEventListener('click', () => {
            this.handleRejectBatchedCalls();
        });
    }

    async handleApproveBatchedCalls() {
        try {
            if (!this.batchedCallsRequest) {
                console.error('No batched calls request to approve');
                return;
            }

            const approveBtn = document.getElementById('approve-batched-calls-btn') as HTMLButtonElement;
            if (approveBtn) {
                approveBtn.disabled = true;
                approveBtn.textContent = 'Confirming...';
            }

            // Send approval to background script
            const response = await chrome.runtime.sendMessage({
                type: 'APPROVE_BATCHED_CALLS',
                requestId: this.batchedCallsRequest.id,
            });

            if (response?.success && (response?.transactionHash || response?.id)) {
                // Show success screen with actual transaction hash
                // Convert chainId from hex string to number if needed
                let chainId: number = 1; // Default to mainnet
                if (this.batchedCallsRequest.chainId) {
                    if (typeof this.batchedCallsRequest.chainId === 'string' && this.batchedCallsRequest.chainId.startsWith('0x')) {
                        chainId = parseInt(this.batchedCallsRequest.chainId, 16);
                    } else if (typeof this.batchedCallsRequest.chainId === 'number') {
                        chainId = this.batchedCallsRequest.chainId;
                    }
                }
                
                const txHash = response.transactionHash || response.id;
                
                // Validate it's a real transaction hash (starts with 0x and is 66 chars)
                if (txHash && txHash.startsWith('0x') && txHash.length === 66) {
                    console.log('[Notification] Transaction hash:', txHash);
                    console.log('[Notification] ChainId:', chainId);
                    
                    this.transactionSuccess = {
                        hash: txHash,
                        chainId: chainId,
                    };
                    this.batchedCallsRequest = undefined; // Clear request
                    this.renderTransactionSuccess();
                    
                    // Start polling for confirmation status
                    this.pollTransactionStatus(txHash, chainId);
                } else {
                    // If we have multiple hashes, show the first one
                    const results = response.results || [];
                    if (results.length > 0 && results[0] && results[0].startsWith('0x')) {
                        this.transactionSuccess = {
                            hash: results[0],
                            chainId: chainId,
                        };
                        this.batchedCallsRequest = undefined;
                        this.renderTransactionSuccess();
                        
                        // Start polling for confirmation status
                        this.pollTransactionStatus(results[0], chainId);
                    } else {
                        alert('Transaction submitted but no valid transaction hash received. Check your wallet for transaction status.');
                        window.close();
                    }
                }
            } else {
                alert('Failed to send batched calls: ' + (response?.error || 'Unknown error'));
                if (approveBtn) {
                    approveBtn.disabled = false;
                    approveBtn.textContent = 'Confirm';
                }
            }
        } catch (error) {
            console.error('Error approving batched calls:', error);
            alert('Failed to send batched calls: ' + (error as Error).message);
            const approveBtn = document.getElementById('approve-batched-calls-btn') as HTMLButtonElement;
            if (approveBtn) {
                approveBtn.disabled = false;
                approveBtn.textContent = 'Confirm';
            }
        }
    }

    handleRejectBatchedCalls() {
        if (!this.batchedCallsRequest) {
            window.close();
            return;
        }

        // Send rejection to background script
        chrome.runtime.sendMessage({
            type: 'REJECT_BATCHED_CALLS',
            requestId: this.batchedCallsRequest.id,
        }).catch((error) => {
            console.error('Error rejecting batched calls:', error);
        });

        window.close();
    }
}

// Initialize app
const app = new NotificationApp();

