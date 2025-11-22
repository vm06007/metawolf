/**
 * Content script - Injected into web pages
 * Provides wallet provider API to dApps
 */

// Content script runs in isolated world
// The provider script (inpage.js) is injected via chrome.scripting.registerContentScripts
// with world: 'MAIN' in the background script
// This content script also manually injects it as a fallback

(function () {
    // Inject inpage.js using src (not inline) to avoid CSP violations
    // The script is registered via chrome.scripting.registerContentScripts in background
    // This is just a fallback
    const injectInpageScript = () => {
        // Check if already injected
        if ((window as any).__wolfyInjected) {
            return;
        }

        // Use src instead of inline to avoid CSP violations
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('inpage.js');
        script.onload = () => {
            script.remove();
            console.log('[Wolfy Content] ✅ Injected inpage.js via src');
        };
        script.onerror = () => {
            console.error('[Wolfy Content] ❌ Failed to load inpage.js');
        };
        (document.head || document.documentElement).insertBefore(script, (document.head || document.documentElement).firstChild);
        (window as any).__wolfyInjected = true;
    };

    // Inject immediately at document_start
    if (document.readyState === 'loading') {
        injectInpageScript();
    } else {
        // Already loaded, inject immediately
        injectInpageScript();
    }

    // Store pending connection requests to respond to them when approved
    const pendingConnections: Map<number, {
        resolve: (accounts: string[]) => void;
        reject: (error: string) => void;
        origin: string;
    }> = new Map();

    // Store pending signature requests to respond to them when approved
    const pendingSignatures: Map<number, {
        resolve: (signature: string) => void;
        reject: (error: string) => void;
        requestId: string;
    }> = new Map();

    // Store pending transaction requests to respond to them when approved
    const pendingTransactions: Map<number, {
        resolve: (transactionHash: string, transaction?: any) => void;
        reject: (error: string) => void;
        requestId: string;
    }> = new Map();

    // Store pending batched calls requests to respond to them when approved
    const pendingBatchedCalls: Map<number, {
        resolve: (id: string) => void;
        reject: (error: string) => void;
        requestId: string;
    }> = new Map();

    // Listen for messages from background/notification
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('[Wolfy Content] Received runtime message:', message.type);
        if (message.type === 'CONNECT_APPROVED') {
            const accounts = message.accounts || [];
            console.log('[Wolfy Content] CONNECT_APPROVED with accounts:', accounts, 'origin:', message.origin);
            // Resolve all pending connection requests for this origin
            let resolved = false;
            pendingConnections.forEach(({ resolve, origin }, id) => {
                if (origin === message.origin || !message.origin) {
                    console.log('[Wolfy Content] Resolving pending connection id:', id);
                    resolve(accounts);
                    pendingConnections.delete(id);
                    resolved = true;
                }
            });
            if (!resolved) {
                console.warn('[Wolfy Content] CONNECT_APPROVED but no pending connections found');
            }
            sendResponse({ success: true });
        } else if (message.type === 'CONNECT_REJECTED') {
            console.log('[Wolfy Content] CONNECT_REJECTED');
            // Reject all pending connection requests
            pendingConnections.forEach(({ reject }, id) => {
                reject('User rejected connection');
                pendingConnections.delete(id);
            });
            sendResponse({ success: true });
        } else if (message.type === 'SIGNATURE_APPROVED') {
            console.log('[Wolfy Content] SIGNATURE_APPROVED with signature:', message.signature?.substring(0, 20) + '...');
            // Resolve pending signature request
            let resolved = false;
            pendingSignatures.forEach(({ resolve, requestId }, id) => {
                if (requestId === message.requestId || !message.requestId) {
                    console.log('[Wolfy Content] Resolving pending signature id:', id);
                    resolve(message.signature);
                    pendingSignatures.delete(id);
                    resolved = true;
                }
            });
            if (!resolved) {
                console.warn('[Wolfy Content] SIGNATURE_APPROVED but no pending signature found');
            }
            sendResponse({ success: true });
        } else if (message.type === 'SIGNATURE_REJECTED') {
            console.log('[Wolfy Content] SIGNATURE_REJECTED');
            // Reject pending signature request
            pendingSignatures.forEach(({ reject, requestId }, id) => {
                if (requestId === message.requestId || !message.requestId) {
                    reject('User rejected signature');
                    pendingSignatures.delete(id);
                }
            });
            sendResponse({ success: true });
        } else if (message.type === 'TRANSACTION_APPROVED') {
            console.log('[Wolfy Content] TRANSACTION_APPROVED with hash:', message.transactionHash?.substring(0, 20) + '...');
            console.log('[Wolfy Content] TRANSACTION_APPROVED transaction object:', message.transaction);
            // Resolve pending transaction request
            let resolved = false;
            pendingTransactions.forEach(({ resolve, requestId }, id) => {
                if (requestId === message.requestId || !message.requestId) {
                    console.log('[Wolfy Content] Resolving pending transaction id:', id, 'with transaction:', message.transaction);
                    // Pass both hash and transaction object
                    resolve(message.transactionHash, message.transaction);
                    pendingTransactions.delete(id);
                    resolved = true;
                }
            });
            if (!resolved) {
                console.warn('[Wolfy Content] TRANSACTION_APPROVED but no pending transaction found');
            }
            sendResponse({ success: true });
        } else if (message.type === 'TRANSACTION_REJECTED') {
            console.log('[Wolfy Content] TRANSACTION_REJECTED');
            // Reject pending transaction request
            pendingTransactions.forEach(({ reject, requestId }, id) => {
                if (requestId === message.requestId || !message.requestId) {
                    reject('User rejected transaction');
                    pendingTransactions.delete(id);
                }
            });
            sendResponse({ success: true });
        } else if (message.type === 'BATCHED_CALLS_APPROVED') {
            console.log('[Wolfy Content] BATCHED_CALLS_APPROVED with id:', message.id?.substring(0, 20) + '...');
            // Resolve pending batched calls request
            let resolved = false;
            pendingBatchedCalls.forEach(({ resolve, requestId }, id) => {
                if (requestId === message.requestId || !message.requestId) {
                    console.log('[Wolfy Content] Resolving pending batched calls id:', id);
                    resolve(message.id || '0x');
                    pendingBatchedCalls.delete(id);
                    resolved = true;
                }
            });
            if (!resolved) {
                console.warn('[Wolfy Content] BATCHED_CALLS_APPROVED but no pending batched calls found');
            }
            sendResponse({ success: true });
        } else if (message.type === 'BATCHED_CALLS_REJECTED') {
            console.log('[Wolfy Content] BATCHED_CALLS_REJECTED');
            // Reject pending batched calls request
            pendingBatchedCalls.forEach(({ reject, requestId }, id) => {
                if (requestId === message.requestId || !message.requestId) {
                    reject('User rejected batched calls');
                    pendingBatchedCalls.delete(id);
                }
            });
            sendResponse({ success: true });
        } else if (message.type === 'ACCOUNT_CHANGED') {
            console.log('[Wolfy Content] ACCOUNT_CHANGED with accounts:', message.accounts);
            // Notify inpage provider about account change
            const accounts = message.accounts || [];
            window.postMessage(
                {
                    type: 'WOLFY_ACCOUNT_CHANGED',
                    accounts: accounts,
                },
                '*'
            );
            sendResponse({ success: true });
        }
        return true; // Keep channel open for async response
    });

    // Listen for messages from in-page script (MAIN world)
    // Content script runs in isolated world, inpage.js runs in MAIN world
    window.addEventListener(
        'message',
        async (event) => {
            // Only accept messages from the same window
            if (event.source !== window) return;

            // Debug log - only for non-RPC methods to reduce noise
            if (event.data && event.data.type === 'WOLFY_REQUEST') {
                const method = event.data.method;
                // Only log important methods, skip frequent RPC calls
                const shouldLog = !method.startsWith('eth_call') &&
                    !method.startsWith('eth_getBlock') &&
                    !method.startsWith('eth_getTransaction') &&
                    !method.startsWith('eth_getLogs') &&
                    !method.startsWith('eth_getBalance') &&
                    method !== 'eth_chainId' &&
                    method !== 'net_version';
                if (shouldLog) {
                    console.log('[Wolfy Content] Received request:', method);
                }
            }

            if (event.data && event.data.type) {
                // Detect EIP-6963 providers
                if (event.data?.type === 'EIP6963_REQUEST_PROVIDERS') {
                    // Detect other wallets
                    const detectedProviders: any[] = [];

                    // Check for MetaMask
                    if ((window as any).ethereum && (window as any).ethereum.isMetaMask) {
                        detectedProviders.push({
                            uuid: 'metamask',
                            name: 'MetaMask',
                            icon: 'https://metamask.io/images/metamask-icon.svg',
                            rdns: 'io.metamask',
                        });
                    }

                    // Check for Rabby
                    if ((window as any).ethereum && (window as any).ethereum.isRabby) {
                        detectedProviders.push({
                            uuid: 'rabby',
                            name: 'Rabby',
                            icon: 'https://rabby.io/images/logo.png',
                            rdns: 'io.rabby',
                        });
                    }

                    // Check for Coinbase Wallet
                    if ((window as any).ethereum && (window as any).ethereum.isCoinbaseWallet) {
                        detectedProviders.push({
                            uuid: 'coinbase',
                            name: 'Coinbase Wallet',
                            icon: 'https://coinbase.com/favicon.ico',
                            rdns: 'com.coinbase.wallet',
                        });
                    }

                    // Check for Brave Wallet
                    if ((window as any).ethereum && (window as any).ethereum.isBraveWallet) {
                        detectedProviders.push({
                            uuid: 'brave',
                            name: 'Brave Wallet',
                            icon: 'https://brave.com/favicon.ico',
                            rdns: 'com.brave.wallet',
                        });
                    }

                    // Send detected providers back
                    window.postMessage(
                        {
                            type: 'EIP6963_PROVIDERS',
                            providers: detectedProviders,
                        },
                        '*'
                    );
                }

                if (event.data.type === 'WOLFY_REQUEST') {
                    // Handle RPC request
                    const method = event.data.method;
                    const params = event.data.params || [];

                    // Handle eth_accounts and eth_requestAccounts
                    if (method === 'eth_accounts' || method === 'eth_requestAccounts') {
                        const origin = window.location.origin;

                        // Check if DApp is already connected (only for eth_accounts, not eth_requestAccounts)
                        chrome.storage.local.get(['dapp_connections'], (result) => {
                            const dappConnections = result.dapp_connections || {};
                            const isConnected = dappConnections[origin];

                            if (isConnected && method === 'eth_accounts') {
                                // Already connected - just get accounts without showing popup
                                console.log('[Wolfy Content] DApp already connected, getting accounts without popup');
                                chrome.runtime.sendMessage(
                                    { type: 'GET_ACCOUNTS', origin: origin },
                                    (accountsResponse) => {
                                        if (accountsResponse && accountsResponse.success) {
                                            const accounts = accountsResponse.accounts || [];
                                            const accountAddresses = accounts.map((acc: any) => acc.address || acc);
                                            window.postMessage(
                                                {
                                                    type: 'WOLFY_REQUEST_RESPONSE',
                                                    id: event.data.id,
                                                    response: {
                                                        success: true,
                                                        accounts: accountAddresses,
                                                    },
                                                },
                                                '*'
                                            );
                                        } else {
                                            window.postMessage(
                                                {
                                                    type: 'WOLFY_REQUEST_RESPONSE',
                                                    id: event.data.id,
                                                    response: {
                                                        success: false,
                                                        error: 'Failed to get accounts',
                                                    },
                                                },
                                                '*'
                                            );
                                        }
                                    }
                                );
                                return; // Don't proceed with connection flow
                            }

                            // Not connected or eth_requestAccounts - show connection popup
                            // Detect other wallets when connection is requested
                            let detectedProviders: any[] = [];

                            // Check for MetaMask
                            if ((window as any).ethereum && (window as any).ethereum.isMetaMask && !(window as any).ethereum.isWolfy) {
                                detectedProviders.push({
                                    uuid: 'metamask',
                                    name: 'MetaMask',
                                    icon: 'https://metamask.io/images/metamask-icon.svg',
                                    rdns: 'io.metamask',
                                });
                            }

                            // Check for Rabby
                            if ((window as any).ethereum && (window as any).ethereum.isRabby) {
                                detectedProviders.push({
                                    uuid: 'rabby',
                                    name: 'Rabby',
                                    icon: 'https://rabby.io/images/logo.png',
                                    rdns: 'io.rabby',
                                });
                            }

                            // Check for Coinbase Wallet
                            if ((window as any).ethereum && (window as any).ethereum.isCoinbaseWallet) {
                                detectedProviders.push({
                                    uuid: 'coinbase',
                                    name: 'Coinbase Wallet',
                                    icon: 'https://coinbase.com/favicon.ico',
                                    rdns: 'com.coinbase.wallet',
                                });
                            }

                            // Check for Brave Wallet
                            if ((window as any).ethereum && (window as any).ethereum.isBraveWallet) {
                                detectedProviders.push({
                                    uuid: 'brave',
                                    name: 'Brave Wallet',
                                    icon: 'https://brave.com/favicon.ico',
                                    rdns: 'com.brave.wallet',
                                });
                            }

                            const messageType = 'CONNECT_DAPP';
                            const payload = {
                                origin: origin,
                                name: document.title || window.location.hostname,
                                icon: (document.querySelector('link[rel="icon"]') as HTMLLinkElement)?.href ||
                                    (document.querySelector('link[rel="shortcut icon"]') as HTMLLinkElement)?.href ||
                                    `${origin}/favicon.ico`,
                                providers: detectedProviders,
                            };

                            // Send to background script
                            chrome.runtime.sendMessage(
                                { type: messageType, ...payload },
                                (response) => {
                                    // Debug - connection responses are important, so we log them
                                    console.log('[Wolfy Content] Received from background:', response);

                                    // Forward response back to in-page script
                                    if (messageType === 'CONNECT_DAPP' && response?.pending) {
                                        // Connection pending - wait for approval
                                        let responseSent = false; // Prevent duplicate responses

                                        const sendResponseToInpage = (success: boolean, accounts?: string[], error?: string) => {
                                            if (responseSent) return; // Already sent
                                            responseSent = true;

                                            // Clean up
                                            pendingConnections.delete(event.data.id);

                                            window.postMessage(
                                                {
                                                    type: 'WOLFY_REQUEST_RESPONSE',
                                                    id: event.data.id,
                                                    response: {
                                                        success: success,
                                                        accounts: accounts || [],
                                                        error: error,
                                                    },
                                                },
                                                '*'
                                            );
                                        };

                                        // Store the promise resolvers
                                        pendingConnections.set(event.data.id, {
                                            resolve: (accounts) => {
                                                sendResponseToInpage(true, accounts);
                                            },
                                            reject: (error) => {
                                                sendResponseToInpage(false, undefined, error);
                                            },
                                            origin: payload.origin,
                                        });

                                        // Also poll as fallback (in case message listener doesn't work)
                                        const checkApproval = setInterval(() => {
                                            if (responseSent) {
                                                clearInterval(checkApproval);
                                                return;
                                            }

                                            chrome.storage.local.get(['pendingConnection', 'dapp_connections'], (result) => {
                                                const pendingConnection = result.pendingConnection;
                                                const dappConnections = result.dapp_connections || {};

                                                // Check if connection was resolved
                                                if (!pendingConnection || dappConnections[payload.origin]) {
                                                    clearInterval(checkApproval);

                                                    if (dappConnections[payload.origin]) {
                                                        // Approved - get accounts
                                                        chrome.runtime.sendMessage(
                                                            { type: 'GET_ACCOUNTS', origin: payload.origin },
                                                            (accountsResponse) => {
                                                                if (accountsResponse && accountsResponse.success) {
                                                                    const accounts = accountsResponse.accounts || [];
                                                                    const accountAddresses = accounts.map((acc: any) => acc.address || acc);
                                                                    sendResponseToInpage(true, accountAddresses);
                                                                } else {
                                                                    sendResponseToInpage(false, undefined, 'Failed to get accounts');
                                                                }
                                                            }
                                                        );
                                                    } else {
                                                        // Rejected or cancelled
                                                        sendResponseToInpage(false, undefined, 'User rejected connection');
                                                    }
                                                }
                                            });
                                        }, 100);

                                        // Timeout after 5 minutes
                                        setTimeout(() => {
                                            clearInterval(checkApproval);
                                            if (!responseSent) {
                                                sendResponseToInpage(false, undefined, 'Connection timeout');
                                            }
                                        }, 300000);
                                    } else {
                                        // Normal response
                                        window.postMessage(
                                            {
                                                type: 'WOLFY_REQUEST_RESPONSE',
                                                id: event.data.id,
                                                response: response,
                                            },
                                            '*'
                                        );
                                    }
                                }
                            );
                            return; // Handled above - return from chrome.storage.local.get callback
                        });
                        return; // Handled above - return from event handler
                    }

                    // Map to internal message types for other methods
                    let messageType = '';
                    let payload: any = {};

                    if (method === 'eth_sendTransaction') {
                        messageType = 'SIGN_TRANSACTION';
                        // Get chainId from wallet's selected network (not from window.ethereum which may be stale)
                        let chainId = 1;
                        try {
                            // Query the wallet's current selected network
                            const networkResponse = await new Promise<any>((resolve) => {
                                chrome.runtime.sendMessage(
                                    { type: 'GET_SELECTED_NETWORK' },
                                    (response) => {
                                        resolve(response);
                                    }
                                );
                            });
                            if (networkResponse && networkResponse.success && networkResponse.chainId !== undefined) {
                                chainId = networkResponse.chainId;
                            } else {
                                // Fallback: try to get from provider
                                const provider = (window as any).ethereum;
                                if (provider && provider.chainId) {
                                    chainId = typeof provider.chainId === 'string'
                                        ? parseInt(provider.chainId, 16)
                                        : provider.chainId;
                                }
                            }
                        } catch {
                            // Use default
                        }
                        payload = {
                            transaction: {
                                to: params[0]?.to,
                                value: params[0]?.value,
                                data: params[0]?.data,
                                gasLimit: params[0]?.gas || params[0]?.gasLimit,
                                gasPrice: params[0]?.gasPrice,
                                maxFeePerGas: params[0]?.maxFeePerGas,
                                maxPriorityFeePerGas: params[0]?.maxPriorityFeePerGas,
                                nonce: params[0]?.nonce
                                    ? parseInt(params[0].nonce, 16)
                                    : undefined,
                                chainId: chainId,
                                type: params[0]?.type,
                            },
                        };
                    } else if (method === 'eth_signTransaction') {
                        messageType = 'SIGN_TRANSACTION';
                        payload = {
                            transaction: {
                                to: params[0]?.to,
                                value: params[0]?.value,
                                data: params[0]?.data,
                                gasLimit: params[0]?.gas,
                                gasPrice: params[0]?.gasPrice,
                                maxFeePerGas: params[0]?.maxFeePerGas,
                                maxPriorityFeePerGas: params[0]?.maxPriorityFeePerGas,
                                nonce: params[0]?.nonce
                                    ? parseInt(params[0].nonce, 16)
                                    : undefined,
                            },
                        };
                    } else if (method === 'personal_sign') {
                        messageType = 'SIGN_MESSAGE';
                        payload = {
                            message: params[0],
                            address: params[1],
                        };
                    } else if (method === 'eth_signTypedData_v4') {
                        messageType = 'SIGN_TYPED_DATA';
                        payload = {
                            address: params[0],
                            typedData: params[1],
                        };
                    } else if (method === 'wallet_sendCalls') {
                        // EIP-5792: Send batched calls
                        messageType = 'SEND_BATCHED_CALLS';
                        payload = {
                            calls: params[0]?.calls || [],
                            chainId: params[0]?.chainId,
                            capabilities: params[0]?.capabilities,
                            forceAtomic: params[0]?.forceAtomic,
                        };
                    } else if (method === 'wallet_getCallsStatus') {
                        // EIP-5792: Get calls status
                        messageType = 'GET_CALLS_STATUS';
                        // Try to get chainId from provider or use default
                        let chainId = 1;
                        try {
                            if ((window as any).ethereum && (window as any).ethereum.isWolfy) {
                                const chainIdHex = await (window as any).ethereum.request({ method: 'eth_chainId' });
                                chainId = parseInt(chainIdHex, 16);
                            }
                        } catch {
                            // Use default
                        }

                        // The ID can be passed as params[0] directly (string) or as params[0].id (object)
                        const callsId = typeof params[0] === 'string' ? params[0] : params[0]?.id;
                        console.log('[Wolfy Content] wallet_getCallsStatus called with ID:', callsId);

                        payload = {
                            id: callsId,
                            chainId: chainId,
                        };
                    } else if (method === 'wallet_getCapabilities') {
                        // EIP-5792: Get capabilities
                        messageType = 'GET_CAPABILITIES';
                        payload = {
                            account: params[0]?.account,
                        };
                    } else if (method.startsWith('eth_') || method.startsWith('net_') || method.startsWith('web3_')) {
                        // Generic RPC method - forward to background
                        // Try to get chainId from the request or use default (1 for mainnet)
                        let chainId = 1;
                        if (method === 'eth_chainId') {
                            // Will be handled by inpage script
                        } else {
                            // For other methods, we might need chainId from provider
                            // For now, default to mainnet
                        }
                        messageType = 'RPC_REQUEST';
                        payload = {
                            method: method,
                            params: params,
                            chainId: chainId,
                        };
                    }

                    if (messageType) {
                        // Debug - only log non-RPC requests to reduce noise
                        if (messageType !== 'RPC_REQUEST' ||
                            (payload.method && !payload.method.startsWith('eth_call') &&
                                !payload.method.startsWith('eth_getBlock') &&
                                !payload.method.startsWith('eth_getTransaction') &&
                                !payload.method.startsWith('eth_getLogs') &&
                                !payload.method.startsWith('eth_getBalance'))) {
                            console.log('[Wolfy Content] Sending to background:', messageType, payload);
                        }

                        chrome.runtime.sendMessage(
                            { type: messageType, ...payload },
                            (response) => {
                                // Debug - only log non-RPC responses to reduce noise
                                if (messageType !== 'RPC_REQUEST' ||
                                    (payload.method && !payload.method.startsWith('eth_call') &&
                                        !payload.method.startsWith('eth_getBlock') &&
                                        !payload.method.startsWith('eth_getTransaction') &&
                                        !payload.method.startsWith('eth_getLogs') &&
                                        !payload.method.startsWith('eth_getBalance'))) {
                                    console.log('[Wolfy Content] Received from background:', response);
                                }

                                // Forward response back to in-page script
                                if (messageType === 'CONNECT_DAPP' && response?.pending) {
                                    // Connection pending - wait for approval
                                    let responseSent = false; // Prevent duplicate responses

                                    const sendResponseToInpage = (success: boolean, accounts?: string[], error?: string) => {
                                        if (responseSent) return; // Already sent
                                        responseSent = true;

                                        // Clean up
                                        pendingConnections.delete(event.data.id);

                                        window.postMessage(
                                            {
                                                type: 'WOLFY_REQUEST_RESPONSE', // Fixed type - don't append multiple times
                                                id: event.data.id,
                                                response: {
                                                    success: success,
                                                    accounts: accounts || [],
                                                    error: error,
                                                },
                                            },
                                            '*'
                                        );
                                    };

                                    // Store the promise resolvers
                                    pendingConnections.set(event.data.id, {
                                        resolve: (accounts) => {
                                            sendResponseToInpage(true, accounts);
                                        },
                                        reject: (error) => {
                                            sendResponseToInpage(false, undefined, error);
                                        },
                                        origin: payload.origin,
                                    });

                                    // Also poll as fallback (in case message listener doesn't work)
                                    const checkApproval = setInterval(() => {
                                        if (responseSent) {
                                            clearInterval(checkApproval);
                                            return;
                                        }

                                        chrome.storage.local.get(['pendingConnection', 'dapp_connections'], (result) => {
                                            const pendingConnection = result.pendingConnection;
                                            const dappConnections = result.dapp_connections || {};

                                            // Check if connection was resolved
                                            if (!pendingConnection || dappConnections[payload.origin]) {
                                                clearInterval(checkApproval);

                                                if (dappConnections[payload.origin]) {
                                                    // Approved - get accounts
                                                    chrome.runtime.sendMessage(
                                                        { type: 'GET_ACCOUNTS', origin: payload.origin },
                                                        (accountsResponse) => {
                                                            if (accountsResponse && accountsResponse.success) {
                                                                const accounts = accountsResponse.accounts || [];
                                                                const accountAddresses = accounts.map((acc: any) => acc.address || acc);
                                                                sendResponseToInpage(true, accountAddresses);
                                                            } else {
                                                                sendResponseToInpage(false, undefined, 'Failed to get accounts');
                                                            }
                                                        }
                                                    );
                                                } else {
                                                    // Rejected or cancelled
                                                    sendResponseToInpage(false, undefined, 'User rejected connection');
                                                }
                                            }
                                        });
                                    }, 100);

                                    // Timeout after 5 minutes
                                    setTimeout(() => {
                                        clearInterval(checkApproval);
                                        if (!responseSent) {
                                            sendResponseToInpage(false, undefined, 'Connection timeout');
                                        }
                                    }, 300000);
                                } else if ((messageType === 'SIGN_MESSAGE' || messageType === 'SIGN_TYPED_DATA') && response?.pending) {
                                    // Signature pending - wait for approval
                                    let responseSent = false; // Prevent duplicate responses
                                    const requestId = response.requestId;

                                    const sendResponseToInpage = (success: boolean, signature?: string, error?: string) => {
                                        if (responseSent) return; // Already sent
                                        responseSent = true;

                                        // Clean up
                                        pendingSignatures.delete(event.data.id);

                                        window.postMessage(
                                            {
                                                type: 'WOLFY_REQUEST_RESPONSE',
                                                id: event.data.id,
                                                response: {
                                                    success: success,
                                                    signature: signature,
                                                    error: error,
                                                },
                                            },
                                            '*'
                                        );
                                    };

                                    // Store the promise resolvers
                                    pendingSignatures.set(event.data.id, {
                                        resolve: (signature) => {
                                            sendResponseToInpage(true, signature);
                                        },
                                        reject: (error) => {
                                            sendResponseToInpage(false, undefined, error);
                                        },
                                        requestId: requestId,
                                    });

                                    // Poll for signature approval/rejection
                                    const checkSignature = setInterval(() => {
                                        if (responseSent) {
                                            clearInterval(checkSignature);
                                            return;
                                        }

                                        chrome.storage.local.get(['pendingSignature'], (result) => {
                                            const pendingSignature = result.pendingSignature;

                                            // Check if signature was resolved (cleared from storage)
                                            if (!pendingSignature || pendingSignature.id !== requestId) {
                                                clearInterval(checkSignature);
                                                // Signature was resolved - the message listener should have handled it
                                                // But if not, we'll timeout
                                            }
                                        });
                                    }, 100);

                                    // Timeout after 5 minutes
                                    setTimeout(() => {
                                        clearInterval(checkSignature);
                                        if (!responseSent) {
                                            sendResponseToInpage(false, undefined, 'Signature request timeout');
                                        }
                                    }, 300000);
                                } else if (messageType === 'SEND_BATCHED_CALLS' && response?.pending) {
                                    // Batched calls pending - wait for approval
                                    let responseSent = false;
                                    const requestId = response.id || response.requestId;

                                    const sendResponseToInpage = (success: boolean, id?: string, error?: string) => {
                                        if (responseSent) return;
                                        responseSent = true;

                                        // Clean up
                                        pendingBatchedCalls.delete(event.data.id);

                                        window.postMessage(
                                            {
                                                type: 'WOLFY_REQUEST_RESPONSE',
                                                id: event.data.id,
                                                response: {
                                                    success: success,
                                                    id: id,
                                                    error: error,
                                                },
                                            },
                                            '*'
                                        );
                                    };

                                    // Store the promise resolvers
                                    pendingBatchedCalls.set(event.data.id, {
                                        resolve: (id) => {
                                            sendResponseToInpage(true, id);
                                        },
                                        reject: (error) => {
                                            sendResponseToInpage(false, undefined, error);
                                        },
                                        requestId: requestId,
                                    });

                                    // Poll for batched calls approval/rejection
                                    const checkBatchedCalls = setInterval(() => {
                                        if (responseSent) {
                                            clearInterval(checkBatchedCalls);
                                            return;
                                        }

                                        chrome.storage.local.get(['pendingBatchedCalls'], (result) => {
                                            const pendingBatchedCalls = result.pendingBatchedCalls;

                                            if (!pendingBatchedCalls || pendingBatchedCalls.id !== requestId) {
                                                clearInterval(checkBatchedCalls);
                                            }
                                        });
                                    }, 100);

                                    // Timeout after 5 minutes
                                    setTimeout(() => {
                                        clearInterval(checkBatchedCalls);
                                        if (!responseSent) {
                                            sendResponseToInpage(false, undefined, 'Batched calls request timeout');
                                        }
                                    }, 300000);
                                } else if (messageType === 'SIGN_TRANSACTION' && response?.pending) {
                                    // Transaction pending - wait for approval
                                    let responseSent = false; // Prevent duplicate responses
                                    const requestId = response.requestId;

                                    const sendResponseToInpage = (success: boolean, transactionHash?: string, transaction?: any, error?: string) => {
                                        if (responseSent) return; // Already sent
                                        responseSent = true;

                                        // Clean up
                                        pendingTransactions.delete(event.data.id);

                                        // Build response object - some dapps expect transaction in result/data fields
                                        const responseObj: any = {
                                            success: success,
                                            transactionHash: transactionHash,
                                            transaction: transaction, // Include transaction object for dapp tracking
                                            error: error,
                                        };
                                        
                                        // Also include transaction in result/data for compatibility with libraries that expect it there
                                        // Always set result and data, even if transaction is undefined (set to null to match expected format)
                                        if (success) {
                                            responseObj.result = transaction || null;
                                            responseObj.data = transaction || null;
                                        } else {
                                            responseObj.result = null;
                                            responseObj.data = null;
                                        }
                                        
                                        console.log('[Wolfy Content] Sending response to inpage:', {
                                            success,
                                            hasTransaction: !!transaction,
                                            transactionFrom: transaction?.from,
                                            transactionHash: transactionHash
                                        });
                                        
                                        window.postMessage(
                                            {
                                                type: 'WOLFY_REQUEST_RESPONSE',
                                                id: event.data.id,
                                                response: responseObj,
                                            },
                                            '*'
                                        );
                                    };

                                    // Store the promise resolvers
                                    pendingTransactions.set(event.data.id, {
                                        resolve: (transactionHash: string, transaction?: any) => {
                                            sendResponseToInpage(true, transactionHash, transaction);
                                        },
                                        reject: (error: string) => {
                                            sendResponseToInpage(false, undefined, undefined, error);
                                        },
                                        requestId: requestId,
                                    });

                                    // Poll for transaction approval/rejection
                                    const checkTransaction = setInterval(() => {
                                        if (responseSent) {
                                            clearInterval(checkTransaction);
                                            return;
                                        }

                                        chrome.storage.local.get(['pendingTransaction'], (result) => {
                                            const pendingTransaction = result.pendingTransaction;

                                            // Check if transaction was resolved (cleared from storage)
                                            if (!pendingTransaction || pendingTransaction.id !== requestId) {
                                                clearInterval(checkTransaction);
                                                // Transaction was resolved - the message listener should have handled it
                                                // But if not, we'll timeout
                                            }
                                        });
                                    }, 100);

                                    // Timeout after 5 minutes
                                    setTimeout(() => {
                                        clearInterval(checkTransaction);
                                        if (!responseSent) {
                                            sendResponseToInpage(false, undefined, 'Transaction request timeout');
                                        }
                                    }, 300000);
                                } else {
                                    // Normal response - use fixed type to avoid loops
                                    const responseType = event.data.type === 'WOLFY_REQUEST'
                                        ? 'WOLFY_REQUEST_RESPONSE'
                                        : (event.data.type.endsWith('_RESPONSE')
                                            ? event.data.type
                                            : event.data.type + '_RESPONSE');

                                    window.postMessage(
                                        {
                                            type: responseType,
                                            id: event.data.id,
                                            response: response,
                                        },
                                        '*'
                                    );
                                }
                            }
                        );
                    } else {
                        // Unknown method
                        window.postMessage(
                            {
                                type: 'WOLFY_REQUEST_RESPONSE',
                                id: event.data.id,
                                response: {
                                    success: false,
                                    error: `Unknown method: ${method}`,
                                },
                            },
                            '*'
                        );
                    }
                } else if (event.data.type.startsWith('WOLFY_') && event.data.type !== 'WOLFY_REQUEST_RESPONSE') {
                    // Forward other WOLFY_ messages to background script (but NOT responses)
                    // Only forward actual requests, not responses to avoid infinite loops
                    if (!event.data.type.endsWith('_RESPONSE')) {
                        chrome.runtime.sendMessage(
                            event.data,
                            (response) => {
                                // Forward response back to in-page script
                                window.postMessage(
                                    {
                                        type: event.data.type + '_RESPONSE',
                                        id: event.data.id,
                                        response: response,
                                    },
                                    '*'
                                );
                            }
                        );
                    }
                    // Silently ignore response messages to prevent loops
                }
            }
        },
        false
    );
})();

