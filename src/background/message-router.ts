import type { Wallet } from '../core/wallet.js';
import { handleConnectDapp, handleApproveConnection, handleRejectConnection } from './handlers/connection-handler.js';
import { handleApproveSignature, handleRejectSignature } from './handlers/signature-handler.js';
import { handleApproveTransaction, handleRejectTransaction } from './handlers/transaction-handler.js';

export interface MessageRouterContext {
    wallet: Wallet;
    sender: chrome.runtime.MessageSender;
    safeSendResponse: (response: any) => void;
}

export async function routeMessage(
    message: any,
    context: MessageRouterContext
): Promise<boolean> {
    const { wallet, sender, safeSendResponse } = context;

    // Only log non-PING messages to reduce spam
    if (message?.type !== 'PING') {
        console.log('[Wolfy] Message received:', message?.type);
    }

    if (!message || !message.type) {
        safeSendResponse({ success: false, error: 'Invalid message' });
        return false;
    }

    try {
        switch (message.type) {
            case 'PING':
                safeSendResponse({ success: true, pong: true });
                break;

            case 'CONNECT_DAPP':
                await handleConnectDapp(message, sender, safeSendResponse);
                break;

            case 'APPROVE_CONNECTION':
                await handleApproveConnection(message, safeSendResponse);
                break;

            case 'REJECT_CONNECTION':
                await handleRejectConnection(safeSendResponse);
                break;

            case 'APPROVE_SIGNATURE':
                await handleApproveSignature(message, wallet, safeSendResponse);
                break;

            case 'REJECT_SIGNATURE':
                await handleRejectSignature(message, safeSendResponse);
                break;

            case 'APPROVE_TRANSACTION':
                await handleApproveTransaction(message, wallet, safeSendResponse);
                break;

            case 'REJECT_TRANSACTION':
                await handleRejectTransaction(message, safeSendResponse);
                break;

            default:
                // For now, return false to indicate the message wasn't handled
                // The original handler in index.ts will handle it
                return false;
        }
        return true;
    } catch (error: any) {
        console.error('[MessageRouter] Error handling message:', error);
        safeSendResponse({ success: false, error: error.message || 'Unknown error' });
        return true;
    }
}

