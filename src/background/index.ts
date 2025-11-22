// Service worker entry point
console.log('[Wolfy] Service worker starting...');

// Import all dependencies
import { ethers } from 'ethers';
import { Wallet } from '../core/wallet.js';
import { EIP7702 } from '../eips/eip7702.js';
import { EIP5742 } from '../eips/eip5742.js';
import { HaloChip } from '../halo/halo.js';
import { handleSignMessage, handleSignTypedData } from './message-handler.js';
import type { Transaction, EIP7702Transaction, EIP5742Batch } from '../core/types.js';
import { updateLockIndicator } from './icon-utils.js';

console.log('[Wolfy] Imports loaded');

const wallet = new Wallet();
let walletInitialized = false;

// Notification URL for connection windows
const notificationUrl = chrome.runtime.getURL('notification/index.html');
const notificationWindowIds = new Set<number>();
let isCreatingNotificationWindow = false; // Lock to prevent race conditions

// Ensure wallet is initialized
async function ensureWalletReady() {
    if (!walletInitialized) {
        try {
            await wallet.loadState();
            walletInitialized = true;
        } catch (error: any) {
            console.error('[Wolfy] Error loading wallet state:', error);
            walletInitialized = true; // Continue with default state
        }
    }
}

// Initialize wallet and RPC service
(async () => {
    try {
        await ensureWalletReady();
        console.log('[Wolfy] Wallet initialized');

        // Update icon/badge based on initial lock state
        const isUnlocked = wallet.isUnlocked();
        await updateLockIndicator(!isUnlocked);

        // Initialize RPC service
        const { rpcService } = await import('../core/rpc-service.js');
        await rpcService.init();
        console.log('[Wolfy] RPC service initialized');
    } catch (error: any) {
        console.error('[Wolfy] Initialization error:', error);
    }
})();

// Register in-page content script (MAIN world) for provider injection
// This is required for Manifest V3 - provider must be in MAIN world, not isolated
const registerInPageContentScript = async () => {
    try {
        // First, try to unregister any existing script with the same ID
        try {
            await chrome.scripting.unregisterContentScripts({ ids: ['wolfy-provider'] });
        } catch (e) {
            // Ignore if not registered
        }

        // Register the script
        await chrome.scripting.registerContentScripts([
            {
                id: 'wolfy-provider',
                matches: ['file://*/*', 'http://*/*', 'https://*/*'],
                js: ['inpage.js'],
                runAt: 'document_start',
                world: 'MAIN',
                allFrames: true,
            },
        ]);
        console.log('[Wolfy] ✅ Successfully registered in-page provider script');

        // Verify registration
        const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: ['wolfy-provider'] });
        if (scripts && scripts.length > 0) {
            console.log('[Wolfy] ✅ Provider script registration verified');
        } else {
            console.error('[Wolfy] ❌ Provider script registration failed - script not found');
        }
    } catch (err: any) {
        console.error('[Wolfy] ❌ Failed to register provider script:', err);
        // Don't throw - extension should still work
    }
};

// Initialize on install/startup
chrome.runtime.onInstalled.addListener(async () => {
    await ensureWalletReady();
    await registerInPageContentScript();
    console.log('[Wolfy] Wallet installed');
});

chrome.runtime.onStartup.addListener(async () => {
    await ensureWalletReady();
    await registerInPageContentScript();
    console.log('[Wolfy] Wallet started');
});

// Also register on extension load
registerInPageContentScript();

// Inject script into all existing tabs when extension loads
// This ensures provider is available on already-open pages
const injectIntoExistingTabs = async () => {
    try {
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
            if (tab.id && tab.url &&
                (tab.url.startsWith('http://') ||
                    tab.url.startsWith('https://') ||
                    tab.url.startsWith('file://'))) {
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['inpage.js'],
                        world: 'MAIN',
                    });
                    console.log(`[Wolfy] ✅ Injected into tab ${tab.id}: ${tab.url}`);
                } catch (err: any) {
                    // Ignore errors (tab might not be accessible, e.g., chrome:// pages)
                    if (!err.message?.includes('Cannot access')) {
                        console.warn(`[Wolfy] Failed to inject into tab ${tab.id}:`, err.message);
                    }
                }
            }
        }
    } catch (err) {
        console.error('[Wolfy] Error injecting into tabs:', err);
    }
};

// Inject into existing tabs after a short delay to ensure extension is ready
setTimeout(() => {
    injectIntoExistingTabs();
}, 100);

