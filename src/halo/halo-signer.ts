import { HaloChip } from './halo.js';
import type { Transaction } from '../core/types.js';

// Ethers will be loaded dynamically to avoid bundling conflicts
let ethersModule: any = null;

async function getEthers() {
    if (ethersModule) {
        return ethersModule;
    }
    
    // Try to load from bundled file (for popup)
    try {
        const ethersUrl = chrome.runtime.getURL('popup/lib/ethers.js');
        const module = await import(ethersUrl);
        ethersModule = module.ethers || module.default || module;
        return ethersModule;
    } catch (error) {
        // Fallback to direct import (for background/other contexts)
        try {
            const module = await import('ethers');
            ethersModule = module.ethers || module.default || module;
            return ethersModule;
        } catch (err) {
            console.error('[HaloSigner] Failed to load ethers:', err);
            throw new Error('Failed to load ethers library');
        }
    }
}

/**
 * Ethers.js compatible signer using Arx HaLo chip
 */
export class HaloSigner {
    private address: string;
    private provider?: any;
    private slot: number;
    private ethers: any = null;

    constructor(address: string, slot: number = 1, provider?: any) {
        this.address = address;
        this.provider = provider;
        this.slot = slot;
    }

    private async ensureEthers() {
        if (!this.ethers) {
            this.ethers = await getEthers();
        }
        return this.ethers;
    }

    async getAddress(): Promise<string> {
        return this.address;
    }

    connect(provider: any): HaloSigner {
        return new HaloSigner(this.address, this.slot, provider);
    }

