import type { Transaction } from '../core/types.js';
import { ethers } from 'ethers';

/**
 * Handle message signing requests
 * Properly signs messages for SIWE (Sign-In with Ethereum) and other EIP-191 message signing
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
        // Get the account to verify it exists
        const accounts = wallet.getAccounts();
        const account = accounts.find(acc => acc.address.toLowerCase() === address.toLowerCase());
        if (!account) {
            return { success: false, error: 'Account not found' };
        }

        // Check if this is a watch-only account
        if (account.isWatchOnly) {
            return { success: false, error: 'Cannot sign messages with a watch-only address' };
        }

        // Get the private key for signing
        const privateKey = await wallet.getPrivateKey(address);
        if (!privateKey) {
            return { success: false, error: 'Private key not found' };
        }

        // Create a wallet instance for signing
        const signerWallet = new ethers.Wallet(privateKey);
        
        // Sign the message using ethers (handles EIP-191 message signing)
        // The message might be hex-encoded or a plain string
        let messageToSign: string | Uint8Array = message;
        
        // If message starts with 0x, it's hex-encoded
        if (typeof message === 'string' && message.startsWith('0x')) {
            messageToSign = message;
        }
        
        // Sign the message
        const signature = await signerWallet.signMessage(messageToSign);
        
        return {
            success: true,
            signature: signature,
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Handle typed data signing (EIP-712)
 * Properly signs typed data for SIWE and other EIP-712 signing
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
        // Get the account to verify it exists
        const accounts = wallet.getAccounts();
        const account = accounts.find(acc => acc.address.toLowerCase() === address.toLowerCase());
        if (!account) {
            return { success: false, error: 'Account not found' };
        }

        // Check if this is a watch-only account
        if (account.isWatchOnly) {
            return { success: false, error: 'Cannot sign messages with a watch-only address' };
        }

        // Get the private key for signing
        const privateKey = await wallet.getPrivateKey(address);
        if (!privateKey) {
            return { success: false, error: 'Private key not found' };
        }

        // Create a wallet instance for signing
        const signerWallet = new ethers.Wallet(privateKey);
        
        // Extract typed data components
        const domain = typedData.domain;
        const types = typedData.types;
        const message = typedData.message;

        // Sign typed data using ethers (EIP-712)
        const signature = await signerWallet.signTypedData(domain, types, message);
        
        return {
            success: true,
            signature: signature,
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message,
        };
    }
}

