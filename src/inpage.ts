/**
 * In-page script - Provides window.ethereum API to dApps
 * This file will be bundled and injected into web pages
 */

interface EthereumProvider {
    isWolfy?: boolean;
    isMetaMask?: boolean;
    chainId?: string;
    networkVersion?: string;
    selectedAddress?: string | null;
    request(args: { method: string; params?: any[] }): Promise<any>;
    send?(method: string, params?: any[]): any;
    sendAsync?(payload: any, callback: (error: any, response: any) => void): void;
    on(event: string, handler: (...args: any[]) => void): void;
    off?(event: string, handler: (...args: any[]) => void): void;
    removeListener(event: string, handler: (...args: any[]) => void): void;
    emit?(event: string, ...args: any[]): void;
    isConnected(): boolean;
    _state?: {
        accounts: string[] | null;
        isConnected: boolean;
        isUnlocked: boolean;
        initialized: boolean;
    };
    _metamask?: {
        isUnlocked(): Promise<boolean>;
    };
}

class WolfyProvider implements EthereumProvider {
    isWolfy = true;
    isRabby = true; // Identify as Rabby for compatibility
    isMetaMask = true; // For wagmi compatibility
    chainId: string = '0x1'; // Default to Ethereum mainnet
    networkVersion: string = '1';
    selectedAddress: string | null = null;
    private messageId = 0;
    private listeners: Map<string, Set<Function>> = new Map();
    private eventListeners: Map<string, Set<Function>> = new Map();

    _state = {
        accounts: null as string[] | null,
        isConnected: true,
        isUnlocked: true,
        initialized: true,
    };

    _metamask = {
        isUnlocked: async () => {
            return true; // We'll check this properly later
        },
    };

    constructor() {
        // Listen for responses from content script via postMessage
        // This runs in MAIN world, content script runs in isolated world
        window.addEventListener('message', (event) => {
            // Only accept messages from same window
            if (event.source !== window) return;

            // Handle account change notifications
            if (event.data && event.data.type === 'WOLFY_ACCOUNT_CHANGED') {
                const accounts = event.data.accounts || [];
                const accountAddresses = Array.isArray(accounts)
                    ? accounts.map((acc: any) => typeof acc === 'string' ? acc : (acc.address || acc))
                    : [];

                // Update provider state
                const previousAccounts = this._state.accounts;
                this.selectedAddress = accountAddresses[0] || null;
                this._state.accounts = accountAddresses;

                // Emit accountsChanged event if accounts actually changed
                if (JSON.stringify(previousAccounts) !== JSON.stringify(accountAddresses)) {
                    console.log('[Wolfy Inpage] Account changed, emitting accountsChanged event:', accountAddresses);
                    this.emit('accountsChanged', accountAddresses);
                }
                return;
            }

            // Handle responses - check for exact type or ends with _RESPONSE (but not multiple _RESPONSE)
            if (event.data && event.data.type &&
                (event.data.type === 'WOLFY_REQUEST_RESPONSE' ||
                    (event.data.type.endsWith('_RESPONSE') && !event.data.type.includes('_RESPONSE_RESPONSE')))) {

                const messageId = event.data.id?.toString();
                if (!messageId) {
                    // Ignore messages without ID to prevent loops
                    return;
                }

                const listeners = this.listeners.get(messageId);
                if (listeners && listeners.size > 0) {
                    // Process listeners and immediately delete to prevent reprocessing
                    const listenersArray = Array.from(listeners);
                    this.listeners.delete(messageId); // Delete immediately to prevent loops

                    listenersArray.forEach((fn) => {
                        try {
                            fn(event.data.response);
                        } catch (error) {
                            console.error('[Wolfy] Error in listener:', error);
                        }
                    });
                }
                // If no listeners, message was already processed - silently ignore to prevent spam
            }
        });

        // Debug: Log when provider is created
        console.log('[Wolfy] Provider initialized in MAIN world');
    }

