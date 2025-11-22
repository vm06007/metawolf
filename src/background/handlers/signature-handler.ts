import { handleSignMessage, handleSignTypedData } from '../message-handler.js';
import type { Wallet } from '../../core/wallet.js';

export async function handleApproveSignature(
    message: any,
    wallet: Wallet,
    safeSendResponse: (response: any) => void
): Promise<void> {
    try {
        const requestId = message.requestId;
        const storage = await chrome.storage.local.get('pendingSignature');
        const pendingSignature = storage.pendingSignature;

        if (!pendingSignature || pendingSignature.id !== requestId) {
            safeSendResponse({ success: false, error: 'Signature request not found' });
            return;
        }

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

        await chrome.storage.local.set({ pendingSignature: null });

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
}

export async function handleRejectSignature(
    message: any,
    safeSendResponse: (response: any) => void
): Promise<void> {
    try {
        const requestId = message.requestId;
        const storage = await chrome.storage.local.get('pendingSignature');
        const pendingSignature = storage.pendingSignature;

        if (!pendingSignature || pendingSignature.id !== requestId) {
            safeSendResponse({ success: false, error: 'Signature request not found' });
            return;
        }

        await chrome.storage.local.set({ pendingSignature: null });

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
}

