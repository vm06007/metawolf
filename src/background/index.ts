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

console.log('[Wolfy] Imports loaded');

const wallet = new Wallet();
let walletInitialized = false;

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
                        const notificationUrl = chrome.runtime.getURL('notification/index.html');
                        const origin = message.origin || sender.origin || 'unknown';
                        const name = message.name || 'Unknown DApp';
                        const icon = message.icon || '';

                        // Detect other wallets (passed from content script)
                        const detectedProviders = message.providers || [];

                        // Store pending connection request first
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
                        await chrome.windows.create({
                            url: notificationUrl,
                            type: 'popup',
                            width: windowWidth,
                            height: windowHeight,
                            left: left,
                            top: top,
                            focused: true,
                        });

                        safeSendResponse({
                            success: true,
                            pending: true,
                        });
                    } catch (error: any) {
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
                        safeSendResponse({ success: true });
                    } catch (error: any) {
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
                    safeSendResponse({ success: unlocked });
                    break;

                case 'LOCK':
                    await wallet.lock();
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
                        const result = await handleSignMessage(message.message, message.address, wallet);
                        safeSendResponse(result);
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
                        const result = await handleSignTypedData(message.address, message.typedData, wallet);
                        safeSendResponse(result);
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
