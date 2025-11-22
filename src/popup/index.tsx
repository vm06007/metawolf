import { ethers } from 'ethers';

interface AppState {
    unlocked: boolean;
    accounts: any[];
    selectedAccount?: string;
    balance?: string;
    networks: any[];
    selectedNetwork: number;
    loading: boolean;
    password: string;
}

class PopupApp {
    private state: AppState = {
        unlocked: false,
        accounts: [],
        selectedAccount: undefined,
        networks: [],
        selectedNetwork: 1,
        loading: true,
        password: '',
    };

    async init() {
        try {
            // First, verify extension runtime is available
            console.log('[Init] Initializing popup...');

            if (!chrome.runtime || !chrome.runtime.id) {
                console.error('[Init] Extension runtime not available!');
                alert('Extension runtime not available. Please reload the extension.');
                return;
            }

            console.log('[Init] Extension runtime ID:', chrome.runtime.id);

            // Wake up service worker by sending a ping - try multiple times
            let serviceWorkerAwake = false;
            for (let attempt = 0; attempt < 5; attempt++) {
                try {
                    console.log(`[Init] Attempting to wake service worker (${attempt + 1}/5)...`);
                    const pingResponse = await Promise.race([
                        chrome.runtime.sendMessage({ type: 'PING' }),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('PING timeout')), 3000)
                        )
                    ]);
                    if (pingResponse && (pingResponse.success || pingResponse.pong)) {
                        console.log('[Init] Service worker is awake! Response:', pingResponse);
                        serviceWorkerAwake = true;
                        break;
                    }
                } catch (error: any) {
                    console.warn(`[Init] Wake-up attempt ${attempt + 1} failed:`, error.message);
                    if (attempt < 4) {
                        // Wait longer between attempts
                        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                    }
                }
            }

            if (!serviceWorkerAwake) {
                console.error('[Init] Service worker did not wake up after 5 attempts');
                console.error('[Init] User needs to manually wake service worker');
                // Don't throw - just show warning and continue
            }

            // Wait a bit for background script to initialize
            await new Promise(resolve => setTimeout(resolve, 200));

            // Run initialization steps with individual timeouts
            const initSteps = [
                () => this.checkUnlocked(),
                () => this.loadAccounts(),
                () => this.loadNetworks(),
            ];

            for (const step of initSteps) {
                try {
                    await Promise.race([
                        step(),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Step timeout')), 3000)
                        )
                    ]);
                } catch (error) {
                    console.warn('Init step failed, continuing:', error);
                    // Continue to next step
                }
            }
        } catch (error: any) {
            console.error('Error during initialization:', error);
            // Don't show alert - just log and continue
        } finally {
            // Always set loading to false and render - even if errors occurred
            console.log('[Init] Finally block executing, setting loading to false');
            this.state.loading = false;
            console.log('[Init] Initialization complete, calling render...');

            // Use setTimeout to ensure render happens even if there are pending promises
            setTimeout(() => {
                console.log('[Init] Executing render in setTimeout');
                this.render();
            }, 0);
        }
    }

    // Helper to send message with retry and timeout
    async sendMessageWithRetry(message: any, retries = 5, timeoutMs = 5000): Promise<any> {
        // First, try to wake service worker if it's a non-PING message
        if (message.type !== 'PING') {
            try {
                await Promise.race([
                    chrome.runtime.sendMessage({ type: 'PING' }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
                ]);
            } catch (error) {
                console.warn('[sendMessage] Could not wake service worker with PING');
            }
        }

        for (let i = 0; i < retries; i++) {
            try {
                // Add timeout to prevent hanging
                const response = await Promise.race([
                    chrome.runtime.sendMessage(message),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Message timeout')), timeoutMs)
                    )
                ]);

                if (chrome.runtime.lastError) {
                    if (i < retries - 1) {
                        // Wait longer between retries
                        await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
                        continue;
                    }
                    throw new Error(chrome.runtime.lastError.message);
                }

                if (response !== undefined) {
                    return response;
                }

                // If no response, retry
                if (i < retries - 1) {
                    console.warn(`[sendMessage] No response, retrying (${i + 1}/${retries})...`);
                    await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
                    continue;
                }
            } catch (error: any) {
                console.warn(`[sendMessage] Message attempt ${i + 1} failed:`, error.message);
                if (i < retries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
                    continue;
                }
                throw error;
            }
        }

        throw new Error('No response after all retries');
    }

    async checkUnlocked() {
        try {
            const response = await this.sendMessageWithRetry({
                type: 'CHECK_UNLOCKED',
            }, 2, 2000); // Shorter timeout for initial checks
            this.state.unlocked = response?.unlocked || false;
            console.log('Unlock status:', this.state.unlocked);
        } catch (error: any) {
            console.error('Error checking unlock status:', error);
            this.state.unlocked = false; // Default to locked on error
        }
    }

    async loadAccounts() {
        try {
            const response = await this.sendMessageWithRetry({
                type: 'GET_ACCOUNTS',
            }, 2, 2000);
            if (response && response.success) {
                this.state.accounts = response.accounts || [];
                console.log('Loaded accounts:', this.state.accounts.length);

                const selectedResponse = await this.sendMessageWithRetry({
                    type: 'GET_SELECTED_ACCOUNT',
                }, 2, 2000);
                if (selectedResponse && selectedResponse.success && selectedResponse.account) {
                    this.state.selectedAccount = selectedResponse.account.address;
                    await this.loadBalance(selectedResponse.account.address);
                }
            } else {
                console.warn('Failed to load accounts, response:', response);
                this.state.accounts = []; // Default to empty
            }
        } catch (error: any) {
            console.error('Error loading accounts:', error);
            this.state.accounts = []; // Default to empty on error
        }
    }

    async loadNetworks() {
        try {
            const response = await this.sendMessageWithRetry({
                type: 'GET_NETWORKS',
            }, 2, 2000);
            if (response && response.success) {
                this.state.networks = response.networks || [];
                if (this.state.networks.length > 0) {
                    this.state.selectedNetwork = this.state.networks[0].chainId;
                }
                console.log('Loaded networks:', this.state.networks.length);
            } else {
                // Default networks if response fails
                this.state.networks = [{
                    chainId: 1,
                    name: 'Ethereum Mainnet',
                    rpcUrl: 'https://eth.llamarpc.com',
                    currency: { name: 'Ether', symbol: 'ETH', decimals: 18 }
                }];
                this.state.selectedNetwork = 1;
            }
        } catch (error: any) {
            console.error('Error loading networks:', error);
            // Default networks on error
            this.state.networks = [{
                chainId: 1,
                name: 'Ethereum Mainnet',
                rpcUrl: 'https://eth.llamarpc.com',
                currency: { name: 'Ether', symbol: 'ETH', decimals: 18 }
            }];
            this.state.selectedNetwork = 1;
        }
    }

    async loadBalance(address: string) {
        try {
            // For demo, we'll just show the address
            // In production, fetch actual balance from RPC
            this.state.balance = '0.0 ETH';
        } catch (error) {
            this.state.balance = '0.0 ETH';
        }
    }

    async unlock() {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'UNLOCK',
                password: this.state.password,
            });
            if (chrome.runtime.lastError) {
                alert('Error: ' + chrome.runtime.lastError.message);
                return;
            }
            if (response && response.success) {
                this.state.unlocked = true;
                this.state.password = '';
                this.render();
            } else {
                alert('Failed to unlock wallet');
            }
        } catch (error) {
            console.error('Error unlocking:', error);
            alert('Failed to unlock wallet');
        }
    }

    async lock() {
        try {
            await chrome.runtime.sendMessage({ type: 'LOCK' });
            if (chrome.runtime.lastError) {
                console.error('Error:', chrome.runtime.lastError.message);
            }
            this.state.unlocked = false;
            this.render();
        } catch (error) {
            console.error('Error locking:', error);
            this.state.unlocked = false;
            this.render();
        }
    }

    async createAccount() {
        try {
            const name = prompt('Account name (optional):');
            if (name === null) return; // User cancelled

            console.log('[CreateAccount] Attempting to create account...');

            // Try to wake service worker - send PING which should wake it up
            let serviceWorkerAwake = false;
            for (let i = 0; i < 5; i++) {
                try {
                    console.log('[CreateAccount] Attempting to wake service worker (attempt', i + 1, '/5)...');
                    const pingResponse = await Promise.race([
                        chrome.runtime.sendMessage({ type: 'PING' }),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
                    ]);
                    if (pingResponse && (pingResponse.success || pingResponse.pong)) {
                        console.log('[CreateAccount] Service worker awake! Response:', pingResponse);
                        serviceWorkerAwake = true;
                        break;
                    }
                } catch (error: any) {
                    console.warn('[CreateAccount] PING attempt', i + 1, 'failed:', error.message);
                    if (i < 4) {
                        // Wait longer between attempts
                        await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
                    }
                }
            }

            if (!serviceWorkerAwake) {
                // Check if extension runtime is available
                const runtimeAvailable = chrome.runtime && chrome.runtime.id;
                const errorMsg = runtimeAvailable
                    ? 'Service worker is inactive and not waking up.\n\nPlease:\n1. Go to chrome://extensions/\n2. Find "Wolfy Wallet" → Click "Details"\n3. Click "service worker" link to wake it up\n4. Try again'
                    : 'Extension runtime not available. Please reload the extension.';
                throw new Error(errorMsg);
            }

            const response = await this.sendMessageWithRetry({
                type: 'CREATE_ACCOUNT',
                name: name || undefined,
            }, 5, 3000); // More retries, longer timeout

            console.log('[CreateAccount] Response:', response);

            if (!response) {
                throw new Error('No response from background script. Please reload the extension and try again.');
            }

            if (response.success) {
                await this.loadAccounts();
                this.state.unlocked = true; // Unlock after creating account
                this.render();
                return true;
            } else {
                throw new Error(response.error || 'Failed to create account');
            }
        } catch (error: any) {
            console.error('[CreateAccount] Error:', error);
            throw error; // Re-throw so caller can handle it
        }
    }

    async importAccount() {
        try {
            const privateKey = prompt('Enter private key:');
            if (!privateKey || privateKey.trim() === '') {
                return false; // User cancelled or empty
            }

            const name = prompt('Account name (optional):');
            if (name === null) return false; // User cancelled

            const response = await this.sendMessageWithRetry({
                type: 'IMPORT_ACCOUNT',
                privateKey: privateKey.trim(),
                name: name || undefined,
            });

            if (!response) {
                throw new Error('No response from background script');
            }

            if (response.success) {
                await this.loadAccounts();
                this.render();
                return true;
            } else {
                throw new Error(response.error || 'Failed to import account');
            }
        } catch (error: any) {
            console.error('Error importing account:', error);
            throw error; // Re-throw so caller can handle it
        }
    }

    async selectAccount(address: string) {
        try {
            await chrome.runtime.sendMessage({
                type: 'SET_SELECTED_ACCOUNT',
                address: address,
            });
            if (chrome.runtime.lastError) {
                console.error('Error:', chrome.runtime.lastError.message);
            }
            this.state.selectedAccount = address;
            await this.loadBalance(address);
            this.render();
        } catch (error) {
            console.error('Error selecting account:', error);
        }
    }

    async linkHalo() {
        try {
            if (!this.state.selectedAccount) {
                alert('Please select an account first');
                return;
            }

            // Show linking progress UI (lazy load to avoid blocking init)
            let HaloUI: any;
            let removeProgress: () => void;
            let removeTapPrompt: () => void;

            try {
                const haloModule = await import('./halo-ui.js');
                HaloUI = haloModule.HaloUI;
                removeProgress = HaloUI.showLinkingProgress();
                removeTapPrompt = HaloUI.showTapPrompt('Tap your HaLo chip to link account');
            } catch (error) {
                console.warn('Could not load HaloUI, using simple prompts:', error);
                // Fallback to simple prompts
                removeProgress = () => { };
                removeTapPrompt = () => { };
                alert('Please tap your HaLo chip to link account');
            }

            try {
                const response = await this.sendMessageWithRetry({
                    type: 'HALO_LINK_ACCOUNT',
                    address: this.state.selectedAccount,
                    slot: 1,
                });

                removeProgress();
                removeTapPrompt();

                if (!response) {
                    throw new Error('No response from background script');
                }

                if (response.success) {
                    await this.loadAccounts();
                    this.render();
                    alert('Account linked to HaLo chip successfully!\n\nAddress: ' + response.keyInfo?.chipAddress || this.state.selectedAccount);
                } else {
                    alert('Failed to link account: ' + (response.error || 'Unknown error') + '\n\nMake sure your HaLo chip is present and tap it when prompted.');
                }
            } catch (error: any) {
                removeProgress();
                removeTapPrompt();
                throw error;
            }
        } catch (error: any) {
            console.error('Error linking HaLo:', error);
            alert('Failed to link account: ' + (error.message || 'Unknown error') + '\n\nMake sure NFC is enabled and your HaLo chip is ready.');
        }
    }

    async switchNetwork(chainId: number) {
        try {
            await chrome.runtime.sendMessage({
                type: 'SET_NETWORK',
                chainId: chainId,
            });
            if (chrome.runtime.lastError) {
                console.error('Error:', chrome.runtime.lastError.message);
            }
            this.state.selectedNetwork = chainId;
            this.render();
        } catch (error) {
            console.error('Error switching network:', error);
        }
    }

    render() {
        const app = document.getElementById('app');
        if (!app) {
            console.error('App element not found!');
            return;
        }

        console.log('[Render] Called, loading:', this.state.loading, 'unlocked:', this.state.unlocked, 'accounts:', this.state.accounts.length);

        // Show loading screen while initializing (but with a max time)
        if (this.state.loading) {
            app.innerHTML = '<div class="loading">Loading...</div>';
            console.log('[Render] Still loading, showing loading screen');
            return;
        }

        console.log('[Render] Proceeding to render UI...');

        if (!this.state.unlocked) {
            // Show welcome/unlock screen
            app.innerHTML = `
                <div class="lock-screen">
                    <h1 style="margin-bottom: 10px;">🐺 Wolfy Wallet</h1>
                    <p style="margin-bottom: 20px; color: #666;">
                        ${this.state.accounts.length === 0
                    ? 'Welcome! Create or import a wallet to get started.'
                    : 'Enter password to unlock your wallet'}
                    </p>
                    ${this.state.accounts.length === 0 ? `
                        <button class="button button-primary" id="create-first-btn" style="margin-bottom: 10px;">
                            Create New Wallet
                        </button>
                        <button class="button button-secondary" id="import-first-btn">
                            Import Wallet
                        </button>
                    ` : `
                        <input
                            type="password"
                            id="password-input"
                            placeholder="Password"
                            value="${this.state.password}"
                        />
                        <button class="button button-primary" id="unlock-btn">Unlock</button>
                    `}
                </div>
            `;

            const passwordInput = document.getElementById(
                'password-input'
            ) as HTMLInputElement;
            const unlockBtn = document.getElementById('unlock-btn');

            if (passwordInput) {
                passwordInput.addEventListener('input', (e) => {
                    this.state.password = (e.target as HTMLInputElement).value;
                });
                passwordInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.unlock();
                    }
                });
            }

            unlockBtn?.addEventListener('click', () => this.unlock());

            // Handle welcome screen buttons
            const createFirstBtn = document.getElementById('create-first-btn');
            const importFirstBtn = document.getElementById('import-first-btn');

            createFirstBtn?.addEventListener('click', async () => {
                try {
                    console.log('[Welcome] Create account button clicked');
                    await this.createAccount();
                    // Account creation already handles unlock and render
                    console.log('[Welcome] Account created successfully');
                } catch (error: any) {
                    console.error('[Welcome] Error creating account:', error);
                    const errorMsg = error.message || 'Unknown error';
                    if (errorMsg.includes('timeout') || errorMsg.includes('No response')) {
                        alert('Failed to create account: Background script not responding.\n\n' +
                            'Please:\n' +
                            '1. Reload the extension (chrome://extensions)\n' +
                            '2. Check service worker is running\n' +
                            '3. Try again');
                    } else {
                        alert('Failed to create account: ' + errorMsg);
                    }
                }
            });

            importFirstBtn?.addEventListener('click', async () => {
                try {
                    await this.importAccount();
                    // After importing account, unlock and show main UI
                    this.state.unlocked = true;
                    await this.loadAccounts(); // Reload to get the new account
                    this.render();
                } catch (error: any) {
                    console.error('Error importing account:', error);
                    alert('Failed to import account: ' + (error.message || 'Unknown error'));
                }
            });

            return;
        }

        const selectedAccount = this.state.accounts.find(
            (acc) => acc.address === this.state.selectedAccount
        );

        app.innerHTML = `
            <div class="container">
                <div class="header">
                    <h1>Wolfy Wallet</h1>
                    <button class="button button-secondary" id="lock-btn" style="width: auto; padding: 6px 12px;">Lock</button>
                </div>

                ${selectedAccount ? `
                    <div class="account-section">
                        <div class="account-address">${this.formatAddress(
            selectedAccount.address
        )}</div>
                        <div class="balance">${this.state.balance || '0.0 ETH'}</div>
                        <button class="button button-primary" id="link-halo-btn">
                            ${selectedAccount.haloLinked ? '🔗 HaLo Linked' : '🔗 Link HaLo Chip'}
                        </button>
                    </div>
                ` : ''}

                <div class="network-selector">
                    <select id="network-select">
                        ${this.state.networks
                .map(
                    (net) => `
                            <option value="${net.chainId}" ${net.chainId === this.state.selectedNetwork
                            ? 'selected'
                            : ''
                        }>
                                ${net.name}
                            </option>
                        `
                )
                .join('')}
                    </select>
                </div>

                <div class="accounts-list">
                    <h3 style="margin-bottom: 10px; font-size: 14px;">Accounts</h3>
                    ${this.state.accounts
                .map(
                    (acc) => `
                        <div class="account-item ${acc.address === this.state.selectedAccount
                            ? 'selected'
                            : ''
                        }" data-address="${acc.address}">
                            <div>
                                <div style="font-weight: 500; margin-bottom: 4px;">
                                    ${acc.name || 'Account'}
                                    ${acc.haloLinked ? '<span class="halo-status halo-linked">HaLo</span>' : '<span class="halo-status halo-unlinked">No HaLo</span>'}
                                </div>
                                <div style="font-size: 12px; color: #666; font-family: monospace;">
                                    ${this.formatAddress(acc.address)}
                                </div>
                            </div>
                        </div>
                    `
                )
                .join('')}
                </div>

                <button class="button button-primary" id="create-account-btn">
                    Create Account
                </button>
                <button class="button button-secondary" id="import-account-btn">
                    Import Account
                </button>
            </div>
        `;

        // Attach event listeners
        document
            .getElementById('lock-btn')
            ?.addEventListener('click', () => this.lock());
        document
            .getElementById('create-account-btn')
            ?.addEventListener('click', () => this.createAccount());
        document
            .getElementById('import-account-btn')
            ?.addEventListener('click', () => this.importAccount());
        document
            .getElementById('link-halo-btn')
            ?.addEventListener('click', () => this.linkHalo());
        document
            .getElementById('network-select')
            ?.addEventListener('change', (e) => {
                this.switchNetwork(
                    parseInt((e.target as HTMLSelectElement).value)
                );
            });

        // Account selection
        document.querySelectorAll('.account-item').forEach((item) => {
            item.addEventListener('click', () => {
                const address = item.getAttribute('data-address');
                if (address) {
                    this.selectAccount(address);
                }
            });
        });
    }

    formatAddress(address: string): string {
        if (!address) return '';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
}

// Initialize app
const app = new PopupApp();

// Add safety timeout - always render after 2 seconds even if init hangs
setTimeout(() => {
    if (app.state.loading) {
        console.warn('[Safety] Initialization timeout after 2s - forcing render');
        app.state.loading = false;
        app.state.unlocked = false;
        app.state.accounts = [];
        app.state.networks = [{
            chainId: 1,
            name: 'Ethereum Mainnet',
            rpcUrl: 'https://eth.llamarpc.com',
            currency: { name: 'Ether', symbol: 'ETH', decimals: 18 }
        }];
        app.state.selectedNetwork = 1;
        app.render();
    }
}, 2000);

// Start initialization (don't await - let it run in background)
console.log('[App] Starting initialization...');
app.init().catch((error) => {
    console.error('[App] Init error:', error);
    // Force render on error
    app.state.loading = false;
    app.render();
});

