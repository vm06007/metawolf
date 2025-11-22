/**
 * In-page script - Provides window.ethereum API to dApps
 * This file will be bundled and injected into web pages
 */

interface EthereumProvider {
    isWolfy?: boolean;
    request(args: { method: string; params?: any[] }): Promise<any>;
    on(event: string, handler: (...args: any[]) => void): void;
    removeListener(event: string, handler: (...args: any[]) => void): void;
    isConnected(): boolean;
}

class WolfyProvider implements EthereumProvider {
    isWolfy = true;
    private messageId = 0;
    private listeners: Map<string, Set<Function>> = new Map();

    constructor() {
        // Listen for responses from content script
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type && event.data.type.endsWith('_RESPONSE')) {
                const listeners = this.listeners.get(event.data.id);
                if (listeners) {
                    listeners.forEach((fn) => {
                        try {
                            fn(event.data.response);
                        } catch (error) {
                            console.error('Error in listener:', error);
                        }
                    });
                    this.listeners.delete(event.data.id);
                }
            }
        });
    }

    async request(args: { method: string; params?: any[] }): Promise<any> {
        // Handle standard Ethereum provider methods
        if (args.method === 'eth_accounts') {
            return this.eth_accounts();
        }
        if (args.method === 'eth_requestAccounts') {
            return this.eth_requestAccounts();
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
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(handler);
    }

    removeListener(event: string, handler: Function): void {
        const listeners = this.listeners.get(event);
        if (listeners) {
            listeners.delete(handler);
            if (listeners.size === 0) {
                this.listeners.delete(event);
            }
        }
    }

    isConnected(): boolean {
        return true;
    }

    // Ethereum provider methods
    async eth_accounts(): Promise<string[]> {
        return new Promise((resolve, reject) => {
            const id = ++this.messageId;
            const messageId = id;

            const handler = (response: any) => {
                if (response.success) {
                    const accounts = response.accounts || [];
                    resolve(accounts.map((acc: any) => acc.address || acc));
                } else {
                    reject(new Error(response.error || 'Failed to get accounts'));
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
                    method: 'eth_accounts',
                    params: [],
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

    async eth_requestAccounts(): Promise<string[]> {
        return this.eth_accounts();
    }

    async eth_sendTransaction(transaction: any): Promise<string> {
        return new Promise((resolve, reject) => {
            const id = ++this.messageId;
            const messageId = id;

            const handler = (response: any) => {
                if (response.success) {
                    resolve(response.txHash || response.signedTransaction || '0x');
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
}

// Inject provider into window
if (typeof window !== 'undefined') {
    const provider = new WolfyProvider();

    // Set as window.ethereum
    (window as any).ethereum = provider;

    // Dispatch connect event
    window.dispatchEvent(new Event('ethereum#initialized'));
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WolfyProvider;
}