    async request(args: { method: string; params?: any[] }): Promise<any> {
        // Handle standard Ethereum provider methods
        if (args.method === 'eth_accounts') {
            return this.eth_accounts();
        }
        if (args.method === 'eth_requestAccounts') {
            return this.eth_requestAccounts();
        }
        if (args.method === 'eth_chainId') {
            return this.eth_chainId();
        }
        if (args.method === 'net_version') {
            return this.networkVersion;
        }
        if (args.method === 'eth_sendTransaction') {
            return this.eth_sendTransaction(args.params![0]);
        }
        if (args.method === 'eth_signTransaction') {
            return this.eth_signTransaction(args.params![0]);
        }
        if (args.method === 'personal_sign') {
            return this.personal_sign(args.params![0], args.params![1]);
        }
        if (args.method === 'eth_signTypedData_v4') {
            return this.eth_signTypedData_v4(args.params![0], args.params![1]);
        }
        if (args.method === 'eth_signTypedData') {
            return this.eth_signTypedData_v4(args.params![0], args.params![1]);
        }
        if (args.method === 'wallet_switchEthereumChain') {
            // Handle chain switching
            const chainId = args.params?.[0]?.chainId;
            if (chainId) {
                this.chainId = chainId;
                this.networkVersion = parseInt(chainId, 16).toString();
                this.emit('chainChanged', chainId);
                return null;
            }
        }
        if (args.method === 'wallet_addEthereumChain') {
            // Handle adding chains
            return null;
        }
        if (args.method === 'wallet_sendCalls') {
            return this.wallet_sendCalls(args.params![0]);
        }
        if (args.method === 'wallet_getCallsStatus') {
            return this.wallet_getCallsStatus(args.params![0]);
        }
        if (args.method === 'wallet_getCapabilities') {
            return this.wallet_getCapabilities(args.params![0]);
        }
        if (args.method === 'eth_getBlockByNumber') {
            // Forward to background script
            return new Promise((resolve, reject) => {
                const id = ++this.messageId;
                const messageId = id.toString();

                const handler = (response: any) => {
                    if (response.success) {
                        resolve(response.data || response.result);
                    } else {
                        reject(new Error(response.error || 'Request failed'));
                    }
                };

                if (!this.listeners.has(messageId)) {
                    this.listeners.set(messageId, new Set());
                }
                this.listeners.get(messageId)!.add(handler);

                window.postMessage(
                    {
                        type: 'WOLFY_REQUEST',
                        id: messageId,
                        method: args.method,
                        params: args.params || [],
                    },
                    '*'
                );

                setTimeout(() => {
                    const listeners = this.listeners.get(messageId);
                    if (listeners) {
                        listeners.delete(handler);
                        if (listeners.size === 0) {
                            this.listeners.delete(messageId);
                        }
                    }
                    reject(new Error('Request timeout'));
                }, 30000);
            });
        }

        // Fallback to message passing
        return new Promise((resolve, reject) => {
            const id = ++this.messageId;
            const messageId = id;

            // Store listener for response
            const handler = (response: any) => {
                if (response.success) {
                    resolve(response.data || response);
                } else {
                    reject(new Error(response.error || 'Request failed'));
                }
            };

            if (!this.listeners.has(messageId.toString())) {
                this.listeners.set(messageId.toString(), new Set());
            }
            this.listeners.get(messageId.toString())!.add(handler);

            // Send message to content script
            window.postMessage(
                {
                    type: 'WOLFY_REQUEST',
                    id: messageId,
                    method: args.method,
                    params: args.params || [],
                },
                '*'
            );

            // Timeout after 30 seconds
            setTimeout(() => {
                const listeners = this.listeners.get(messageId.toString());
                if (listeners) {
                    listeners.delete(handler);
                    if (listeners.size === 0) {
                        this.listeners.delete(messageId.toString());
                    }
                }
                reject(new Error('Request timeout'));
            }, 30000);
        });
    }