// Message handler
function handleMessage(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
): boolean {
    // Only log non-PING messages to reduce spam
    if (message?.type !== 'PING') {
        console.log('[Wolfy] Message received:', message?.type);
    }

    if (!message || !message.type) {
        sendResponse({ success: false, error: 'Invalid message' });
        return false;
    }

    let responded = false;
    const safeSendResponse = (response: any) => {
        if (!responded) {
            responded = true;
            try {
                sendResponse(response);
            } catch (error) {
                console.error('[Wolfy] Error sending response:', error);
            }
        }
    };

    // Handle async operations
    (async () => {
        try {
            await ensureWalletReady();

            switch (message.type) {
                case 'PING':
                    safeSendResponse({ success: true, pong: true });
                    break;

                case 'CONNECT_DAPP':
                    try {
                        // Open notification window for connection approval
                        const origin = message.origin || sender.origin || 'unknown';
                        const name = message.name || 'Unknown DApp';
                        const icon = message.icon || '';

                        // Detect other wallets (passed from content script)
                        const detectedProviders = message.providers || [];

                        // Check if there's already a pending connection for this origin
                        const storage = await chrome.storage.local.get(['pendingConnection', 'dapp_connections']);
                        const pendingConnection = storage.pendingConnection;
                        const dappConnections = storage.dapp_connections || {};

                        // If already connected, don't show popup
                        if (dappConnections[origin]) {
                            console.log('[CONNECT_DAPP] DApp already connected:', origin);
                            safeSendResponse({
                                success: true,
                                pending: false,
                                alreadyConnected: true,
                            });
                            break;
                        }

                        // FIRST: Check if ANY notification window is already open (regardless of origin)
                        // This prevents multiple modals from opening simultaneously
                        try {
                            const windows = await chrome.windows.getAll({ populate: true });
                            const existingNotificationWindow = windows.find(win => {
                                if (!win.tabs || win.tabs.length === 0) return false;
                                return win.tabs.some(tab => tab.url === notificationUrl);
                            });

                            if (existingNotificationWindow && existingNotificationWindow.id) {
                                // A notification window is already open - focus it and update pending connection
                                console.log('[CONNECT_DAPP] Notification window already open, focusing it');
                                
                                // Update pending connection to this origin (in case it's a different dapp)
                                await chrome.storage.local.set({
                                    pendingConnection: {
                                        origin,
                                        name,
                                        icon,
                                        providers: detectedProviders,
                                        tabId: sender.tab?.id,
                                    }
                                });
                                
                                await chrome.windows.update(existingNotificationWindow.id, { focused: true });
                                // Ensure it's tracked
                                notificationWindowIds.add(existingNotificationWindow.id);
                                safeSendResponse({
                                    success: true,
                                    pending: true,
                                    windowFocused: true,
                                });
                                break;
                            }
                        } catch (error) {
                            // If we can't check windows, continue to create a new one
                            console.warn('[CONNECT_DAPP] Could not check existing windows:', error);
                        }

                        // SECOND: Check if we're already creating a window (prevent race conditions)
                        if (isCreatingNotificationWindow) {
                            console.log('[CONNECT_DAPP] Window creation already in progress, waiting...');
                            // Wait a bit and check again
                            await new Promise(resolve => setTimeout(resolve, 100));
                            
                            // Re-check if window was created
                            const windows = await chrome.windows.getAll({ populate: true });
                            const existingWindow = windows.find(win => {
                                if (!win.tabs || win.tabs.length === 0) return false;
                                return win.tabs.some(tab => tab.url === notificationUrl);
                            });
                            
                            if (existingWindow && existingWindow.id) {
                                await chrome.storage.local.set({
                                    pendingConnection: {
                                        origin,
                                        name,
                                        icon,
                                        providers: detectedProviders,
                                        tabId: sender.tab?.id,
                                    }
                                });
                                await chrome.windows.update(existingWindow.id, { focused: true });
                                notificationWindowIds.add(existingWindow.id);
                                safeSendResponse({
                                    success: true,
                                    pending: true,
                                    windowFocused: true,
                                });
                                break;
                            }
                        }

                        // Set lock to prevent concurrent window creation
                        isCreatingNotificationWindow = true;

                        try {
                            // Store pending connection request
                            await chrome.storage.local.set({
                                pendingConnection: {
                                    origin,
                                    name,
                                    icon,
                                    providers: detectedProviders,
                                    tabId: sender.tab?.id,
                                }
                            });

                            // Get screen dimensions to position window on the right
                            const windowWidth = 400;
                            const windowHeight = 600;
                            const margin = 20; // Margin from screen edge
                            const top = 100; // Position from top

                            let left: number;
                            try {
                                // Try to get actual screen dimensions
                                const displayInfo = await chrome.system.display.getInfo();
                                const primaryDisplay = displayInfo[0];
                                const screenWidth = primaryDisplay.workArea.width;
                                left = screenWidth - windowWidth - margin;
                            } catch (error) {
                                // Fallback: Use a reasonable default (assumes 1920px screen)
                                // Position on right side with margin
                                left = 1920 - windowWidth - margin;
                            }

                            // Open notification window on the right side
                            const window = await chrome.windows.create({
                                url: notificationUrl,
                                type: 'popup',
                                width: windowWidth,
                                height: windowHeight,
                                left: left,
                                top: top,
                                focused: true,
                            });

                            // Track this notification window
                            if (window.id) {
                                notificationWindowIds.add(window.id);
                            }

                            safeSendResponse({
                                success: true,
                                pending: true,
                            });
                        } finally {
                            // Always release the lock
                            isCreatingNotificationWindow = false;
                        }
                    } catch (error: any) {
                        // Release lock on error too
                        isCreatingNotificationWindow = false;
                        console.error('[CONNECT_DAPP] Error:', error);
                        safeSendResponse({
                            success: false,
                            error: error.message || 'Failed to open connection window',
                        });
                    }
                    break;

                case 'APPROVE_CONNECTION':
                    try {
                        const origin = message.origin;
                        const account = message.account;

                        // Store connection permission
                        const connections = await chrome.storage.local.get('dapp_connections') || {};
                        const dappConnections = connections.dapp_connections || {};
                        const pending = await chrome.storage.local.get('pendingConnection');

                        if (pending.pendingConnection) {
                            dappConnections[origin] = {
                                name: pending.pendingConnection.name,
                                icon: pending.pendingConnection.icon,
                                account: account,
                                connectedAt: Date.now(),
                            };
                            await chrome.storage.local.set({
                                dapp_connections: dappConnections,
                                pendingConnection: null
                            });

                            // Clean up notification window tracking
                            // Find and remove the notification window ID
                            const windows = await chrome.windows.getAll({ populate: true });
                            const notificationWindow = windows.find(win => {
                                if (!win.tabs || win.tabs.length === 0) return false;
                                return win.tabs.some(tab => tab.url === notificationUrl);
                            });
                            if (notificationWindow?.id) {
                                notificationWindowIds.delete(notificationWindow.id);
                            }
                        }

                        safeSendResponse({ success: true });
                    } catch (error: any) {
                        console.error('[APPROVE_CONNECTION] Error:', error);
                        safeSendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'REJECT_CONNECTION':
                    try {
                        await chrome.storage.local.set({ pendingConnection: null });
                        
                        // Clean up notification window tracking
                        const windows = await chrome.windows.getAll({ populate: true });
                        const notificationWindow = windows.find(win => {
                            if (!win.tabs || win.tabs.length === 0) return false;
                            return win.tabs.some(tab => tab.url === notificationUrl);
                        });
                        if (notificationWindow?.id) {
                            notificationWindowIds.delete(notificationWindow.id);
                        }
                        
                        safeSendResponse({ success: true });
                    } catch (error: any) {
                        safeSendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'APPROVE_SIGNATURE':
                    try {
                        const requestId = message.requestId;
                        const storage = await chrome.storage.local.get('pendingSignature');
                        const pendingSignature = storage.pendingSignature;
                        
                        if (!pendingSignature || pendingSignature.id !== requestId) {
                            safeSendResponse({ success: false, error: 'Signature request not found' });
                            break;
                        }
                        
                        // Sign the message
                        let result;
                        if (pendingSignature.isTypedData) {
                            result = await handleSignTypedData(
                                pendingSignature.address,
                                pendingSignature.typedData,
                                wallet
                            );
                        } else {
                            result = await handleSignMessage(
                                pendingSignature.message,
                                pendingSignature.address,
                                wallet
                            );
                        }
                        
                        // Clear pending signature
                        await chrome.storage.local.set({ pendingSignature: null });
                        
                        // Send response to content script
                        if (pendingSignature.tabId) {
                            try {
                                await chrome.tabs.sendMessage(pendingSignature.tabId, {
                                    type: 'SIGNATURE_APPROVED',
                                    requestId: requestId,
                                    signature: result.signature,
                                });
                            } catch (error) {
                                console.error('[APPROVE_SIGNATURE] Error sending to content script:', error);
                            }
                        }
                        
                        safeSendResponse({ success: true, signature: result.signature });
                    } catch (error: any) {
                        console.error('[APPROVE_SIGNATURE] Error:', error);
                        safeSendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'REJECT_SIGNATURE':
                    try {
                        const requestId = message.requestId;
                        const storage = await chrome.storage.local.get('pendingSignature');
                        const pendingSignature = storage.pendingSignature;
                        
                        if (!pendingSignature || pendingSignature.id !== requestId) {
                            safeSendResponse({ success: false, error: 'Signature request not found' });
                            break;
                        }
                        
                        // Clear pending signature
                        await chrome.storage.local.set({ pendingSignature: null });
                        
                        // Send rejection to content script
                        if (pendingSignature.tabId) {
                            try {
                                await chrome.tabs.sendMessage(pendingSignature.tabId, {
                                    type: 'SIGNATURE_REJECTED',
                                    requestId: requestId,
                                });
                            } catch (error) {
                                console.error('[REJECT_SIGNATURE] Error sending to content script:', error);
                            }
                        }
                        
                        safeSendResponse({ success: true });
                    } catch (error: any) {
                        console.error('[REJECT_SIGNATURE] Error:', error);
                        safeSendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'APPROVE_TRANSACTION':
                    try {
                        const requestId = message.requestId;
                        const storage = await chrome.storage.local.get('pendingTransaction');
                        const pendingTransaction = storage.pendingTransaction;
                        
                        if (!pendingTransaction || pendingTransaction.id !== requestId) {
                            safeSendResponse({ success: false, error: 'Transaction request not found' });
                            break;
                        }
                        
                        // Get account
                        const account = wallet.getAccounts().find(
                            acc => acc.address.toLowerCase() === pendingTransaction.address.toLowerCase()
                        );
                        if (!account) {
                            safeSendResponse({ success: false, error: 'Account not found' });
                            break;
                        }
                        
                        // Get provider and sign transaction
                        const provider = await wallet.getProvider();
                        // Use updated transaction from message if provided, otherwise use original
                        const txParams = message.transaction || pendingTransaction.transaction;
                        
                        // Build transaction object
                        const transaction: any = {
                            to: txParams.to,
                            value: txParams.value ? BigInt(txParams.value) : undefined,
                            data: txParams.data || '0x',
                            gasLimit: txParams.gasLimit ? BigInt(txParams.gasLimit) : undefined,
                            gasPrice: txParams.gasPrice ? BigInt(txParams.gasPrice) : undefined,
                            maxFeePerGas: txParams.maxFeePerGas ? BigInt(txParams.maxFeePerGas) : undefined,
                            maxPriorityFeePerGas: txParams.maxPriorityFeePerGas ? BigInt(txParams.maxPriorityFeePerGas) : undefined,
                            nonce: txParams.nonce,
                            chainId: txParams.chainId,
                            type: txParams.type,
                        };
                        
                        // Sign the transaction
                        let signedTx: string;
                        if (account.isChipAccount && account.chipInfo) {
                            // Chip account - sign with the chip
                            const { HaloSigner } = await import('../halo/halo-signer.js');
                            const haloSigner = new HaloSigner(account.address, account.chipInfo.slot, provider);
                            signedTx = await haloSigner.signTransaction(transaction);
                        } else {
                            // Regular account - use ethers Wallet
                            const privateKey = await wallet.getPrivateKey(account.address);
                            if (!privateKey) {
                                throw new Error('Private key not found');
                            }
                            const signerWallet = new ethers.Wallet(privateKey, provider);
                            const populatedTx = await signerWallet.populateTransaction(transaction);
                            signedTx = await signerWallet.signTransaction(populatedTx);
                        }
                        
                        // Broadcast the transaction
                        const txResponse = await provider.broadcastTransaction(signedTx);
                        const tx = ethers.Transaction.from(signedTx);
                        const txHash = tx.hash || (typeof txResponse === 'string' ? txResponse : txResponse?.hash);
                        
                        // Clear pending transaction
                        await chrome.storage.local.set({ pendingTransaction: null });
                        
                        // Send response to content script
                        if (pendingTransaction.tabId) {
                            try {
                                await chrome.tabs.sendMessage(pendingTransaction.tabId, {
                                    type: 'TRANSACTION_APPROVED',
                                    requestId: requestId,
                                    transactionHash: txHash,
                                });
                            } catch (error) {
                                console.error('[APPROVE_TRANSACTION] Error sending to content script:', error);
                            }
                        }
                        
                        safeSendResponse({ success: true, transactionHash: txHash });
                    } catch (error: any) {
                        console.error('[APPROVE_TRANSACTION] Error:', error);
                        safeSendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'REJECT_TRANSACTION':
                    try {
                        const requestId = message.requestId;
                        const storage = await chrome.storage.local.get('pendingTransaction');
                        const pendingTransaction = storage.pendingTransaction;
                        
                        if (!pendingTransaction || pendingTransaction.id !== requestId) {
                            safeSendResponse({ success: false, error: 'Transaction request not found' });
                            break;
                        }
                        
                        // Clear pending transaction
                        await chrome.storage.local.set({ pendingTransaction: null });
                        
                        // Send rejection to content script
                        if (pendingTransaction.tabId) {
                            try {
                                await chrome.tabs.sendMessage(pendingTransaction.tabId, {
                                    type: 'TRANSACTION_REJECTED',
                                    requestId: requestId,
                                });
                            } catch (error) {
                                console.error('[REJECT_TRANSACTION] Error sending to content script:', error);
                            }
                        }
                        
                        safeSendResponse({ success: true });
                    } catch (error: any) {
                        console.error('[REJECT_TRANSACTION] Error:', error);
                        safeSendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'GET_ACCOUNTS':
                    try {
                        // Check if this is from a connected dApp
                        const origin = sender.origin || message.origin;
                        let accountsToReturn = wallet.getAccounts();

                        if (origin) {
                            const connections = await chrome.storage.local.get('dapp_connections');
                            const dappConnections = connections.dapp_connections || {};
                            const connection = dappConnections[origin];

                            if (connection && connection.account) {
                                // Return only the connected account for this dApp
                                accountsToReturn = accountsToReturn.filter(
                                    acc => acc.address.toLowerCase() === connection.account.toLowerCase()
                                );
                            }
                        }

                        // Check HaLo link status and get chip info for each account
                        const accountsWithHalo = await Promise.all(
                            accountsToReturn.map(async (account) => {
                                const isLinked = await HaloChip.isAccountLinked(account.address);
                                let chipAddress: string | undefined;
                                if (isLinked) {
                                    const linkInfo = await HaloChip.getLinkInfo(account.address);
                                    chipAddress = linkInfo?.chipAddress;
                                }
                                console.log(`[GET_ACCOUNTS] Account ${account.address}: haloLinked=${isLinked}, chipAddress=${chipAddress}`);
                                return {
                                    ...account,
                                    haloLinked: isLinked,
                                    haloChipAddress: chipAddress,
                                };
                            })
                        );
                        safeSendResponse({
                            success: true,
                            accounts: accountsWithHalo,
                        });
                    } catch (error: any) {
                        console.error('[GET_ACCOUNTS] Error:', error);
                        // Fallback to accounts without halo status
                        safeSendResponse({
                            success: true,
                            accounts: wallet.getAccounts(),
                        });
                    }
                    break;

                case 'GET_SELECTED_ACCOUNT':
                    try {
                        const account = wallet.getSelectedAccount();
                        if (account) {
                            // Check HaLo link status and get chip info
                            const isLinked = await HaloChip.isAccountLinked(account.address);
                            let chipAddress: string | undefined;
                            if (isLinked) {
                                const linkInfo = await HaloChip.getLinkInfo(account.address);
                                chipAddress = linkInfo?.chipAddress;
                            }
                            safeSendResponse({
                                success: true,
                                account: {
                                    ...account,
                                    haloLinked: isLinked,
                                    haloChipAddress: chipAddress,
                                },
                            });
                        } else {
                            safeSendResponse({
                                success: true,
                                account: null,
                            });
                        }
                    } catch (error: any) {
                        console.error('[GET_SELECTED_ACCOUNT] Error:', error);
                        // Fallback
                        safeSendResponse({
                            success: true,
                            account: wallet.getSelectedAccount(),
                        });
                    }
                    break;

                case 'CREATE_ACCOUNT':
                    try {
                        const newAccount = await wallet.createAccount(message.name);
                        safeSendResponse({ success: true, account: newAccount });
                    } catch (error: any) {
                        console.error('[Wolfy] Error creating account:', error);
                        safeSendResponse({
                            success: false,
                            error: error.message || 'Failed to create account',
                        });
                    }
                    break;

                case 'DELETE_ACCOUNT':
                    if (!wallet.isUnlocked()) {
                        safeSendResponse({ success: false, error: 'Wallet is locked' });
                        break;
                    }
                    try {
                        const addressToDelete = message.address;
                        if (!addressToDelete) {
                            safeSendResponse({ success: false, error: 'Address is required' });
                            break;
                        }

                        await wallet.deleteAccount(addressToDelete);
                        safeSendResponse({ success: true });
                    } catch (error: any) {
                        console.error('[Wolfy] Error deleting account:', error);
                        safeSendResponse({
                            success: false,
                            error: error.message || 'Failed to delete account',
                        });
                    }
                    break;

                case 'CREATE_ACCOUNT_FROM_CHIP':
                    try {
                        if (!message.chipAddress || !message.chipPublicKey) {
                            safeSendResponse({
                                success: false,
                                error: 'Chip address and public key required',
                            });
                            break;
                        }
                        const chipAccount = await wallet.createAccountFromChip(
                            message.chipAddress,
                            message.chipPublicKey,
                            message.slot || 1,
                            message.name
                        );
                        safeSendResponse({ success: true, account: chipAccount });
                    } catch (error: any) {
                        console.error('[Wolfy] Error creating account from chip:', error);
                        safeSendResponse({
                            success: false,
                            error: error.message || 'Failed to create account from chip',
                        });
                    }
                    break;

                case 'CREATE_ACCOUNT_FROM_FIREFLY':
                    try {
                        if (!message.fireflyAddress || !message.deviceInfo) {
                            safeSendResponse({
                                success: false,
                                error: 'Firefly address and device info required',
                            });
                            break;
                        }
                        const fireflyAccount = await wallet.createAccountFromFirefly(
                            message.fireflyAddress,
                            message.deviceInfo,
                            message.name
                        );
                        safeSendResponse({ success: true, account: fireflyAccount });
                    } catch (error: any) {
                        console.error('[Wolfy] Error creating account from Firefly:', error);
                        safeSendResponse({
                            success: false,
                            error: error.message || 'Failed to create account from Firefly',
                        });
                    }
                    break;

                case 'CREATE_MULTISIG_ACCOUNT':
                    try {
                        if (!message.chips || !Array.isArray(message.chips) || message.chips.length < 2) {
                            safeSendResponse({
                                success: false,
                                error: 'At least 2 chips required for multisig',
                            });
                            break;
                        }
                        if (!message.threshold || message.threshold < 1 || message.threshold > message.chips.length) {
                            safeSendResponse({
                                success: false,
                                error: `Threshold must be between 1 and ${message.chips.length}`,
                            });
                            break;
                        }
                        const multisigAccount = await wallet.createMultisigAccount(
                            message.chips,
                            message.threshold,
                            message.name
                        );
                        safeSendResponse({ success: true, account: multisigAccount });
                    } catch (error: any) {
                        console.error('[Wolfy] Error creating multisig account:', error);
                        safeSendResponse({
                            success: false,
                            error: error.message || 'Failed to create multisig account',
                        });
                    }
                    break;

                case 'IMPORT_ACCOUNT':
                    try {
                        if (!message.privateKey || typeof message.privateKey !== 'string') {
                            safeSendResponse({
                                success: false,
                                error: 'Invalid private key provided',
                            });
                            break;
                        }
                        const privateKey = message.privateKey.trim();
                        const importedAccount = await wallet.importAccount(privateKey, message.name);
                        safeSendResponse({ success: true, account: importedAccount });
                    } catch (error: any) {
                        console.error('[Wolfy] Error importing account:', error);
                        safeSendResponse({
                            success: false,
                            error: error.message || 'Failed to import account',
                        });
                    }
                    break;

                case 'ADD_WATCH_ADDRESS':
                    try {
                        if (!message.address || typeof message.address !== 'string') {
                            safeSendResponse({
                                success: false,
                                error: 'Invalid address provided',
                            });
                            break;
                        }
                        const watchAccount = await wallet.addWatchAddress(message.address, message.name);
                        safeSendResponse({ success: true, account: watchAccount });
                    } catch (error: any) {
                        console.error('[Wolfy] Error adding watch address:', error);
                        safeSendResponse({
                            success: false,
                            error: error.message || 'Failed to add watch address',
                        });
                    }
                    break;

                case 'SET_SELECTED_ACCOUNT':
                    await wallet.setSelectedAccount(message.address);
                    safeSendResponse({ success: true });
                    break;

                case 'UPDATE_ACCOUNT_NAME':
                    try {
                        if (!message.address || !message.name) {
                            safeSendResponse({
                                success: false,
                                error: 'Address and name are required',
                            });
                            break;
                        }
                        await wallet.updateAccountName(message.address, message.name);
                        safeSendResponse({ success: true });
                    } catch (error: any) {
                        console.error('[Wolfy] Error updating account name:', error);
                        safeSendResponse({
                            success: false,
                            error: error.message || 'Failed to update account name',
                        });
                    }
                    break;

                case 'EXPORT_PRIVATE_KEY':
                    try {
                        if (!wallet.isUnlocked()) {
                            safeSendResponse({ success: false, error: 'Wallet is locked' });
                            break;
                        }
                        if (!message.address) {
                            safeSendResponse({
                                success: false,
                                error: 'Address is required',
                            });
                            break;
                        }
                        // Verify password
                        const { verifyPassword } = await import('../core/password.js');
                        const isValid = await verifyPassword(message.password);
                        if (!isValid) {
                            safeSendResponse({ success: false, error: 'Incorrect password' });
                            break;
                        }
                        // Get private key
                        const account = wallet.getAccounts().find(
                            acc => acc.address.toLowerCase() === message.address.toLowerCase()
                        );
                        if (!account || account.isWatchOnly) {
                            safeSendResponse({ success: false, error: 'Account not found or is watch-only' });
                            break;
                        }
                        // Get private key using wallet's method (handles case normalization)
                        const privateKey = await wallet.getPrivateKey(message.address);
                        
                        if (!privateKey) {
                            // Check if this is a watch-only or chip account
                            if (account.isWatchOnly) {
                                safeSendResponse({ success: false, error: 'Cannot export private key for watch-only addresses' });
                            } else if (account.isChipAccount || account.haloLinked) {
                                safeSendResponse({ success: false, error: 'Cannot export private key for HaLo chip accounts. These accounts use hardware keys.' });
                            } else {
                                // Debug: Check what's actually in storage
                                const normalizedAddress = message.address.toLowerCase();
                                const allKeys = await chrome.storage.local.get(null);
                                const keyPattern = Object.keys(allKeys).filter(k => k.startsWith('key_'));
                                console.log('[EXPORT_PRIVATE_KEY] Debug - Looking for key:', `key_${normalizedAddress}`);
                                console.log('[EXPORT_PRIVATE_KEY] Debug - All key_* entries:', keyPattern);
                                safeSendResponse({ success: false, error: 'Private key not found. This account may have been created before private key storage was implemented, or the key was deleted. Please re-import the account with its private key.' });
                            }
                            break;
                        }
                        safeSendResponse({ success: true, privateKey });
                    } catch (error: any) {
                        console.error('[Wolfy] Error exporting private key:', error);
                        safeSendResponse({
                            success: false,
                            error: error.message || 'Failed to export private key',
                        });
                    }
                    break;

                case 'ACCOUNT_CHANGED':
                    try {
                        // Update all connected dapp connections to use the new account
                        const connections = await chrome.storage.local.get('dapp_connections');
                        const dappConnections = connections.dapp_connections || {};
                        const newAccountAddress = message.account;
                        
                        // Update all connections
                        const updatedConnections: any = {};
                        const connectedOrigins: string[] = [];
                        
                        for (const [origin, connection] of Object.entries(dappConnections)) {
                            updatedConnections[origin] = {
                                ...(connection as any),
                                account: newAccountAddress,
                            };
                            connectedOrigins.push(origin);
                        }
                        
                        // Save updated connections
                        await chrome.storage.local.set({ dapp_connections: updatedConnections });
                        
                        // Notify all connected dapps about the account change
                        if (connectedOrigins.length > 0) {
                            // Get all tabs and find ones that match connected origins
                            const tabs = await chrome.tabs.query({});
                            const accountAddresses = [newAccountAddress];
                            
                            for (const tab of tabs) {
                                if (!tab.id || !tab.url) continue;
                                
                                try {
                                    const url = new URL(tab.url);
                                    const origin = url.origin;
                                    
                                    // If this tab's origin is connected, notify it
                                    if (connectedOrigins.includes(origin)) {
                                        try {
                                            await chrome.tabs.sendMessage(tab.id, {
                                                type: 'ACCOUNT_CHANGED',
                                                accounts: accountAddresses,
                                                origin: origin,
                                            });
                                            console.log(`[ACCOUNT_CHANGED] Notified tab ${tab.id} (${origin})`);
                                        } catch (error: any) {
                                            // Tab might not have content script loaded, ignore
                                            if (!error.message?.includes('Could not establish connection')) {
                                                console.warn(`[ACCOUNT_CHANGED] Error notifying tab ${tab.id}:`, error);
                                            }
                                        }
                                    }
                                } catch (e) {
                                    // Invalid URL (chrome://, etc.), skip
                                }
                            }
                        }
                        
                        safeSendResponse({ success: true });
                    } catch (error: any) {
                        console.error('[ACCOUNT_CHANGED] Error:', error);
                        safeSendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'SIGN_TRANSACTION':
                    if (!wallet.isUnlocked()) {
                        safeSendResponse({ success: false, error: 'Wallet is locked' });
                        break;
                    }
                    try {
                        // Check if this is a DApp request (has sender.tab) vs internal wallet operation
                        const isDAppRequest = sender.tab && sender.tab.id;
                        
                        // Get origin to check if it's chrome-extension (auto-sign internal requests)
                        let origin = sender.origin || sender.url || 'Unknown';
                        // Extract origin from URL if needed
                        try {
                            if (origin.startsWith('http://') || origin.startsWith('https://')) {
                                origin = new URL(origin).origin;
                            }
                        } catch {
                            // If URL parsing fails, use as-is
                        }
                        
                        // Auto-sign chrome-extension origins (internal wallet operations)
                        const isChromeExtension = origin.startsWith('chrome-extension://');
                        
                        if (isDAppRequest && !isChromeExtension) {
                            // DApp transaction request - show approval modal
                            const tabId = sender.tab?.id;
                            
                            // Get DApp info from connections
                            const connections = await chrome.storage.local.get('dapp_connections') || {};
                            const dappConnections = connections.dapp_connections || {};
                            let dappInfo;
                            try {
                                dappInfo = dappConnections[origin] || {
                                    name: origin !== 'Unknown' ? new URL(origin).hostname : 'Unknown DApp',
                                    icon: '',
                                };
                            } catch {
                                dappInfo = {
                                    name: origin !== 'Unknown' ? origin : 'Unknown DApp',
                                    icon: '',
                                };
                            }
                            
                            // Get selected account for transaction
                            const account = wallet.getSelectedAccount();
                            if (!account) {
                                safeSendResponse({ success: false, error: 'No account selected' });
                                break;
                            }
                            
                            // Store pending transaction request
                            const requestId = `tx_${Date.now()}_${Math.random()}`;
                            await chrome.storage.local.set({
                                pendingTransaction: {
                                    id: requestId,
                                    transaction: message.transaction,
                                    address: account.address,
                                    origin: origin,
                                    dappName: dappInfo.name,
                                    dappIcon: dappInfo.icon,
                                    tabId: tabId,
                                }
                            });
                            
                            // Check if notification window already exists
                            try {
                                const windows = await chrome.windows.getAll({ populate: true });
                                const existingWindow = windows.find(win => {
                                    if (!win.tabs || win.tabs.length === 0) return false;
                                    return win.tabs.some(tab => tab.url === notificationUrl);
                                });
                                
                                if (existingWindow && existingWindow.id) {
                                    // Update URL to show transaction request
                                    await chrome.tabs.update(existingWindow.tabs![0].id!, {
                                        url: `${notificationUrl}?type=transaction&requestId=${requestId}`
                                    });
                                    await chrome.windows.update(existingWindow.id, { focused: true });
                                    notificationWindowIds.add(existingWindow.id);
                                    safeSendResponse({ success: true, pending: true, requestId });
                                    break;
                                }
                            } catch (error) {
                                console.warn('[SIGN_TRANSACTION] Could not check existing windows:', error);
                            }
                            
                            // Create new notification window
                            const windowWidth = 400;
                            const windowHeight = 600;
                            const margin = 20;
                            const top = 100;
                            
                            let left: number;
                            try {
                                const displayInfo = await chrome.system.display.getInfo();
                                const primaryDisplay = displayInfo[0];
                                const screenWidth = primaryDisplay.workArea.width;
                                left = screenWidth - windowWidth - margin;
                            } catch (error) {
                                left = 1920 - windowWidth - margin;
                            }
                            
                            const window = await chrome.windows.create({
                                url: `${notificationUrl}?type=transaction&requestId=${requestId}`,
                                type: 'popup',
                                width: windowWidth,
                                height: windowHeight,
                                left: left,
                                top: top,
                                focused: true,
                            });
                            
                            if (window.id) {
                                notificationWindowIds.add(window.id);
                            }
                            
                            safeSendResponse({ success: true, pending: true, requestId });
                            break;
                        }
                        
                        // Internal wallet operation or chrome-extension - sign directly without modal
                        const account = wallet.getSelectedAccount();
                        if (!account) {
                            safeSendResponse({ success: false, error: 'No account selected' });
                            break;
                        }

                        // Check for multisig account
                        if (account.multisig) {
                            // Multisig signing - collect signatures from multiple chips
                            const provider = await wallet.getProvider();
                            const { HaloSigner } = await import('../halo/halo-signer.js');

                            // Serialize transaction for signing
                            const serializedTx = ethers.Transaction.from({
                                to: message.transaction.to,
                                value: message.transaction.value,
                                data: message.transaction.data,
                                gasLimit: message.transaction.gasLimit,
                                gasPrice: message.transaction.gasPrice
                                    ? BigInt(message.transaction.gasPrice)
                                    : undefined,
                                maxFeePerGas: message.transaction.maxFeePerGas
                                    ? BigInt(message.transaction.maxFeePerGas)
                                    : undefined,
                                maxPriorityFeePerGas: message.transaction.maxPriorityFeePerGas
                                    ? BigInt(message.transaction.maxPriorityFeePerGas)
                                    : undefined,
                                nonce: message.transaction.nonce,
                                chainId: message.transaction.chainId,
                                type: message.transaction.type,
                            });

                            const unsignedTx = serializedTx.unsignedSerialized;
                            const txHash = ethers.keccak256(unsignedTx);

                            // Collect signatures from required chips
                            const signatures: Array<{ chipAddress: string; signature: string; slot: number }> = [];
                            const chipsToSign = message.chipIndices ||
                                account.multisig.chips.slice(0, account.multisig.threshold).map((_, i) => i);

                            for (const chipIndex of chipsToSign.slice(0, account.multisig.threshold)) {
                                const chip = account.multisig.chips[chipIndex];
                                if (!chip) {
                                    throw new Error(`Chip ${chipIndex} not found`);
                                }

                                // Sign with this chip
                                const signResponse = await HaloChip.sign(txHash, {
                                    slot: chip.slot,
                                });

                                if (!signResponse.success || !signResponse.data?.signature) {
                                    throw new Error(`Failed to sign with chip ${chipIndex + 1} (${chip.address})`);
                                }

                                signatures.push({
                                    chipAddress: chip.address,
                                    signature: signResponse.data.signature,
                                    slot: chip.slot,
                                });

                                console.log(`[Multisig] Chip ${chipIndex + 1} (${chip.address}) signed successfully`);
                            }

                            // Return signatures with chip identification
                            // In production, these would be combined in a smart contract
                            safeSendResponse({
                                success: true,
                                signedTransaction: null, // Multisig requires smart contract
                                multisigSignatures: signatures,
                                threshold: account.multisig.threshold,
                                totalChips: account.multisig.chips.length,
                                message: 'Multisig signatures collected. Requires smart contract deployment to combine.',
                            });
                            break;
                        }

                        // Check if account is chip account (single chip)
                        if (account.isChipAccount && account.chipInfo) {
                            // Chip account - sign with the chip
                            const provider = await wallet.getProvider();
                            const { HaloSigner } = await import('../halo/halo-signer.js');
                            const haloSigner = new HaloSigner(account.address, account.chipInfo.slot, provider);
                            const signedTx = await haloSigner.signTransaction(message.transaction);
                            safeSendResponse({
                                success: true,
                                signedTransaction: signedTx,
                                signedWithHalo: true,
                                chipAddress: account.chipInfo.address,
                            });
                            break;
                        }

                        // Check if account is linked to HaLo chip (legacy linking)
                        const isHaloLinked = await HaloChip.isAccountLinked(account.address);
                        if (isHaloLinked) {
                            // SECURITY: If account is linked to HaLo, ONLY allow HaLo signing
                            const provider = await wallet.getProvider();
                            const { HaloSigner } = await import('../halo/halo-signer.js');
                            const linkInfo = await chrome.storage.local.get(`halo_link_${account.address.toLowerCase()}`);
                            const linkData = linkInfo[`halo_link_${account.address.toLowerCase()}`];
                            const slot = linkData?.slot || 1;

                            const haloSigner = new HaloSigner(account.address, slot, provider);
                            const signedTx = await haloSigner.signTransaction(message.transaction);
                            safeSendResponse({
                                success: true,
                                signedTransaction: signedTx,
                                signedWithHalo: true,
                                chipAddress: linkData?.chipAddress,
                            });
                        } else {
                            // Only allow private key signing for non-linked accounts
                            const signedTx = await wallet.signTransaction(message.transaction);
                            safeSendResponse({ success: true, signedTransaction: signedTx });
                        }
                    } catch (error: any) {
                        safeSendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'SIGN_EIP7702_TRANSACTION':
                    if (!wallet.isUnlocked()) {
                        safeSendResponse({ success: false, error: 'Wallet is locked' });
                        break;
                    }
                    try {
                        const validation = EIP7702.validateTransaction(message.transaction);
                        if (!validation.valid) {
                            safeSendResponse({ success: false, error: validation.error });
                            break;
                        }
                        const signedTx = await wallet.signTransaction(message.transaction);
                        safeSendResponse({ success: true, signedTransaction: signedTx });
                    } catch (error: any) {
                        safeSendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'SIGN_BATCH_TRANSACTION':
                    if (!wallet.isUnlocked()) {
                        safeSendResponse({ success: false, error: 'Wallet is locked' });
                        break;
                    }
                    try {
                        const validation = EIP5742.validateBatch(message.batch);
                        if (!validation.valid) {
                            safeSendResponse({ success: false, error: validation.error });
                            break;
                        }
                        const encoded = EIP5742.encodeBatch(message.batch);
                        const batchTx: Transaction = {
                            to: message.batchContractAddress,
                            data: encoded,
                            gasLimit: message.batch.gasLimit,
                            maxFeePerGas: message.batch.maxFeePerGas,
                            maxPriorityFeePerGas: message.batch.maxPriorityFeePerGas,
                            chainId: message.chainId,
                        };
                        const signedTx = await wallet.signTransaction(batchTx);
                        safeSendResponse({ success: true, signedTransaction: signedTx });
                    } catch (error: any) {
                        safeSendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'SEND_TRANSACTION':
                    // Sign and send transaction - used by Nexus SDK
                    if (!wallet.isUnlocked()) {
                        safeSendResponse({ success: false, error: 'Wallet is locked' });
                        break;
                    }
                    try {
                        const account = wallet.getAccounts().find(
                            acc => acc.address.toLowerCase() === (message.address || '').toLowerCase()
                        );
                        if (!account) {
                            safeSendResponse({ success: false, error: 'Account not found' });
                            break;
                        }

                        // Convert transaction params to proper format
                        const txParams = message.transaction;
                        const provider = await wallet.getProvider();
                        
                        // Build transaction object in the format expected by wallet.signTransaction
                        const transaction: any = {
                            to: txParams.to,
                            value: txParams.value ? BigInt(txParams.value) : undefined,
                            data: txParams.data || '0x',
                            gasLimit: txParams.gasLimit ? BigInt(txParams.gasLimit) : undefined,
                            gasPrice: txParams.gasPrice ? BigInt(txParams.gasPrice) : undefined,
                            maxFeePerGas: txParams.maxFeePerGas ? BigInt(txParams.maxFeePerGas) : undefined,
                            maxPriorityFeePerGas: txParams.maxPriorityFeePerGas ? BigInt(txParams.maxPriorityFeePerGas) : undefined,
                            nonce: txParams.nonce,
                            chainId: txParams.chainId,
                            type: txParams.type,
                        };

                        // Sign the transaction
                        let signedTx: string;
                        if (account.isChipAccount && account.chipInfo) {
                            // Chip account - sign with the chip
                            const { HaloSigner } = await import('../halo/halo-signer.js');
                            const haloSigner = new HaloSigner(account.address, account.chipInfo.slot, provider);
                            signedTx = await haloSigner.signTransaction(transaction);
                        } else {
                            // Regular account - use ethers Wallet directly to avoid populateTransaction issue
                            const privateKey = await wallet.getPrivateKey(account.address);
                            if (!privateKey) {
                                throw new Error('Private key not found');
                            }
                            const signerWallet = new ethers.Wallet(privateKey, provider);
                            
                            // Populate transaction using signer (which has populateTransaction)
                            const populatedTx = await signerWallet.populateTransaction(transaction);
                            signedTx = await signerWallet.signTransaction(populatedTx);
                        }

                        // Send the signed transaction to the network
                        const txResponse = await provider.broadcastTransaction(signedTx);
                        // Parse to get hash
                        const tx = ethers.Transaction.from(signedTx);
                        const txHash = tx.hash || (typeof txResponse === 'string' ? txResponse : txResponse?.hash);

                        safeSendResponse({
                            success: true,
                            transactionHash: txHash,
                        });
                    } catch (error: any) {
                        console.error('[SEND_TRANSACTION] Error:', error);
                        safeSendResponse({ success: false, error: error.message || 'Failed to send transaction' });
                    }
                    break;

                case 'HALO_SIGN':
                    if (!wallet.isUnlocked()) {
                        safeSendResponse({ success: false, error: 'Wallet is locked' });
                        break;
                    }
                    try {
                        const account = wallet.getSelectedAccount();
                        if (!account) {
                            safeSendResponse({ success: false, error: 'No account selected' });
                            break;
                        }
                        const isLinked = await HaloChip.isAccountLinked(account.address);
                        if (!isLinked) {
                            safeSendResponse({ success: false, error: 'Account not linked to HaLo chip' });
                            break;
                        }
                        const result = await HaloChip.sign(message.data, { slot: message.slot || 1 });
                        safeSendResponse(result);
                    } catch (error: any) {
                        safeSendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'HALO_LINK_ACCOUNT':
                    try {
                        const accountAddress = message.address || wallet.getSelectedAccount()?.address;
                        if (!accountAddress) {
                            safeSendResponse({ success: false, error: 'No account selected or provided' });
                            break;
                        }

                        // If keyInfo is provided from popup (gateway mode), store it directly
                        if (message.keyInfo) {
                            const linkData = {
                                slot: message.slot || 1,
                                publicKey: message.keyInfo.publicKey,
                                chipAddress: message.keyInfo.address.toLowerCase(),
                                walletAddress: accountAddress.toLowerCase(),
                                linkedAt: Date.now(),
                            };

                            await chrome.storage.local.set({
                                [`halo_link_${accountAddress.toLowerCase()}`]: linkData,
                            });

                            // SECURITY: Delete private key if requested (protects against theft)
                            if (message.deletePrivateKey) {
                                try {
                                    await wallet.deletePrivateKey(accountAddress);
                                    console.log(`[HALO_LINK] Private key deleted for ${accountAddress} - now HaLo-only access`);
                                } catch (deleteError: any) {
                                    console.warn(`[HALO_LINK] Failed to delete private key: ${deleteError.message}`);
                                    // Continue anyway - link is still successful
                                }
                            }

                            safeSendResponse({
                                success: true,
                                keyInfo: linkData,
                                privateKeyDeleted: message.deletePrivateKey || false,
                            });
                        } else {
                            // Fallback to direct NFC mode (if available)
                            const result = await HaloChip.linkAccount(accountAddress, message.slot || 1);
                            safeSendResponse(result);
                        }
                    } catch (error: any) {
                        safeSendResponse({ success: false, error: error.message || 'Failed to link account' });
                    }
                    break;

                case 'GET_NETWORKS':
                    safeSendResponse({ success: true, networks: wallet.getNetworks() });
                    break;

                case 'SET_NETWORK':
                    await wallet.setNetwork(message.chainId);
                    safeSendResponse({ success: true });
                    break;

                case 'UNLOCK':
                    const unlocked = await wallet.unlock(message.password || '');
                    // Update icon/badge when unlocked
                    if (unlocked) {
                        await updateLockIndicator(false);
                    }
                    safeSendResponse({ success: unlocked });
                    break;

                case 'LOCK':
                    await wallet.lock();
                    // Update icon/badge when locked
                    await updateLockIndicator(true);
                    safeSendResponse({ success: true });
                    break;

                case 'CHECK_UNLOCKED':
                    safeSendResponse({ unlocked: wallet.isUnlocked() });
                    break;

                case 'SIGN_MESSAGE':
                    if (!wallet.isUnlocked()) {
                        safeSendResponse({ success: false, error: 'Wallet is locked' });
                        break;
                    }
                    try {
                        // Check if this is a DApp request (has sender.tab) vs internal wallet operation
                        const isDAppRequest = sender.tab && sender.tab.id;
                        
                        // Get origin to check if it's chrome-extension (auto-sign internal requests)
                        let origin = sender.origin || sender.url || 'Unknown';
                        // Extract origin from URL if needed
                        try {
                            if (origin.startsWith('http://') || origin.startsWith('https://')) {
                                origin = new URL(origin).origin;
                            }
                        } catch {
                            // If URL parsing fails, use as-is
                        }
                        
                        // Auto-sign chrome-extension origins (internal wallet operations)
                        const isChromeExtension = origin.startsWith('chrome-extension://');
                        
                        if (isDAppRequest && !isChromeExtension) {
                            // DApp signature request - show approval modal
                            const tabId = sender.tab?.id;
                            
                            // Get DApp info from connections
                            const connections = await chrome.storage.local.get('dapp_connections') || {};
                            const dappConnections = connections.dapp_connections || {};
                            let dappInfo;
                            try {
                                dappInfo = dappConnections[origin] || {
                                    name: origin !== 'Unknown' ? new URL(origin).hostname : 'Unknown DApp',
                                    icon: '',
                                };
                            } catch {
                                dappInfo = {
                                    name: origin !== 'Unknown' ? origin : 'Unknown DApp',
                                    icon: '',
                                };
                            }
                            
                            // Store pending signature request
                            const requestId = `sign_${Date.now()}_${Math.random()}`;
                            await chrome.storage.local.set({
                                pendingSignature: {
                                    id: requestId,
                                    message: message.message,
                                    address: message.address,
                                    origin: origin,
                                    dappName: dappInfo.name,
                                    dappIcon: dappInfo.icon,
                                    tabId: tabId,
                                }
                            });
                            
                            // Check if notification window already exists
                            try {
                                const windows = await chrome.windows.getAll({ populate: true });
                                const existingWindow = windows.find(win => {
                                    if (!win.tabs || win.tabs.length === 0) return false;
                                    return win.tabs.some(tab => tab.url === notificationUrl);
                                });
                                
                                if (existingWindow && existingWindow.id) {
                                    // Update URL to show signature request
                                    await chrome.tabs.update(existingWindow.tabs![0].id!, {
                                        url: `${notificationUrl}?type=sign&requestId=${requestId}`
                                    });
                                    await chrome.windows.update(existingWindow.id, { focused: true });
                                    notificationWindowIds.add(existingWindow.id);
                                    safeSendResponse({ success: true, pending: true, requestId });
                                    break;
                                }
                            } catch (error) {
                                console.warn('[SIGN_MESSAGE] Could not check existing windows:', error);
                            }
                            
                            // Create new notification window
                            const windowWidth = 400;
                            const windowHeight = 600;
                            const margin = 20;
                            const top = 100;
                            
                            let left: number;
                            try {
                                const displayInfo = await chrome.system.display.getInfo();
                                const primaryDisplay = displayInfo[0];
                                const screenWidth = primaryDisplay.workArea.width;
                                left = screenWidth - windowWidth - margin;
                            } catch (error) {
                                left = 1920 - windowWidth - margin;
                            }
                            
                            const window = await chrome.windows.create({
                                url: `${notificationUrl}?type=sign&requestId=${requestId}`,
                                type: 'popup',
                                width: windowWidth,
                                height: windowHeight,
                                left: left,
                                top: top,
                                focused: true,
                            });
                            
                            if (window.id) {
                                notificationWindowIds.add(window.id);
                            }
                            
                            safeSendResponse({ success: true, pending: true, requestId });
                        } else {
                            // Internal wallet operation or chrome-extension - sign directly without modal
                            const result = await handleSignMessage(message.message, message.address, wallet);
                            safeSendResponse(result);
                        }
                    } catch (error: any) {
                        safeSendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'SIGN_TYPED_DATA':
                    if (!wallet.isUnlocked()) {
                        safeSendResponse({ success: false, error: 'Wallet is locked' });
                        break;
                    }
                    try {
                        // Check if this is a DApp request (has sender.tab) vs internal wallet operation
                        const isDAppRequest = sender.tab && sender.tab.id;
                        
                        // Get origin to check if it's chrome-extension (auto-sign internal requests)
                        let origin = sender.origin || sender.url || 'Unknown';
                        // Extract origin from URL if needed
                        try {
                            if (origin.startsWith('http://') || origin.startsWith('https://')) {
                                origin = new URL(origin).origin;
                            }
                        } catch {
                            // If URL parsing fails, use as-is
                        }
                        
                        // Auto-sign chrome-extension origins (internal wallet operations)
                        const isChromeExtension = origin.startsWith('chrome-extension://');
                        
                        if (isDAppRequest && !isChromeExtension) {
                            // DApp typed data signature request - show approval modal
                            const tabId = sender.tab?.id;
                            
                            // Get DApp info from connections
                            const connections = await chrome.storage.local.get('dapp_connections') || {};
                            const dappConnections = connections.dapp_connections || {};
                            let dappInfo;
                            try {
                                dappInfo = dappConnections[origin] || {
                                    name: origin !== 'Unknown' ? new URL(origin).hostname : 'Unknown DApp',
                                    icon: '',
                                };
                            } catch {
                                dappInfo = {
                                    name: origin !== 'Unknown' ? origin : 'Unknown DApp',
                                    icon: '',
                                };
                            }
                            
                            // Store pending signature request
                            const requestId = `sign_typed_${Date.now()}_${Math.random()}`;
                            await chrome.storage.local.set({
                                pendingSignature: {
                                    id: requestId,
                                    typedData: message.typedData,
                                    address: message.address,
                                    origin: origin,
                                    dappName: dappInfo.name,
                                    dappIcon: dappInfo.icon,
                                    tabId: tabId,
                                    isTypedData: true,
                                }
                            });
                            
                            // Check if notification window already exists
                            try {
                                const windows = await chrome.windows.getAll({ populate: true });
                                const existingWindow = windows.find(win => {
                                    if (!win.tabs || win.tabs.length === 0) return false;
                                    return win.tabs.some(tab => tab.url === notificationUrl);
                                });
                                
                                if (existingWindow && existingWindow.id) {
                                    // Update URL to show signature request
                                    await chrome.tabs.update(existingWindow.tabs![0].id!, {
                                        url: `${notificationUrl}?type=sign&requestId=${requestId}`
                                    });
                                    await chrome.windows.update(existingWindow.id, { focused: true });
                                    notificationWindowIds.add(existingWindow.id);
                                    safeSendResponse({ success: true, pending: true, requestId });
                                    break;
                                }
                            } catch (error) {
                                console.warn('[SIGN_TYPED_DATA] Could not check existing windows:', error);
                            }
                            
                            // Create new notification window
                            const windowWidth = 400;
                            const windowHeight = 600;
                            const margin = 20;
                            const top = 100;
                            
                            let left: number;
                            try {
                                const displayInfo = await chrome.system.display.getInfo();
                                const primaryDisplay = displayInfo[0];
                                const screenWidth = primaryDisplay.workArea.width;
                                left = screenWidth - windowWidth - margin;
                            } catch (error) {
                                left = 1920 - windowWidth - margin;
                            }
                            
                            const window = await chrome.windows.create({
                                url: `${notificationUrl}?type=sign&requestId=${requestId}`,
                                type: 'popup',
                                width: windowWidth,
                                height: windowHeight,
                                left: left,
                                top: top,
                                focused: true,
                            });
                            
                            if (window.id) {
                                notificationWindowIds.add(window.id);
                            }
                            
                            safeSendResponse({ success: true, pending: true, requestId });
                        } else {
                            // Internal wallet operation or chrome-extension - sign directly without modal
                            const result = await handleSignTypedData(message.address, message.typedData, wallet);
                            safeSendResponse(result);
                        }
                    } catch (error: any) {
                        safeSendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'RPC_REQUEST':
                    // Handle generic RPC requests (eth_getBlockByNumber, etc.)
                    try {
                        const { method, params, chainId } = message;
                        const targetChainId = chainId || 1; // Default to mainnet

                        // Import RPC service
                        const { rpcService } = await import('../core/rpc-service.js');

                        // Try request with fallback RPCs
                        const result = await rpcService.requestWithFallback(
                            targetChainId,
                            async (rpcUrl: string) => {
                                const provider = new ethers.JsonRpcProvider(rpcUrl);
                                return await provider.send(method, params || []);
                            }
                        );

                        safeSendResponse({
                            success: true,
                            result: result,
                            data: result,
                        });
                    } catch (error: any) {
                        console.error('[RPC_REQUEST] Error:', error);
                        safeSendResponse({
                            success: false,
                            error: error.message || 'RPC request failed',
                        });
                    }
                    break;

                default:
                    safeSendResponse({ success: false, error: 'Unknown message type: ' + message.type });
                    break;
            }
        } catch (error: any) {
            console.error('[Wolfy] Error in message handler:', error);
            safeSendResponse({ success: false, error: error.message || 'Unknown error' });
        }
    })();

    return true; // Keep channel open for async response
}

// Register message listener
console.log('[Wolfy] Registering message listener...');
chrome.runtime.onMessage.addListener(handleMessage);
console.log('[Wolfy] Message listener registered');

// Track notification windows to clean up pending connections when closed
chrome.windows.onRemoved.addListener(async (windowId) => {
    try {
        // If this was a notification window, clean up pending connection/signature
        if (notificationWindowIds.has(windowId)) {
            notificationWindowIds.delete(windowId);
            const storage = await chrome.storage.local.get(['pendingConnection', 'pendingSignature', 'pendingTransaction']);
            if (storage.pendingConnection) {
                console.log('[Wolfy] Notification window closed, cleaning up pending connection');
                await chrome.storage.local.set({ pendingConnection: null });
            }
            if (storage.pendingSignature) {
                console.log('[Wolfy] Notification window closed, cleaning up pending signature');
                // Send rejection to content script
                if (storage.pendingSignature.tabId) {
                    try {
                        await chrome.tabs.sendMessage(storage.pendingSignature.tabId, {
                            type: 'SIGNATURE_REJECTED',
                            requestId: storage.pendingSignature.id,
                        });
                    } catch (error) {
                        // Tab might be closed, ignore
                    }
                }
                await chrome.storage.local.set({ pendingSignature: null });
            }
            if (storage.pendingTransaction) {
                console.log('[Wolfy] Notification window closed, cleaning up pending transaction');
                // Send rejection to content script
                if (storage.pendingTransaction.tabId) {
                    try {
                        await chrome.tabs.sendMessage(storage.pendingTransaction.tabId, {
                            type: 'TRANSACTION_REJECTED',
                            requestId: storage.pendingTransaction.id,
                        });
                    } catch (error) {
                        // Tab might be closed, ignore
                    }
                }
                await chrome.storage.local.set({ pendingTransaction: null });
            }
        }
    } catch (error) {
        // Ignore errors in cleanup
        console.warn('[Wolfy] Error cleaning up notification window:', error);
    }
});