    async signTransaction(
        transaction: Transaction,
        onPairing?: (pairInfo: any) => void
    ): Promise<string> {
        if (!this.provider) {
            throw new Error('Provider not set');
        }

        const ethers = await this.ensureEthers();

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
        // For EIP-1559, we need to sign the keccak256 of the unsigned serialized transaction
        const unsignedTx = serializedTx.unsignedSerialized;
        const txHash = ethers.keccak256(unsignedTx);
        
        console.log('[HaloSigner] Transaction hash to sign:', {
            hash: txHash,
            unsignedTxLength: unsignedTx.length,
            chainId: serializedTx.chainId,
            type: serializedTx.type,
        });

        // Sign with HaLo chip (with QR code support)
        console.log('[HaloSigner] Signing with chip:', {
            expectedAddress: this.address,
            slot: this.slot,
            txHash: txHash,
        });
        
        const signResponse = await HaloChip.sign(txHash, {
            slot: this.slot,
            onPairing: onPairing,
        });

        if (!signResponse.success || !signResponse.data?.signature) {
            throw new Error(
                `HaLo signing failed: ${signResponse.error || 'Unknown error'}`
            );
        }

        // Parse signature and combine with transaction
        const signature = signResponse.data.signature;
        
        // Handle different signature formats from Halo chip
        // The LibHaLo gateway returns a signature object with raw, der, and ether fields
        // For EIP-1559 transactions, we need yParity (0 or 1) instead of v (27 or 28)
        const txType = transaction.type || (transaction.maxFeePerGas ? 2 : 0);
        const isEIP1559 = txType === 2;
        
        console.log('[HaloSigner] Parsing signature:', {
            signatureType: typeof signature,
            isObject: signature && typeof signature === 'object',
            hasRaw: signature?.raw,
            hasEther: signature?.ether,
            rawV: signature?.raw?.v,
        });
        
        let sig;
        if (typeof signature === 'string') {
            // If it's already a string (hex format), use it directly
            sig = ethers.Signature.from(signature);
        } else if (signature && typeof signature === 'object') {
            // The gateway returns a signature object with raw, der, and ether fields
            if (signature.raw && signature.raw.r && signature.raw.s && signature.raw.v !== undefined) {
                // Use the raw object format {r, s, v}
                let v = signature.raw.v;
                
                // For EIP-1559, convert v (27/28) to yParity (0/1)
                if (isEIP1559) {
                    // v = 27 → yParity = 0, v = 28 → yParity = 1
                    const yParity = v === 27 ? 0 : v === 28 ? 1 : v;
                    console.log('[HaloSigner] Converting signature for EIP-1559:', {
                        v: v,
                        yParity: yParity,
                        r: signature.raw.r,
                        s: signature.raw.s,
                    });
                    sig = ethers.Signature.from({
                        r: '0x' + signature.raw.r,
                        s: '0x' + signature.raw.s,
                        yParity: yParity,
                    });
                } else {
                    // For legacy transactions, use v directly
                    sig = ethers.Signature.from({
                        r: '0x' + signature.raw.r,
                        s: '0x' + signature.raw.s,
                        v: v,
                    });
                }
            } else if (signature.ether) {
                // Use the "ether" format string (0x{r}{s}{v})
                // Note: For EIP-1559, this might not work correctly, so prefer raw format
                console.warn('[HaloSigner] Using ether format signature (may not work for EIP-1559)');
                sig = ethers.Signature.from(signature.ether);
            } else {
                // Try to use the object directly (ethers might accept it)
                sig = ethers.Signature.from(signature);
            }
        } else {
            throw new Error(`Invalid signature format: ${JSON.stringify(signature)}`);
        }

        // Reconstruct signed transaction using the serialized transaction properties
        // This ensures we use the exact same values that were signed
        const txData: any = {
            to: serializedTx.to,
            value: serializedTx.value,
            data: serializedTx.data,
            gasLimit: serializedTx.gasLimit,
            nonce: serializedTx.nonce,
            chainId: transaction.chainId, // Use original chainId to ensure it's set
            type: isEIP1559 ? 2 : 0,
            signature: sig,
        };

        // Only include EIP-1559 fields for type 2 transactions
        if (isEIP1559) {
            txData.maxFeePerGas = serializedTx.maxFeePerGas;
            txData.maxPriorityFeePerGas = serializedTx.maxPriorityFeePerGas;
            // Don't include gasPrice for EIP-1559
        } else {
            // For legacy transactions, include gasPrice if present
            if (serializedTx.gasPrice) {
                txData.gasPrice = serializedTx.gasPrice;
            }
        }

        let signedTx = ethers.Transaction.from(txData);

        // Verify the transaction is valid before returning
        if (!signedTx.serialized) {
            throw new Error('Failed to serialize signed transaction');
        }

        // Verify the signature matches the transaction
        // For EIP-1559, the transaction's `from` property uses the correct recovery
        // But we should also verify manually to ensure correctness
        try {
            // The transaction's built-in recovery method (most reliable)
            const recoveredFromTx = signedTx.from;
            
            // Manual recovery from the unsigned hash (for verification)
            const unsignedHash = ethers.keccak256(serializedTx.unsignedSerialized);
            const recoveredFromHash = ethers.recoverAddress(unsignedHash, sig);
            
            console.log('[HaloSigner] Signature recovery:', {
                expected: this.address,
                recoveredFromTx: recoveredFromTx,
                recoveredFromHash: recoveredFromHash,
                txHash: unsignedHash,
                matchTx: recoveredFromTx && recoveredFromTx.toLowerCase() === this.address.toLowerCase(),
                matchHash: recoveredFromHash.toLowerCase() === this.address.toLowerCase(),
            });
            
            // Try both recovery methods and alternative yParity
            let foundMatch = false;
            
            // Check if either recovery method matches
            if (recoveredFromTx && recoveredFromTx.toLowerCase() === this.address.toLowerCase()) {
                foundMatch = true;
                console.log('[HaloSigner] Signature recovery successful (from transaction)');
            } else if (recoveredFromHash.toLowerCase() === this.address.toLowerCase()) {
                foundMatch = true;
                console.log('[HaloSigner] Signature recovery successful (from hash)');
            } else {
                // Try alternative yParity
                if (isEIP1559 && signature.raw) {
                    const altYParity = signature.raw.v === 27 ? 1 : 0;
                    const altSig = ethers.Signature.from({
                        r: '0x' + signature.raw.r,
                        s: '0x' + signature.raw.s,
                        yParity: altYParity,
                    });
                    
                    const altTxData = { ...txData, signature: altSig };
                    const altSignedTx = ethers.Transaction.from(altTxData);
                    const altRecoveredFromTx = altSignedTx.from;
                    const altRecoveredFromHash = ethers.recoverAddress(unsignedHash, altSig);
                    
                    console.log('[HaloSigner] Trying alternative yParity:', {
                        yParity: altYParity,
                        recoveredFromTx: altRecoveredFromTx,
                        recoveredFromHash: altRecoveredFromHash,
                        matchTx: altRecoveredFromTx && altRecoveredFromTx.toLowerCase() === this.address.toLowerCase(),
                        matchHash: altRecoveredFromHash.toLowerCase() === this.address.toLowerCase(),
                    });
                    
                    if ((altRecoveredFromTx && altRecoveredFromTx.toLowerCase() === this.address.toLowerCase()) ||
                        altRecoveredFromHash.toLowerCase() === this.address.toLowerCase()) {
                        signedTx = altSignedTx;
                        foundMatch = true;
                        console.log('[HaloSigner] Using corrected signature with yParity:', altYParity);
                    }
                }
            }
            
            if (!foundMatch) {
                // If recovery fails, the signature is invalid - don't proceed
                throw new Error(
                    `Signature recovery failed: expected ${this.address}, ` +
                    `got ${recoveredFromTx || recoveredFromHash}. ` +
                    `This indicates the signature from chip slot ${this.slot} does not match the expected address. ` +
                    `Please verify the chip slot corresponds to address ${this.address}.`
                );
            }
        } catch (error) {
            console.error('[HaloSigner] Signature verification error:', error);
            throw error;
        }

        console.log('[HaloSigner] Signed transaction:', {
            hash: signedTx.hash,
            from: signedTx.from,
            to: signedTx.to,
            value: signedTx.value.toString(),
            chainId: signedTx.chainId,
            type: signedTx.type,
            nonce: signedTx.nonce,
        });

        return signedTx.serialized;
    }

    async signMessage(message: string | Uint8Array): Promise<string> {
        const ethers = await this.ensureEthers();
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
        domain: any,
        types: Record<string, any>,
        value: Record<string, any>
    ): Promise<string> {
        const ethers = await this.ensureEthers();
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