    on(event: string, handler: Function): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event)!.add(handler);
    }

    off(event: string, handler: Function): void {
        this.removeListener(event, handler);
    }

    removeListener(event: string, handler: Function): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.delete(handler);
            if (listeners.size === 0) {
                this.eventListeners.delete(event);
            }
        }
    }

    emit(event: string, ...args: any[]): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach((fn) => {
                try {
                    fn(...args);
                } catch (error) {
                    console.error('Error in event listener:', error);
                }
            });
        }
    }

    isConnected(): boolean {
        return this._state.isConnected;
    }

    // Legacy send method for compatibility
    send(method: string, params?: any[]): any {
        if (typeof method === 'string') {
            return this.request({ method, params: params || [] }).then((result) => ({
                id: undefined,
                jsonrpc: '2.0',
                result,
            }));
        }
        throw new Error('Invalid send method');
    }

    // Legacy sendAsync method for compatibility
    sendAsync(payload: any, callback: (error: any, response: any) => void): void {
        if (Array.isArray(payload)) {
            Promise.all(
                payload.map((item) =>
                    new Promise((resolve) => {
                        this.sendAsync(item, (err, res) => {
                            resolve(res);
                        });
                    })
                )
            ).then((result) => callback(null, result));
            return;
        }

        const { method, params, ...rest } = payload;
        this.request({ method, params })
            .then((result) => callback(null, { ...rest, method, result }))
            .catch((error) => callback(error, { ...rest, method, error }));
    }

    // Ethereum provider methods
    async eth_accounts(): Promise<string[]> {
        // Return cached accounts immediately if available (for connected DApps)
        // This prevents repeated connection popups
        if (this._state.accounts && this._state.accounts.length > 0) {
            console.log('[Wolfy Inpage] eth_accounts returning cached accounts:', this._state.accounts);
            return this._state.accounts;
        }

        return new Promise((resolve, reject) => {
            const id = ++this.messageId;
            const messageId = id.toString();

            const handler = (response: any) => {
                if (response.success) {
                    const accounts = response.accounts || [];
                    const accountAddresses = Array.isArray(accounts)
                        ? accounts.map((acc: any) => typeof acc === 'string' ? acc : (acc.address || acc))
                        : [];

                    // Update provider state
                    this.selectedAddress = accountAddresses[0] || null;
                    this._state.accounts = accountAddresses;

                    // Emit accountsChanged event if accounts changed
                    const previousAccounts = this._state.accounts;
                    if (JSON.stringify(previousAccounts) !== JSON.stringify(accountAddresses)) {
                        this.emit('accountsChanged', accountAddresses);
                    }

                    console.log('[Wolfy Inpage] eth_accounts resolved with:', accountAddresses);
                    resolve(accountAddresses);
                } else {
                    // Return empty array on error (not reject) - this is expected when not connected
                    console.log('[Wolfy Inpage] eth_accounts error:', response.error);
                    resolve([]);
                }
            };

            if (!this.listeners.has(messageId)) {
                this.listeners.set(messageId, new Set());
            }
            this.listeners.get(messageId)!.add(handler);

            console.log('[Wolfy Inpage] Sending eth_accounts request, id:', messageId);
            window.postMessage(
                {
                    type: 'WOLFY_REQUEST',
                    id: messageId,
                    method: 'eth_accounts',
                    params: [],
                },
                '*'
            );

            setTimeout(() => {
                const listeners = this.listeners.get(messageId);
                if (listeners) {
                    listeners.delete(handler);
                    if (listeners.size === 0) {
                        this.listeners.delete(messageId);
                    }
                }
                // Timeout should return empty array, not reject
                console.log('[Wolfy Inpage] eth_accounts timeout');
                resolve([]);
            }, 30000);
        });
    }

    async eth_requestAccounts(): Promise<string[]> {
        // This triggers connection flow - same as eth_accounts but shows UI
        return this.eth_accounts();
    }

    async eth_chainId(): Promise<string> {
        return this.chainId;
    }

    async eth_sendTransaction(transaction: any): Promise<string> {
        return new Promise((resolve, reject) => {
            const id = ++this.messageId;
            const messageId = id;

            const handler = (response: any) => {
                if (response.success) {
                    // Return transaction hash (eth_sendTransaction returns the hash per EIP-1193)
                    // But also make transaction object available if dapp needs it for tracking
                    const txHash = response.transactionHash || response.txHash || response.signedTransaction || '0x';
                    // If dapp expects transaction object, it can access response.transaction
                    // But per spec, we return just the hash string
                    resolve(txHash);
                } else {
                    reject(new Error(response.error || 'Transaction failed'));
                }
            };

            if (!this.listeners.has(messageId.toString())) {
                this.listeners.set(messageId.toString(), new Set());
            }
            this.listeners.get(messageId.toString())!.add(handler);

            window.postMessage(
                {
                    type: 'WOLFY_REQUEST',
                    id: messageId,
                    method: 'eth_sendTransaction',
                    params: [transaction],
                },
                '*'
            );

            setTimeout(() => {
                const listeners = this.listeners.get(messageId.toString());
                if (listeners) {
                    listeners.delete(handler);
                    if (listeners.size === 0) {
                        this.listeners.delete(messageId.toString());
                    }
                }
                reject(new Error('Request timeout'));
            }, 30000);
        });
    }

    async eth_signTransaction(transaction: any): Promise<string> {
        return new Promise((resolve, reject) => {
            const id = ++this.messageId;
            const messageId = id;

            const handler = (response: any) => {
                if (response.success) {
                    resolve(response.signedTransaction || '0x');
                } else {
                    reject(new Error(response.error || 'Signing failed'));
                }
            };

            if (!this.listeners.has(messageId.toString())) {
                this.listeners.set(messageId.toString(), new Set());
            }
            this.listeners.get(messageId.toString())!.add(handler);

            window.postMessage(
                {
                    type: 'WOLFY_REQUEST',
                    id: messageId,
                    method: 'eth_signTransaction',
                    params: [transaction],
                },
                '*'
            );

            setTimeout(() => {
                const listeners = this.listeners.get(messageId.toString());
                if (listeners) {
                    listeners.delete(handler);
                    if (listeners.size === 0) {
                        this.listeners.delete(messageId.toString());
                    }
                }
                reject(new Error('Request timeout'));
            }, 30000);
        });
    }

    async personal_sign(message: string, address: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const id = ++this.messageId;
            const messageId = id;

            const handler = (response: any) => {
                if (response.success) {
                    resolve(response.signature || '0x');
                } else {
                    reject(new Error(response.error || 'Signing failed'));
                }
            };

            if (!this.listeners.has(messageId.toString())) {
                this.listeners.set(messageId.toString(), new Set());
            }
            this.listeners.get(messageId.toString())!.add(handler);

            window.postMessage(
                {
                    type: 'WOLFY_REQUEST',
                    id: messageId,
                    method: 'personal_sign',
                    params: [message, address],
                },
                '*'
            );

            setTimeout(() => {
                const listeners = this.listeners.get(messageId.toString());
                if (listeners) {
                    listeners.delete(handler);
                    if (listeners.size === 0) {
                        this.listeners.delete(messageId.toString());
                    }
                }
                reject(new Error('Request timeout'));
            }, 30000);
        });
    }

    async eth_signTypedData_v4(address: string, typedData: any): Promise<string> {
        return new Promise((resolve, reject) => {
            const id = ++this.messageId;
            const messageId = id;

            const handler = (response: any) => {
                if (response.success) {
                    resolve(response.signature || '0x');
                } else {
                    reject(new Error(response.error || 'Signing failed'));
                }
            };

            if (!this.listeners.has(messageId.toString())) {
                this.listeners.set(messageId.toString(), new Set());
            }
            this.listeners.get(messageId.toString())!.add(handler);

            window.postMessage(
                {
                    type: 'WOLFY_REQUEST',
                    id: messageId,
                    method: 'eth_signTypedData_v4',
                    params: [address, typedData],
                },
                '*'
            );

            setTimeout(() => {
                const listeners = this.listeners.get(messageId.toString());
                if (listeners) {
                    listeners.delete(handler);
                    if (listeners.size === 0) {
                        this.listeners.delete(messageId.toString());
                    }
                }
                reject(new Error('Request timeout'));
            }, 30000);
        });
    }

    async wallet_sendCalls(params: any): Promise<string> {
        return new Promise((resolve, reject) => {
            const id = ++this.messageId;
            const messageId = id;

            const handler = (response: any) => {
                if (response.success) {
                    // EIP-5792: wallet_sendCalls should return the transaction hash directly (string)
                    // For batched transactions (atomic), return the single transaction hash
                    const txHash = response.id || response.transactionHash || response.result?.id;
                    console.log('[Wolfy Inpage] wallet_sendCalls returning transaction hash:', txHash);
                    resolve(txHash);
                } else {
                    reject(new Error(response.error || 'Failed to send batched calls'));
                }
            };

            if (!this.listeners.has(messageId.toString())) {
                this.listeners.set(messageId.toString(), new Set());
            }
            this.listeners.get(messageId.toString())!.add(handler);

            window.postMessage(
                {
                    type: 'WOLFY_REQUEST',
                    id: messageId,
                    method: 'wallet_sendCalls',
                    params: [params],
                },
                '*'
            );

            setTimeout(() => {
                const listeners = this.listeners.get(messageId.toString());
                if (listeners) {
                    listeners.delete(handler);
                    if (listeners.size === 0) {
                        this.listeners.delete(messageId.toString());
                    }
                }
                reject(new Error('Request timeout'));
            }, 30000);
        });
    }

    async wallet_getCallsStatus(params: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const id = ++this.messageId;
            const messageId = id;

            const handler = (response: any) => {
                if (response.success) {
                    resolve(response.status || response.result || null);
                } else {
                    reject(new Error(response.error || 'Failed to get calls status'));
                }
            };

            if (!this.listeners.has(messageId.toString())) {
                this.listeners.set(messageId.toString(), new Set());
            }
            this.listeners.get(messageId.toString())!.add(handler);

            window.postMessage(
                {
                    type: 'WOLFY_REQUEST',
                    id: messageId,
                    method: 'wallet_getCallsStatus',
                    params: [params],
                },
                '*'
            );

            setTimeout(() => {
                const listeners = this.listeners.get(messageId.toString());
                if (listeners) {
                    listeners.delete(handler);
                    if (listeners.size === 0) {
                        this.listeners.delete(messageId.toString());
                    }
                }
                reject(new Error('Request timeout'));
            }, 30000);
        });
    }

    async wallet_getCapabilities(params: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const id = ++this.messageId;
            const messageId = id;

            const handler = (response: any) => {
                if (response.success) {
                    resolve(response.capabilities || response.result || {});
                } else {
                    reject(new Error(response.error || 'Failed to get capabilities'));
                }
            };

            if (!this.listeners.has(messageId.toString())) {
                this.listeners.set(messageId.toString(), new Set());
            }
            this.listeners.get(messageId.toString())!.add(handler);

            window.postMessage(
                {
                    type: 'WOLFY_REQUEST',
                    id: messageId,
                    method: 'wallet_getCapabilities',
                    params: [params],
                },
                '*'
            );

            setTimeout(() => {
                const listeners = this.listeners.get(messageId.toString());
                if (listeners) {
                    listeners.delete(handler);
                    if (listeners.size === 0) {
                        this.listeners.delete(messageId.toString());
                    }
                }
                reject(new Error('Request timeout'));
            }, 30000);
        });
    }
}

