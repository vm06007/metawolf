import type { Transaction } from '../core/types.js';
import { ethers } from 'ethers';

/**
 * Handle message signing requests
 */
export async function handleSignMessage(
    message: string,
    address: string,
    wallet: any
): Promise<any> {
    if (!wallet.isUnlocked()) {
        return { success: false, error: 'Wallet is locked' };
    }

    try {
        const signedTx = await wallet.signTransaction({
            data: message,
            to: address,
        });

        // Extract signature (simplified - in production, handle message signing properly)
        return {
            success: true,
            signature: signedTx,
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Handle typed data signing
 */
export async function handleSignTypedData(
    address: string,
    typedData: any,
    wallet: any
): Promise<any> {
    if (!wallet.isUnlocked()) {
        return { success: false, error: 'Wallet is locked' };
    }

    try {
        // In production, properly sign typed data according to EIP-712
        const domain = typedData.domain;
        const types = typedData.types;
        const message = typedData.message;

        // For now, return a placeholder
        // In production, use ethers.js TypedDataEncoder
        return {
            success: true,
            signature: '0x' + 'signature_placeholder',
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message,
        };
    }
}

