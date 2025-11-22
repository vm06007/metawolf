import { ethers } from 'ethers';
import { HaloChip } from './halo.js';
import type { Transaction } from '../core/types.js';

/**
 * Ethers.js compatible signer using Arx HaLo chip
 */
export class HaloSigner extends ethers.AbstractSigner {
    private address: string;
    private provider?: ethers.Provider;
    private slot: number;

    constructor(address: string, slot: number = 1, provider?: ethers.Provider) {
        super(provider);
        this.address = address;
        this.provider = provider;
        this.slot = slot;
    }

    async getAddress(): Promise<string> {
        return this.address;
    }

    connect(provider: ethers.Provider): HaloSigner {
        return new HaloSigner(this.address, this.slot, provider);
    }

    async signTransaction(transaction: Transaction): Promise<string> {
        if (!this.provider) {
            throw new Error('Provider not set');
        }

        // Serialize transaction for signing
        const serializedTx = ethers.Transaction.from({
            to: transaction.to,
            value: transaction.value,
            data: transaction.data,
            gasLimit: transaction.gasLimit,
            gasPrice: transaction.gasPrice
                ? BigInt(transaction.gasPrice)
                : undefined,
            maxFeePerGas: transaction.maxFeePerGas
                ? BigInt(transaction.maxFeePerGas)
                : undefined,
            maxPriorityFeePerGas: transaction.maxPriorityFeePerGas
                ? BigInt(transaction.maxPriorityFeePerGas)
                : undefined,
            nonce: transaction.nonce,
            chainId: transaction.chainId,
            type: transaction.type,
        });

        // Get transaction hash to sign
        const unsignedTx = serializedTx.unsignedSerialized;
        const txHash = ethers.keccak256(unsignedTx);

        // Sign with HaLo chip
        const signResponse = await HaloChip.sign(txHash, {
            slot: this.slot,
        });

        if (!signResponse.success || !signResponse.data?.signature) {
            throw new Error(
                `HaLo signing failed: ${signResponse.error || 'Unknown error'}`
            );
        }

        // Parse signature and combine with transaction
        const signature = signResponse.data.signature;
        const sig = ethers.Signature.from(signature);

        // Reconstruct signed transaction
        const signedTx = ethers.Transaction.from({
            ...serializedTx,
            signature: sig,
        });

        return signedTx.serialized;
    }

    async signMessage(message: string | Uint8Array): Promise<string> {
        const messageHash = ethers.hashMessage(message);

        const signResponse = await HaloChip.sign(messageHash, {
            slot: this.slot,
        });

        if (!signResponse.success || !signResponse.data?.signature) {
            throw new Error(
                `HaLo signing failed: ${signResponse.error || 'Unknown error'}`
            );
        }

        return signResponse.data.signature;
    }

    async signTypedData(
        domain: ethers.TypedDataDomain,
        types: Record<string, any>,
        value: Record<string, any>
    ): Promise<string> {
        const hash = ethers.TypedDataEncoder.hash(domain, types, value);

        const signResponse = await HaloChip.sign(hash, {
            slot: this.slot,
        });

        if (!signResponse.success || !signResponse.data?.signature) {
            throw new Error(
                `HaLo signing failed: ${signResponse.error || 'Unknown error'}`
            );
        }

        return signResponse.data.signature;
    }
}

