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

            // Try routing through message router first
            const { routeMessage } = await import('./message-router.js');
            const handled = await routeMessage(message, {
                wallet,
                sender,
                safeSendResponse,
            });

            // If router handled it, we're done
            if (handled) {
                return;
            }

            // Otherwise, handle remaining messages in switch statement
            switch (message.type) {
                // Connection, signature, and transaction handlers are now in message-router.ts
                // These cases are handled above by the router

                case 'SEND_BATCHED_CALLS':
                    // EIP-5792: Handle batched calls request
                    if (!wallet.isUnlocked()) {
                        safeSendResponse({ success: false, error: 'Wallet is locked' });
                        break;
                    }
                    try {
                        // Check if this is a DApp request
                        const isDAppRequest = sender.tab && sender.tab.id;
                        let origin = sender.origin || sender.url || 'Unknown';
                        try {
                            if (origin.startsWith('http://') || origin.startsWith('https://')) {
                                origin = new URL(origin).origin;
                            }
                        } catch {
                            // If URL parsing fails, use as-is
                        }
                        const isChromeExtension = origin.startsWith('chrome-extension://');

                        if (isDAppRequest && !isChromeExtension) {
                            // DApp batched calls request - show approval modal
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

                            // Get selected account
                            const account = wallet.getSelectedAccount();
                            if (!account) {
                                safeSendResponse({ success: false, error: 'No account selected' });
                                break;
                            }

                            // Store pending batched calls request
                            const requestId = `batched_calls_${Date.now()}_${Math.random()}`;
                            await chrome.storage.local.set({
                                pendingBatchedCalls: {
                                    id: requestId,
                                    calls: message.calls || [],
                                    address: account.address,
                                    origin: origin,
                                    dappName: dappInfo.name,
                                    dappIcon: dappInfo.icon,
                                    chainId: message.chainId,
                                    capabilities: message.capabilities,
                                    forceAtomic: message.forceAtomic,
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
                                    await chrome.tabs.update(existingWindow.tabs![0].id!, {
                                        url: `${notificationUrl}?type=batched-calls&requestId=${requestId}`
                                    });
                                    await chrome.windows.update(existingWindow.id, { focused: true });
                                    notificationWindowIds.add(existingWindow.id);
                                    safeSendResponse({ success: true, pending: true, id: requestId });
                                    break;
                                }
                            } catch (error) {
                                console.warn('[SEND_BATCHED_CALLS] Could not check existing windows:', error);
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
                                url: `${notificationUrl}?type=batched-calls&requestId=${requestId}`,
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

                            safeSendResponse({ success: true, pending: true, id: requestId });
                            break;
                        }

                        // Internal wallet operation - not supported for batched calls
                        safeSendResponse({ success: false, error: 'Batched calls only supported for DApp requests' });
                    } catch (error: any) {
                        console.error('[SEND_BATCHED_CALLS] Error:', error);
                        safeSendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'APPROVE_BATCHED_CALLS':
                    try {
                        const requestId = message.requestId;
                        const storage = await chrome.storage.local.get('pendingBatchedCalls');
                        const pendingBatchedCalls = storage.pendingBatchedCalls;

                        if (!pendingBatchedCalls || pendingBatchedCalls.id !== requestId) {
                            safeSendResponse({ success: false, error: 'Batched calls request not found' });
                            break;
                        }

                        // Get account
                        const account = wallet.getAccounts().find(
                            acc => acc.address.toLowerCase() === pendingBatchedCalls.address.toLowerCase()
                        );
                        if (!account) {
                            safeSendResponse({
                                success: false,
                                error: 'Account not found'
                            });
                            break;
                        }

                        // Get chain-specific provider
                        const { rpcService } = await import('../core/rpc-service.js');
                        // Convert chainId to number if it's a hex string
                        let chainId: number;
                        if (typeof pendingBatchedCalls.chainId === 'string' && pendingBatchedCalls.chainId.startsWith('0x')) {
                            chainId = parseInt(pendingBatchedCalls.chainId, 16);
                        } else if (typeof pendingBatchedCalls.chainId === 'number') {
                            chainId = pendingBatchedCalls.chainId;
                        } else {
                            chainId = wallet.getSelectedNetwork();
                        }
                        const rpcUrl = rpcService.getRPCUrl(chainId);
                        const provider = new ethers.JsonRpcProvider(rpcUrl);

                        // Verify provider chainId matches
                        const providerChainId = (await provider.getNetwork()).chainId;
                        if (Number(providerChainId) !== chainId) {
                            chainId = Number(providerChainId);
                        }

                        // Check if account is a smart account (EIP-7702 delegated)
                        const { EIP7702 } = await import('../eips/eip7702.js');
                        const delegationStatus = await EIP7702.checkDelegation(
                            account.address,
                            provider
                        );

                        // Verify delegation to a smart account contract
                        const isSmartAccount = delegationStatus.isDelegated && delegationStatus.delegateAddress;

                        if (!isSmartAccount) {
                            throw new Error('Account must be delegated to a smart account contract to use batched calls. Please upgrade your account first.');
                        }

                        // Use the dynamic delegate address from the delegation check
                        const delegateAddress = delegationStatus.delegateAddress;

                        const calls = pendingBatchedCalls.calls || [];
                        let txHash: string;

                        // CRITICAL INSIGHT FROM CONTRACT SOURCE:
                        // The contract's execute() function calls: _executionCalldata.decodeBatch()
                        // This means executionCalldata should be encoded as Execution[] (array of structs)
                        // NOT as (uint256 nonce, bytes[] calls) - the nonce is NOT part of executionCalldata!
                        // The nonce is managed by the EntryPoint contract, not included in the execution data.

                        // Execution struct: (address target, uint256 value, bytes callData)
                        // So executionCalldata = [(address, uint256, bytes), (address, uint256, bytes), ...]

                        // Encode executionCalldata as array of Execution structs
                        const executionCalldata = ethers.AbiCoder.defaultAbiCoder().encode(
                            ['tuple(address,uint256,bytes)[]'],
                            [calls.map((call: any) => {
                                const target = call.to || ethers.ZeroAddress;
                                const value = call.value ? BigInt(call.value) : 0n;
                                const callData = call.data || '0x';
                                return [target, value, callData];
                            })]
                        );

                        const execDataLengthBytes = (executionCalldata.length - 2) / 2;

                        // ModeCode for batched execution
                        // CALLTYPE_BATCH (0x01) for batch execution
                        const modeCode = '0x01' + '0'.repeat(62); // bytes32: 0x01 + 31 zero bytes

                        // Encode the execute function: execute(ModeCode, bytes)
                        const executeInterface = new ethers.Interface([
                            'function execute(bytes32 _mode, bytes _executionCalldata) payable',
                        ]);

                        const executeData = executeInterface.encodeFunctionData('execute', [modeCode, executionCalldata]);
                        const selector = executeData.slice(0, 10);

                        if (selector !== '0xe9ae5c53') {
                            throw new Error(`Function selector mismatch: got ${selector}, expected 0xe9ae5c53`);
                        }

                        // Build transaction to smart account itself
                        let transaction: any = {
                            to: account.address, // Send to self (smart account)
                            value: 0n,
                            data: executeData,
                            chainId: chainId,
                            from: account.address,
                        };

                        // Sign and send
                        if (account.isChipAccount && account.chipInfo) {
                            const { HaloSigner } = await import('../halo/halo-signer.js');
                            const haloSigner = new HaloSigner(account.address, account.chipInfo.slot, provider);
                            const signedTx = await haloSigner.signTransaction(transaction);
                            const txResponse = await provider.broadcastTransaction(signedTx);
                            const tx = ethers.Transaction.from(signedTx);
                            txHash = tx.hash || (typeof txResponse === 'string' ? txResponse : txResponse?.hash);
                        } else {
                            const privateKey = await wallet.getPrivateKey(account.address);
                            if (!privateKey) {
                                throw new Error('Private key not found');
                            }
                            const signerWallet = new ethers.Wallet(privateKey, provider);

                            try {
                                const populatedTx = await signerWallet.populateTransaction(transaction);
                                transaction = { ...populatedTx, chainId: chainId };
                            } catch (gasError: any) {
                                console.warn('[APPROVE_BATCHED_CALLS] Gas estimation failed, using defaults:', gasError.message);
                                const feeData = await provider.getFeeData();
                                let maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice;
                                let maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;

                                // CRITICAL: Ensure maxPriorityFeePerGas <= maxFeePerGas
                                // This is especially important on L2s like Arbitrum where fees are very low
                                if (maxPriorityFeePerGas && maxFeePerGas && maxPriorityFeePerGas > maxFeePerGas) {
                                    maxPriorityFeePerGas = maxFeePerGas;
                                }

                                transaction = {
                                    ...transaction,
                                    gasLimit: 500000n, // Higher gas for batched calls
                                    maxFeePerGas: maxFeePerGas,
                                    maxPriorityFeePerGas: maxPriorityFeePerGas,
                                };
                            }

                            const txResponse = await signerWallet.sendTransaction(transaction);
                            txHash = txResponse.hash;
                        }

                        // Validate transaction hash
                        if (!txHash || !txHash.startsWith('0x') || txHash.length !== 66) {
                            throw new Error(`Invalid transaction hash: ${txHash}`);
                        }

                        // Store transaction hash for status tracking
                        // Store with BOTH the request ID and the transaction hash as keys
                        // This allows lookup by either ID (for backward compatibility) or by transaction hash
                        const statusKey = `batched_call_${requestId}`;
                        const txHashKey = `batched_call_${txHash}`;
                        await chrome.storage.local.set({
                            [statusKey]: {
                                hash: txHash,
                                status: 'pending',
                                timestamp: Date.now(),
                                isSmartAccount: isSmartAccount,
                                requestId: requestId,
                            },
                            [txHashKey]: {
                                hash: txHash,
                                status: 'pending',
                                timestamp: Date.now(),
                                isSmartAccount: isSmartAccount,
                                requestId: requestId,
                            }
                        });

                        // Use the transaction hash as the primary identifier
                        const primaryTxHash = txHash;

                        // Clear pending request
                        await chrome.storage.local.set({ pendingBatchedCalls: null });

                        // Send approval to content script
                        if (pendingBatchedCalls.tabId) {
                            try {
                                await chrome.tabs.sendMessage(pendingBatchedCalls.tabId, {
                                    type: 'BATCHED_CALLS_APPROVED',
                                    requestId: requestId,
                                    id: primaryTxHash,
                                    results: [primaryTxHash], // Single transaction hash for batched call
                                });
                            } catch (error) {
                                console.error('[APPROVE_BATCHED_CALLS] Error sending to content script:', error);
                            }
                        }

                        safeSendResponse({
                            success: true,
                            id: primaryTxHash,
                            transactionHash: primaryTxHash, // For compatibility
                            results: [primaryTxHash] // Single transaction hash for batched call
                        });
                    } catch (error: any) {
                        console.error('[APPROVE_BATCHED_CALLS] Error:', error);
                        safeSendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'REJECT_BATCHED_CALLS':
                    try {
                        const requestId = message.requestId;
                        const storage = await chrome.storage.local.get('pendingBatchedCalls');
                        const pendingBatchedCalls = storage.pendingBatchedCalls;

                        if (!pendingBatchedCalls || pendingBatchedCalls.id !== requestId) {
                            safeSendResponse({ success: false, error: 'Batched calls request not found' });
                            break;
                        }

                        // Clear pending request
                        await chrome.storage.local.set({ pendingBatchedCalls: null });

                        // Send rejection to content script
                        if (pendingBatchedCalls.tabId) {
                            try {
                                await chrome.tabs.sendMessage(pendingBatchedCalls.tabId, {
                                    type: 'BATCHED_CALLS_REJECTED',
                                    requestId: requestId,
                                });
                            } catch (error) {
                                console.error('[REJECT_BATCHED_CALLS] Error sending to content script:', error);
                            }
                        }

                        safeSendResponse({ success: true });
                    } catch (error: any) {
                        console.error('[REJECT_BATCHED_CALLS] Error:', error);
                        safeSendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'GET_CALLS_STATUS':
                    // EIP-5792: Get status of batched calls
                    try {
                        const callsId = message.id;
                        console.log('[GET_CALLS_STATUS] Looking up status for ID:', callsId);

                        if (!callsId) {
                            console.log('[GET_CALLS_STATUS] No ID provided, returning pending');
                            safeSendResponse({
                                success: true,
                                status: {
                                    status: 'PENDING',
                                    receipts: [],
                                }
                            });
                            break;
                        }

                        // Try direct lookup first (by transaction hash or request ID)
                        const directKey = `batched_call_${callsId}`;
                        console.log('[GET_CALLS_STATUS] Trying direct lookup with key:', directKey);
                        const directStorage = await chrome.storage.local.get(directKey);
                        const statusEntry = directStorage[directKey];

                        console.log('[GET_CALLS_STATUS] Direct lookup result:', statusEntry ? 'Found' : 'Not found');

                        if (statusEntry && statusEntry.hash) {
                            console.log('[GET_CALLS_STATUS] Found stored status for ID:', callsId);
                            console.log('[GET_CALLS_STATUS] Transaction hash:', statusEntry.hash);
                            console.log('[GET_CALLS_STATUS] Checking on chain...');

                            // Check transaction status on chain
                            try {
                                const { rpcService } = await import('../core/rpc-service.js');
                                const chainId = message.chainId || wallet.getSelectedNetwork();
                                console.log('[GET_CALLS_STATUS] Using chainId:', chainId);
                                const rpcUrl = rpcService.getRPCUrl(chainId);
                                console.log('[GET_CALLS_STATUS] RPC URL:', rpcUrl);
                                const provider = new ethers.JsonRpcProvider(rpcUrl);

                                const receipt = await provider.getTransactionReceipt(statusEntry.hash);
                                console.log('[GET_CALLS_STATUS] Receipt result:', receipt ? `Found (block ${receipt.blockNumber})` : 'null (not mined yet)');

                                if (receipt) {
                                    console.log('[GET_CALLS_STATUS] ✓ Transaction confirmed! Block:', receipt.blockNumber);
                                    console.log('[GET_CALLS_STATUS] Receipt status:', receipt.status);
                                    const overallStatus = receipt.status === 1 ? 'CONFIRMED' : 'FAILED';
                                    const response = {
                                        success: true,
                                        status: {
                                            status: overallStatus,
                                            receipts: [{
                                                logs: receipt.logs,
                                                status: receipt.status === 1 ? '0x1' : '0x0',
                                                blockHash: receipt.blockHash,
                                                blockNumber: '0x' + receipt.blockNumber.toString(16),
                                                gasUsed: '0x' + receipt.gasUsed.toString(16),
                                                transactionHash: receipt.hash,
                                            }]
                                        }
                                    };
                                    console.log('[GET_CALLS_STATUS] ✓ Returning CONFIRMED status');
                                    safeSendResponse(response);
                                } else {
                                    // Transaction not yet mined
                                    console.log('[GET_CALLS_STATUS] Transaction still pending (no receipt yet)');
                                    safeSendResponse({
                                        success: true,
                                        status: {
                                            status: 'PENDING',
                                            receipts: []
                                        }
                                    });
                                }
                            } catch (error: any) {
                                console.error('[GET_CALLS_STATUS] Error checking receipt:', error.message);
                                // Transaction might not exist yet
                                safeSendResponse({
                                    success: true,
                                    status: {
                                        status: 'PENDING',
                                        receipts: []
                                    }
                                });
                            }
                            // Always exit after direct lookup to prevent fall-through
                            break;
                        }

                        // If not found by direct lookup, search all storage (fallback)
                        console.log('[GET_CALLS_STATUS] No direct match, searching all storage...');
                        const allStorage = await chrome.storage.local.get(null);
                        const receipts: any[] = [];
                        let allConfirmed = true;
                        let anyFound = false;

                        // Look for stored status entries
                        for (const [key, value] of Object.entries(allStorage)) {
                            if (key.startsWith('batched_call_') && typeof value === 'object' && value !== null) {
                                const entry = value as any;
                                // Match by hash or request ID
                                if (entry.hash === callsId || entry.requestId === callsId || key === directKey) {
                                    anyFound = true;
                                    console.log('[GET_CALLS_STATUS] Found matching entry with key:', key);
                                    // Check transaction status on chain
                                    try {
                                        const { rpcService } = await import('../core/rpc-service.js');
                                        const chainId = message.chainId || wallet.getSelectedNetwork();
                                        const rpcUrl = rpcService.getRPCUrl(chainId);
                                        const provider = new ethers.JsonRpcProvider(rpcUrl);

                                        const receipt = await provider.getTransactionReceipt(entry.hash);
                                        if (receipt) {
                                            receipts.push({
                                                blockNumber: receipt.blockNumber.toString(),
                                                blockHash: receipt.blockHash,
                                                transactionHash: receipt.hash,
                                                status: receipt.status === 1 ? 'success' : 'reverted',
                                                gasUsed: receipt.gasUsed.toString(),
                                            });
                                            if (receipt.status !== 1) {
                                                allConfirmed = false;
                                            }
                                        } else {
                                            // Transaction not yet mined
                                            allConfirmed = false;
                                            receipts.push({
                                                transactionHash: entry.hash,
                                                status: 'pending',
                                            });
                                        }
                                    } catch (error) {
                                        // Transaction might not exist yet
                                        allConfirmed = false;
                                        receipts.push({
                                            transactionHash: entry.hash,
                                            status: 'pending',
                                        });
                                    }
                                }
                            }
                        }

                        const overallStatus = allConfirmed && receipts.length > 0 ? 'CONFIRMED' :
                            anyFound ? 'PENDING' : 'PENDING';

                        safeSendResponse({
                            success: true,
                            status: {
                                status: overallStatus,
                                receipts: receipts,
                            }
                        });
                    } catch (error: any) {
                        console.error('[GET_CALLS_STATUS] Error:', error);
                        safeSendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'GET_CAPABILITIES':
                    // EIP-5792: Get wallet capabilities
                    // Returns capabilities grouped by chain ID
                    try {
                        const account = message.account ? wallet.getAccounts().find(
                            acc => acc.address.toLowerCase() === message.account.toLowerCase()
                        ) : wallet.getSelectedAccount();

                        // Return capabilities grouped by supported chain IDs
                        // For EIP-7702 enabled chains, we support atomic batched transactions
                        // Chain IDs MUST be decimal strings, not hex!
                        const capabilities = {
                            // Ethereum Mainnet
                            '1': {
                                atomicBatch: {
                                    supported: true
                                }
                            },
                            // Sepolia Testnet
                            '11155111': {
                                atomicBatch: {
                                    supported: true
                                }
                            },
                            // Arbitrum One
                            '42161': {
                                atomicBatch: {
                                    supported: true
                                }
                            },
                            // Zircuit Mainnet
                            '48900': {
                                atomicBatch: {
                                    supported: true
                                }
                            }
                        };

                        console.log('[GET_CAPABILITIES] Returning capabilities:', capabilities);
                        safeSendResponse({
                            success: true,
                            capabilities: capabilities
                        });
                    } catch (error: any) {
                        console.error('[GET_CAPABILITIES] Error:', error);
                        safeSendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'GET_TRANSACTION_RECEIPT':
                    // Get transaction receipt for status display in notification
                    try {
                        const { txHash, chainId: msgChainId } = message;
                        if (!txHash) {
                            safeSendResponse({ success: false, error: 'No transaction hash provided' });
                            break;
                        }

                        const { rpcService } = await import('../core/rpc-service.js');
                        const chainId = msgChainId || wallet.getSelectedNetwork();
                        const rpcUrl = rpcService.getRPCUrl(chainId);
                        const provider = new ethers.JsonRpcProvider(rpcUrl);

                        const receipt = await provider.getTransactionReceipt(txHash);
                        if (receipt) {
                            safeSendResponse({
                                success: true,
                                receipt: {
                                    blockNumber: receipt.blockNumber.toString(),
                                    blockHash: receipt.blockHash,
                                    transactionHash: receipt.hash,
                                    status: receipt.status,
                                    gasUsed: receipt.gasUsed.toString(),
                                }
                            });
                        } else {
                            safeSendResponse({
                                success: true,
                                receipt: null // Transaction not yet mined
                            });
                        }
                    } catch (error: any) {
                        console.error('[GET_TRANSACTION_RECEIPT] Error:', error);
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

                            // Get chainId from transaction and switch network to match
                            const txChainId = message.transaction.chainId || 1;
                            const currentNetwork = wallet.getSelectedNetwork();

                            // Switch network if transaction is on a different chain
                            if (txChainId !== currentNetwork) {
                                console.log(`[SIGN_TRANSACTION] Switching network from ${currentNetwork} to ${txChainId} to match transaction`);
                                await wallet.setNetwork(txChainId);
                            }

                            // Check if this is a contract interaction and set minimum gas limit
                            const txData = message.transaction.data || '0x';
                            const isContractInteraction = txData &&
                                txData !== '0x' &&
                                txData !== '0x0' &&
                                txData.length > 2;

                            // Prepare transaction with minimum gas for contract interactions
                            // Ensure from address is set
                            let transaction = {
                                ...message.transaction,
                                from: message.transaction.from || account.address // Ensure from is always set
                            };
                            if (isContractInteraction) {
                                const MIN_CONTRACT_GAS = 1000000; // 1 million gas minimum
                                const currentGas = transaction.gasLimit
                                    ? (typeof transaction.gasLimit === 'string'
                                        ? parseInt(transaction.gasLimit, 10)
                                        : Number(transaction.gasLimit))
                                    : 0;

                                // If no gas limit or below minimum, set to minimum
                                if (!transaction.gasLimit || currentGas < MIN_CONTRACT_GAS) {
                                    console.log(`[SIGN_TRANSACTION] Contract interaction detected. Setting minimum gas limit: ${MIN_CONTRACT_GAS} (was: ${currentGas || 'not set'})`);
                                    transaction.gasLimit = MIN_CONTRACT_GAS.toString();
                                }
                            }

                            // Store pending transaction request
                            const requestId = `tx_${Date.now()}_${Math.random()}`;
                            await chrome.storage.local.set({
                                pendingTransaction: {
                                    id: requestId,
                                    transaction: transaction, // Use transaction with minimum gas if needed
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

                case 'CHECK_DELEGATION':
                    try {
                        const { address, chainId } = message;
                        console.log('[CHECK_DELEGATION] Checking delegation for:', { address, chainId });

                        const provider = await wallet.getProvider();
                        let delegationStatus;

                        if (chainId) {
                            const { rpcService } = await import('../core/rpc-service.js');
                            const rpcUrl = rpcService.getRPCUrl(chainId);
                            console.log('[CHECK_DELEGATION] Using chain-specific provider:', { chainId, rpcUrl });
                            const chainProvider = new ethers.JsonRpcProvider(rpcUrl);
                            delegationStatus = await EIP7702.checkDelegation(address, chainProvider);
                        } else {
                            console.log('[CHECK_DELEGATION] Using default provider');
                            delegationStatus = await EIP7702.checkDelegation(address, provider);
                        }

                        console.log('[CHECK_DELEGATION] Delegation status result:', delegationStatus);
                        safeSendResponse({ success: true, delegationStatus });
                    } catch (error: any) {
                        console.error('[CHECK_DELEGATION] Error:', error);
                        safeSendResponse({ success: false, error: error.message || 'Failed to check delegation' });
                    }
                    break;

                case 'UPGRADE_TO_SMART_ACCOUNT':
                    if (!wallet.isUnlocked()) {
                        safeSendResponse({ success: false, error: 'Wallet is locked' });
                        break;
                    }
                    try {
                        const { address, chainId, contractAddress } = message;
                        // Use provided contract address or default to MetaMask delegator
                        const SMART_ACCOUNT_CONTRACT = contractAddress || '0x63c0c19a282a1b52b07dd5a65b58948a07dae32b';

                        const account = wallet.getAccounts().find(
                            acc => acc.address.toLowerCase() === address.toLowerCase()
                        );
                        if (!account) {
                            safeSendResponse({ success: false, error: 'Account not found' });
                            break;
                        }

                        // Get provider and nonce
                        const { rpcService } = await import('../core/rpc-service.js');
                        const targetChainId = chainId || wallet.getSelectedNetwork();
                        const rpcUrl = rpcService.getRPCUrl(targetChainId);
                        const provider = new ethers.JsonRpcProvider(rpcUrl);

                        // CRITICAL: Nonce calculation depends on who broadcasts the transaction
                        // Reference: https://blog.biconomy.io/prep-deep-dive/#limitations-of-nicks%E2%80%99-eip-7702
                        // Reference: https://docs.openzeppelin.com/contracts/5.x/eoa-delegation
                        //
                        // If RELAYER broadcasts: authorization_nonce = current nonce (7702-cleaner uses this)
                        // If EOA broadcasts (our case): authorization_nonce = current nonce + 1
                        //
                        // Reason: EVM increments sender's nonce BEFORE processing authorization list
                        // So when EOA is sender, we must use current + 1 to match the incremented nonce
                        // Use account.address to ensure consistency
                        const { getAddress } = await import('viem');
                        const accountAddress = getAddress(account.address);
                        const currentNonce = await provider.getTransactionCount(accountAddress, 'pending');
                        let authorizationNonce = currentNonce + 1; // EOA broadcasts: must use current + 1
                        let transactionNonce = currentNonce; // Transaction uses current nonce (before increment)

                        // Get fee data
                        const feeData = await provider.getFeeData();
                        let maxFeePerGas = feeData.maxFeePerGas || ethers.parseUnits('20', 'gwei');
                        let maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits('2', 'gwei');

                        // CRITICAL: Ensure maxPriorityFeePerGas <= maxFeePerGas
                        // This is especially important on L2s like Arbitrum where fees are very low
                        if (maxPriorityFeePerGas > maxFeePerGas) {
                            maxPriorityFeePerGas = maxFeePerGas;
                        }

                        const gasLimit = 100000n;

                        // CRITICAL: Verify the account address matches the message address
                        const accountAddressLower = accountAddress.toLowerCase();
                        const messageAddress = getAddress(address).toLowerCase();

                        if (accountAddressLower !== messageAddress) {
                            console.error('[UPGRADE_TO_SMART_ACCOUNT] ERROR: Account address does not match message address!');
                            safeSendResponse({ success: false, error: `Account address mismatch. Account: ${accountAddressLower}, Message: ${messageAddress}` });
                            break;
                        }

                        // CRITICAL: Verify account was created correctly
                        // When an account is created/imported, the private key should match the account address
                        // If they don't match, it means the account data is corrupted
                        const { privateKeyToAccount } = await import('viem/accounts');

                        // Try to get private key - wallet.getPrivateKey normalizes to lowercase internally
                        let privateKey = await wallet.getPrivateKey(account.address);
                        if (!privateKey) {
                            // Try alternative formats
                            privateKey = await wallet.getPrivateKey(getAddress(account.address));
                            if (!privateKey) {
                                privateKey = await wallet.getPrivateKey(account.address.toLowerCase());
                            }
                        }

                        if (!privateKey) {
                            safeSendResponse({ success: false, error: 'Private key not found for this account' });
                            break;
                        }

                        // CRITICAL: Verify the private key actually belongs to this account
                        // This is a data integrity check - if it fails, the account data is corrupted
                        const accountFromKey = privateKeyToAccount(privateKey as `0x${string}`);
                        const addressFromKey = getAddress(accountFromKey.address).toLowerCase();
                        const expectedAddress = accountAddressLower;

                        if (addressFromKey !== expectedAddress) {
                            // This is a critical error - the account data is corrupted
                            // The private key stored for this account belongs to a different address
                            // Try to auto-fix by updating the account address to match the private key
                            console.warn('[UPGRADE_TO_SMART_ACCOUNT] Account data mismatch detected. Attempting auto-fix...');

                            try {
                                // Update account address to match the private key
                                const oldAddress = account.address;
                                account.address = addressFromKey;

                                // Re-store private key under the correct address
                                const normalizedNewAddress = addressFromKey.toLowerCase();
                                await chrome.storage.local.set({
                                    [`key_${normalizedNewAddress}`]: privateKey
                                });

                                // Remove old private key storage
                                const normalizedOldAddress = oldAddress.toLowerCase();
                                if (normalizedOldAddress !== normalizedNewAddress) {
                                    await chrome.storage.local.remove(`key_${normalizedOldAddress}`);
                                }

                                // Save updated account state
                                await wallet.saveState();

                                // Update the accountAddress variable to use the fixed address
                                const fixedAccountAddress = getAddress(addressFromKey);
                                const fixedAccountAddressLower = fixedAccountAddress.toLowerCase();

                                // Re-verify after fix
                                const recheckAccount = privateKeyToAccount(privateKey as `0x${string}`);
                                const recheckAddress = getAddress(recheckAccount.address).toLowerCase();

                                if (recheckAddress !== fixedAccountAddressLower) {
                                    throw new Error('Auto-fix failed: Address still does not match after fix');
                                }

                                // Update nonce calculation to use the fixed address
                                const fixedCurrentNonce = await provider.getTransactionCount(fixedAccountAddress, 'pending');
                                const fixedAuthorizationNonce = fixedCurrentNonce + 1;
                                const fixedTransactionNonce = fixedCurrentNonce;

                                // Continue with the fixed address
                                // Update the authorization nonce
                                authorizationNonce = fixedAuthorizationNonce;
                                transactionNonce = fixedTransactionNonce;

                            } catch (fixError: any) {
                                // Auto-fix failed - return error
                                const errorMsg = `CRITICAL: Account data corruption detected. The private key stored for account ${expectedAddress} actually belongs to address ${addressFromKey}. Auto-fix failed: ${fixError.message}`;
                                console.error('[UPGRADE_TO_SMART_ACCOUNT]', errorMsg);
                                console.error('[UPGRADE_TO_SMART_ACCOUNT] Diagnostic info:', {
                                    accountObject: {
                                        address: account.address,
                                        name: account.name,
                                        isChipAccount: account.isChipAccount,
                                        isWatchOnly: account.isWatchOnly,
                                        isFireflyAccount: account.isFireflyAccount
                                    },
                                    storageKeyUsed: `key_${account.address.toLowerCase()}`,
                                    expectedAddress,
                                    addressFromKey,
                                    privateKeyLength: privateKey.length,
                                    fixError: fixError.message
                                });
                                safeSendResponse({
                                    success: false,
                                    error: errorMsg + ` Please delete this account and re-import it with the correct private key for ${expectedAddress}.`
                                });
                                break;
                            }
                        }

                        // Use the EXACT working approach from WORKING-EIP7702-PROTOTYPE.ts
                        // Create wallet with provider
                        const ethersWallet = new ethers.Wallet(privateKey, provider);

                        // Create authorization - Ethers.js handles signing internally
                        const authorization = await ethersWallet.authorize({
                            address: SMART_ACCOUNT_CONTRACT,
                            chainId: targetChainId,
                            nonce: authorizationNonce
                        });

                        // Create type-4 transaction with authorization list
                        // This is the EXACT approach that worked in the prototype
                        const transaction = {
                            type: 4,  // EIP-7702
                            to: ethersWallet.address,  // Send to self (the EOA being delegated)
                            value: 0,
                            data: '0x',  // No calldata needed
                            gasLimit: Number(gasLimit),
                            maxFeePerGas,
                            maxPriorityFeePerGas,
                            chainId: targetChainId,
                            nonce: transactionNonce,  // Transaction uses current nonce
                            authorizationList: [authorization]  // Use authorization directly
                        };

                        // Let Ethers.js handle everything - signing and broadcasting
                        const txResponse = await ethersWallet.sendTransaction(transaction);

                        // Respond immediately so UI can show toast and close modal
                        safeSendResponse({ success: true, transactionHash: txResponse.hash });

                        // Wait for confirmation in background (don't block UI)
                        txResponse.wait().then(receipt => {
                            console.log('[UPGRADE_TO_SMART_ACCOUNT] Transaction confirmed!', {
                                hash: txResponse.hash,
                                status: receipt?.status,
                                blockNumber: receipt?.blockNumber
                            });
                        }).catch(err => {
                            console.error('[UPGRADE_TO_SMART_ACCOUNT] Confirmation error:', err);
                        });
                    } catch (error: any) {
                        console.error('[UPGRADE_TO_SMART_ACCOUNT] Error:', error);
                        safeSendResponse({ success: false, error: error.message || 'Failed to upgrade to smart account' });
                    }
                    break;

                case 'CLEAR_DELEGATION':
                    if (!wallet.isUnlocked()) {
                        safeSendResponse({ success: false, error: 'Wallet is locked' });
                        break;
                    }
                    try {
                        const { address, chainId } = message;

                        const account = wallet.getAccounts().find(
                            acc => acc.address.toLowerCase() === address.toLowerCase()
                        );
                        if (!account) {
                            safeSendResponse({ success: false, error: 'Account not found' });
                            break;
                        }

                        // Get provider and nonce
                        const { rpcService } = await import('../core/rpc-service.js');
                        const targetChainId = chainId || wallet.getSelectedNetwork();
                        const rpcUrl = rpcService.getRPCUrl(targetChainId);
                        const provider = new ethers.JsonRpcProvider(rpcUrl);
                        // CRITICAL: Nonce calculation depends on who broadcasts the transaction
                        // Reference: https://blog.biconomy.io/prep-deep-dive/#limitations-of-nicks%E2%80%99-eip-7702
                        // Reference: https://docs.openzeppelin.com/contracts/5.x/eoa-delegation
                        //
                        // If RELAYER broadcasts: authorization_nonce = current nonce (7702-cleaner uses this)
                        // If EOA broadcasts (our case): authorization_nonce = current nonce + 1
                        //
                        // Reason: EVM increments sender's nonce BEFORE processing authorization list
                        // So when EOA is sender, we must use current + 1 to match the incremented nonce
                        // CRITICAL: Use account.address (not message.address) to ensure consistency
                        const currentNonce = await provider.getTransactionCount(account.address, 'pending');
                        const authorizationNonce = currentNonce + 1; // EOA broadcasts: must use current + 1
                        const transactionNonce = currentNonce; // Transaction uses current nonce (before increment)

                        console.log('[CLEAR_DELEGATION] Nonce calculation (EOA self-execution):', {
                            currentNonce,
                            authorizationNonce,
                            transactionNonce,
                            accountAddress: account.address,
                            messageAddress: address,
                            chainId: targetChainId,
                            note: 'EOA broadcasts transaction, so authorization nonce = current + 1 (EVM increments before validation)'
                        });

                        // Get fee data
                        const feeData = await provider.getFeeData();
                        let maxFeePerGas = feeData.maxFeePerGas || ethers.parseUnits('20', 'gwei');
                        let maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits('2', 'gwei');

                        // CRITICAL: Ensure maxPriorityFeePerGas <= maxFeePerGas
                        // This is especially important on L2s like Arbitrum where fees are very low
                        if (maxPriorityFeePerGas > maxFeePerGas) {
                            maxPriorityFeePerGas = maxFeePerGas;
                        }

                        const gasLimit = 100000n;

                        // Get private key
                        // CRITICAL: Use account.address to ensure we get the correct private key
                        const privateKey = await wallet.getPrivateKey(account.address);
                        if (!privateKey) {
                            safeSendResponse({ success: false, error: 'Private key not found' });
                            break;
                        }

                        // Use the EXACT working approach from test-clear-delegation.ts
                        // Create wallet with provider
                        const ethersWallet = new ethers.Wallet(privateKey, provider);

                        console.log('[CLEAR_DELEGATION] Creating authorization to clear delegation (zero address)...');

                        // Create authorization to clear (zero address) - Ethers.js handles signing internally
                        const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
                        const clearAuthorization = await ethersWallet.authorize({
                            address: ZERO_ADDRESS, // Zero address for clearing
                            chainId: targetChainId,
                            nonce: authorizationNonce
                        });

                        console.log('[CLEAR_DELEGATION] Authorization created:', {
                            chainId: clearAuthorization.chainId,
                            address: clearAuthorization.address,
                            nonce: clearAuthorization.nonce
                        });

                        // Create type-4 transaction with authorization list
                        // This is the EXACT approach that worked in the prototype
                        const transaction = {
                            type: 4,  // EIP-7702
                            to: ethersWallet.address,  // Send to self
                            value: 0,
                            data: '0x',  // No calldata needed
                            gasLimit: Number(gasLimit),
                            maxFeePerGas,
                            maxPriorityFeePerGas,
                            chainId: targetChainId,
                            nonce: transactionNonce,  // Transaction uses current nonce
                            authorizationList: [clearAuthorization]  // Use authorization directly
                        };

                        console.log('[CLEAR_DELEGATION] Broadcasting transaction...');

                        // Let Ethers.js handle everything - signing and broadcasting
                        const txResponse = await ethersWallet.sendTransaction(transaction);

                        console.log('[CLEAR_DELEGATION] Transaction broadcast:', txResponse.hash);

                        // Respond immediately so UI can show toast and close modal
                        safeSendResponse({ success: true, transactionHash: txResponse.hash });

                        // Wait for confirmation in background (don't block UI)
                        txResponse.wait().then(receipt => {
                            console.log('[CLEAR_DELEGATION] Transaction confirmed!', {
                                hash: txResponse.hash,
                                status: receipt?.status,
                                blockNumber: receipt?.blockNumber
                            });
                        }).catch(err => {
                            console.error('[CLEAR_DELEGATION] Confirmation error:', err);
                        });
                    } catch (error: any) {
                        console.error('[CLEAR_DELEGATION] Error:', error);
                        safeSendResponse({ success: false, error: error.message || 'Failed to clear delegation' });
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

                        // This ensures transactions are broadcast to the correct chain
                        const { rpcService } = await import('../core/rpc-service.js');
                        const chainId = txParams.chainId || 1; // Default to mainnet if not specified
                        const rpcUrl = rpcService.getRPCUrl(chainId);
                        const provider = new ethers.JsonRpcProvider(rpcUrl);

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

                case 'GET_SELECTED_NETWORK':
                    safeSendResponse({ success: true, chainId: wallet.getSelectedNetwork() });
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
