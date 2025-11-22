import { ethers } from 'ethers';
import type { EIP7702Transaction, Transaction } from '../core/types.js';

/**
 * EIP-7702: Set EOA code
 * Allows externally owned accounts to temporarily set contract code
 * for transaction execution
 */
export class EIP7702 {
    /**
     * Create an EIP-7702 transaction with delegated code
     */
    static createDelegationTransaction(
        baseTx: Transaction,
        delegatedAddress: string,
        codeHash: string
    ): EIP7702Transaction {
        return {
            ...baseTx,
            type: 2, // EIP-1559 style
            delegatedCode: {
                address: delegatedAddress,
                codeHash: codeHash,
            },
        };
    }

    /**
     * Verify delegated code hash matches expected code
     */
    static async verifyCodeHash(
        provider: ethers.JsonRpcProvider,
        address: string,
        expectedHash: string
    ): Promise<boolean> {
        try {
            const code = await provider.getCode(address);
            const actualHash = ethers.keccak256(code);
            return actualHash === expectedHash;
        } catch (error) {
            console.error('Error verifying code hash:', error);
            return false;
        }
    }

    /**
     * Encode EIP-7702 transaction for signing
     * The transaction type 0x04 indicates EIP-7702 delegation
     */
    static encodeTransaction(tx: EIP7702Transaction): string {
        if (!tx.delegatedCode) {
            throw new Error('Missing delegated code for EIP-7702 transaction');
        }

        // EIP-7702 uses transaction type 0x04
        // RLP encoding: [type, [chainId, nonce, maxPriorityFeePerGas, maxFeePerGas,
        //                       gasLimit, to, value, data, accessList, 
        //                       [delegatedAddress, delegatedCodeHash]]]
        const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
            ['tuple(uint256, address, bytes32)'],
            [[tx.chainId || 1, tx.delegatedCode.address, tx.delegatedCode.codeHash]]
        );

        return encoded;
    }

    /**
     * Prepare transaction with delegation for signing
     */
    static prepareTransactionForSigning(
        tx: EIP7702Transaction
    ): ethers.TransactionRequest {
        const baseTx: ethers.TransactionRequest = {
            to: tx.to,
            value: tx.value ? BigInt(tx.value) : undefined,
            data: tx.data,
            gasLimit: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
            maxFeePerGas: tx.maxFeePerGas ? BigInt(tx.maxFeePerGas) : undefined,
            maxPriorityFeePerGas: tx.maxPriorityFeePerGas
                ? BigInt(tx.maxPriorityFeePerGas)
                : undefined,
            nonce: tx.nonce,
            chainId: tx.chainId,
            type: 4, // EIP-7702 transaction type
        };

        return baseTx;
    }

    /**
     * Validate EIP-7702 transaction structure
     */
    static validateTransaction(tx: EIP7702Transaction): {
        valid: boolean;
        error?: string;
    } {
        if (!tx.delegatedCode) {
            return { valid: false, error: 'Missing delegated code' };
        }

        if (!ethers.isAddress(tx.delegatedCode.address)) {
            return { valid: false, error: 'Invalid delegated address' };
        }

        if (!/^0x[a-fA-F0-9]{64}$/.test(tx.delegatedCode.codeHash)) {
            return {
                valid: false,
                error: 'Invalid code hash format (must be 32 bytes)',
            };
        }

        if (tx.chainId === undefined) {
            return { valid: false, error: 'Missing chain ID' };
        }

        return { valid: true };
    }
}

