// Service worker entry point
console.log('[Wolfy] Service worker starting...');

// Import all dependencies
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

// Initialize wallet
(async () => {
    try {
        await ensureWalletReady();
        console.log('[Wolfy] Wallet initialized');
    } catch (error: any) {
        console.error('[Wolfy] Initialization error:', error);
    }
})();

// Initialize on install/startup
chrome.runtime.onInstalled.addListener(async () => {
    await ensureWalletReady();
    console.log('[Wolfy] Wallet installed');
});

chrome.runtime.onStartup.addListener(async () => {
    await ensureWalletReady();
    console.log('[Wolfy] Wallet started');
});

// Message handler
function handleMessage(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
): boolean {
    console.log('[Wolfy] Message received:', message?.type);

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

                case 'GET_ACCOUNTS':
                    safeSendResponse({
                        success: true,
                        accounts: wallet.getAccounts(),
                    });
                    break;

                case 'GET_SELECTED_ACCOUNT':
                    safeSendResponse({
                        success: true,
                        account: wallet.getSelectedAccount(),
                    });
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

                case 'SET_SELECTED_ACCOUNT':
                    await wallet.setSelectedAccount(message.address);
                    safeSendResponse({ success: true });
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
                        // Check if account is linked to HaLo chip
                        const isHaloLinked = await HaloChip.isAccountLinked(account.address);
                        if (isHaloLinked) {
                            const provider = await wallet.getProvider();
                            const { HaloSigner } = await import('../halo/halo-signer.js');
                            const linkInfo = await chrome.storage.local.get(`halo_link_${account.address.toLowerCase()}`);
                            const slot = linkInfo[`halo_link_${account.address.toLowerCase()}`]?.slot || 1;
                            const haloSigner = new HaloSigner(account.address, slot, provider);
                            const signedTx = await haloSigner.signTransaction(message.transaction);
                            safeSendResponse({ success: true, signedTransaction: signedTx, signedWithHalo: true });
                        } else {
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
                        const result = await HaloChip.linkAccount(accountAddress, message.slot || 1);
                        safeSendResponse(result);
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