// Rabby-style injection - MUST execute synchronously
// This runs in MAIN world (page context) via chrome.scripting.registerContentScripts
(function () {
    try {
        if (typeof window === 'undefined') {
            console.error('[Wolfy] window is undefined');
            return;
        }

        console.log('[Wolfy] ✅ Script executing in MAIN world, window.ethereum currently:', typeof (window as any).ethereum);

        const provider = new WolfyProvider();

        // Check for existing provider (might be our minimal placeholder)
        const existingProvider = (window as any).ethereum;
        const isMinimalPlaceholder = existingProvider &&
            existingProvider.isRabby &&
            existingProvider.request &&
            existingProvider.request.toString().includes('Provider initializing');

        // If another real provider exists, store it
        if (existingProvider && !existingProvider.isRabby && !existingProvider.isWolfy && !isMinimalPlaceholder) {
            // Store existing provider (like MetaMask)
            (window as any).ethereumProviders = existingProvider;
        }

        // Set as primary provider - REPLACE the minimal placeholder
        // Check if window.ethereum already has a getter-only property
        const existingDescriptor = Object.getOwnPropertyDescriptor(window, 'ethereum');
        const hasGetterOnly = existingDescriptor && existingDescriptor.get && !existingDescriptor.set && !existingDescriptor.writable;

        if (hasGetterOnly) {
            // If it's getter-only, we need to delete it first (if configurable) or use a different approach
            try {
                if (existingDescriptor.configurable) {
                    delete (window as any).ethereum;
                    Object.defineProperty(window, 'ethereum', {
                        get: function () { return provider; },
                        configurable: true, // Make it configurable for future updates
                        enumerable: true
                    });
                    console.log('[Wolfy] Set window.ethereum via defineProperty (replaced getter-only)');
                } else {
                    // Can't replace, try to wrap it
                    console.warn('[Wolfy] window.ethereum is non-configurable getter-only, using wrapper');
                    (window as any).__wolfyProvider = provider;
                    // DApp will need to use window.__wolfyProvider or we intercept at a different level
                }
            } catch (e) {
                console.error('[Wolfy] Failed to set window.ethereum:', e);
            }
        } else {
            // Normal case - use defineProperty
            try {
                Object.defineProperty(window, 'ethereum', {
                    get: function () { return provider; },
                    configurable: true, // Make it configurable
                    enumerable: true
                });
                console.log('[Wolfy] Set window.ethereum via defineProperty');
            } catch (e) {
                // If defineProperty fails, try deleting first
                try {
                    delete (window as any).ethereum;
                    (window as any).ethereum = provider;
                    console.log('[Wolfy] Set window.ethereum directly (after delete)');
                } catch (e2) {
                    console.error('[Wolfy] Failed to set window.ethereum:', e2);
                }
            }
        }

        // Verify it's set
        if ((window as any).ethereum === provider) {
            console.log('[Wolfy] ✅ window.ethereum is set correctly');
        } else {
            console.error('[Wolfy] ❌ window.ethereum is NOT set correctly!');
        }

        // Also set as window.rabby for compatibility
        try {
            const rabbyDescriptor = Object.getOwnPropertyDescriptor(window, 'rabby');
            if (rabbyDescriptor) {
                // Property already exists - check if we can modify it
                if (rabbyDescriptor.configurable) {
                    // Can delete and redefine
                    delete (window as any).rabby;
                    Object.defineProperty(window, 'rabby', {
                        value: provider,
                        configurable: true,
                        writable: true,
                        enumerable: true
                    });
                    console.log('[Wolfy] Set window.rabby (replaced existing)');
                } else {
                    // Non-configurable - can't modify, skip silently
                    console.log('[Wolfy] window.rabby is non-configurable, skipping');
                }
            } else {
                // Property doesn't exist, safe to define
                Object.defineProperty(window, 'rabby', {
                    value: provider,
                    configurable: true,
                    writable: true,
                    enumerable: true
                });
                console.log('[Wolfy] Set window.rabby');
            }
        } catch (e) {
            console.warn('[Wolfy] Could not set window.rabby:', e);
        }

        // EIP-6963: Announce wallet to dApps
        const announceProvider = () => {
            try {
                const detail = {
                    info: {
                        uuid: crypto.randomUUID(),
                        name: 'Rabby Wallet', // Identify as Rabby
                        icon: chrome.runtime?.getURL?.('icons/icon128.png') || '',
                        rdns: 'io.rabby',
                    },
                    provider: provider,
                };
                window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail }));
            } catch (e) {
                // Ignore errors
            }
        };

        // Listen for dApp requests for wallets
        window.addEventListener('eip6963:requestProvider', announceProvider);

        // Announce immediately
        announceProvider();

        // Dispatch ethereum#initialized for compatibility
        try {
            window.dispatchEvent(new Event('ethereum#initialized'));
        } catch (e) {
            // Fallback
            try {
                const evt = document.createEvent('Event');
                evt.initEvent('ethereum#initialized', false, false);
                window.dispatchEvent(evt);
            } catch (e2) {
                console.error('[Wolfy] Error dispatching ethereum#initialized:', e2);
            }
        }

        console.log('[Wolfy] ✅ Provider initialization complete');
    } catch (error: any) {
        console.error('[Wolfy] ❌ CRITICAL ERROR initializing provider:', error);
        // Still try to set a minimal provider so wagmi doesn't fail
        try {
            if (typeof window !== 'undefined') {
                const ethereumDescriptor = Object.getOwnPropertyDescriptor(window, 'ethereum');
                const fallbackProvider = {
                    isRabby: true,
                    isMetaMask: true,
                    request: () => Promise.reject(new Error('Provider initialization failed')),
                };
                
                if (ethereumDescriptor) {
                    // Property already exists
                    if (ethereumDescriptor.configurable) {
                        // Can delete and redefine
                        delete (window as any).ethereum;
                        Object.defineProperty(window, 'ethereum', {
                            value: fallbackProvider,
                            configurable: true,
                            writable: true,
                            enumerable: true
                        });
                        console.log('[Wolfy] Set fallback window.ethereum (replaced existing)');
                    } else {
                        // Non-configurable getter-only - can't modify
                        console.warn('[Wolfy] window.ethereum is non-configurable, cannot set fallback provider');
                    }
                } else {
                    // Property doesn't exist, safe to define
                    Object.defineProperty(window, 'ethereum', {
                        value: fallbackProvider,
                        configurable: true,
                        writable: true,
                        enumerable: true
                    });
                    console.log('[Wolfy] Set fallback window.ethereum');
                }
            }
        } catch (e) {
            console.error('[Wolfy] Failed to set fallback provider:', e);
        }
    }
})();

// No exports needed - script runs in global scope
// The provider is already set on window.ethereum above

