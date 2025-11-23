import { ethers } from 'ethers';
import { getAddress, keccak256, hexToBytes, bytesToHex, numberToHex, recoverAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import RLP from 'rlp';
import type { EIP7702Transaction, Transaction } from '../core/types.js';

const DELEGATION_PREFIX = '0xef0100';
const SET_CODE_TX_TYPE = 0x04;
const MAGIC = 0x05;

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

    /**
     * Check if an address has an EIP-7702 delegation set
     */
    static async checkDelegation(
        address: string,
        provider: ethers.JsonRpcProvider
    ): Promise<{
        isDelegated: boolean;
        delegateAddress: string | null;
        codeHash: string;
    }> {
        try {
            // Verify which network we're actually querying
            const network = await provider.getNetwork();
            const actualChainId = Number(network.chainId);

            const code = await provider.getCode(address);
            const codeHex = code || '0x';
            const codeHash = keccak256(codeHex as `0x${string}`);

            // Check if code starts with delegation prefix
            if (code && code.startsWith(DELEGATION_PREFIX)) {
                // Extract delegate address (20 bytes after prefix)
                // Format: 0xef0100 + 20 bytes (40 hex chars) = starts at position 8, length 40
                const delegateAddress = '0x' + code.slice(8, 48);
                return {
                    isDelegated: true,
                    delegateAddress: getAddress(delegateAddress).toLowerCase(),
                    codeHash: codeHash
                };
            }

            return {
                isDelegated: false,
                delegateAddress: null,
                codeHash: codeHash
            };
        } catch (error: any) {
            console.error('[EIP7702.checkDelegation] Error:', error);
            throw new Error(`Failed to check delegation: ${error.message}`);
        }
    }

    /**
     * Create an EIP-7702 authorization to clear delegation (set to zero address)
     */
    static createClearAuthorization(chainId: number): {
        chainId: number;
        contractAddress: string;
        version: bigint;
    } {
        const zeroAddress = '0x0000000000000000000000000000000000000000';
        return {
            chainId: chainId,
            contractAddress: zeroAddress,
            version: 0n
        };
    }

    /**
     * Create an EIP-7702 authorization to set delegation to a specific contract address
     */
    static createSetAuthorization(contractAddress: string, chainId: number): {
        chainId: number;
        contractAddress: string;
        version: bigint;
    } {
        return {
            chainId: chainId,
            contractAddress: getAddress(contractAddress),
            version: 0n
        };
    }

    /**
     * Convert bigint to minimal bytes (no leading zeros)
     * Returns Uint8Array so RLP encodes it as bytes, not as a list
     */
    private static bigIntToMinimalBytes(value: bigint): number[] {
        // Match reference implementation exactly: return [] for zero, return number[] not Uint8Array
        if (value === 0n) return [];
        const hex = value.toString(16);
        const padded = hex.length % 2 === 0 ? hex : '0' + hex;
        return Array.from(hexToBytes(('0x' + padded) as `0x${string}`));
    }

    /**
     * Convert address to bytes (20 bytes, no 0x prefix)
     */
    private static addressToBytes(address: string): Uint8Array {
        const addrBytes = hexToBytes(address as `0x${string}`);
        if (addrBytes.length === 20) {
            return addrBytes;
        }
        const result = new Uint8Array(20);
        if (addrBytes.length > 20) {
            result.set(addrBytes.slice(-20), 0);
        } else {
            result.set(addrBytes, 20 - addrBytes.length);
        }
        return result;
    }

    /**
     * Sign an EIP-7702 authorization
     */
    static async signEIP7702Authorization(
        privateKey: string,
        authorization: { chainId: number; contractAddress: string; version: bigint },
        useNonce: number | null = null
    ): Promise<{
        chainId: number;
        contractAddress: string;
        version: bigint;
        nonce: number | null;
        r: string;
        s: string;
        yParity: number;
    }> {
        try {
            // Use Ethers.js's built-in authorize() method for correct signing
            const { ethers } = await import('ethers');
            const wallet = new ethers.Wallet(privateKey);

            const authNonce = useNonce !== null ? useNonce : Number(authorization.version);

            const auth = await wallet.authorize({
                address: authorization.contractAddress,
                chainId: authorization.chainId,
                nonce: authNonce
            }) as any;

            return {
                chainId: Number(auth.chainId),
                contractAddress: auth.address,
                version: BigInt(auth.nonce),
                nonce: Number(auth.nonce),
                r: auth.r,
                s: auth.s,
                yParity: auth.yParity
            };
        } catch (error: any) {
            throw new Error(`Failed to sign authorization: ${error.message}`);
        }
    }

    /**
     * Build type-4 transaction with authorization list
     */
    static buildType4Transaction(
        eoaAddress: string,
        chainId: number,
        authorizationList: Array<{
            chainId: number;
            contractAddress: string;
            version: bigint;
            r: string;
            s: string;
            yParity: number;
            nonce?: number | null;
        }>,
        nonce: number,
        gasLimit: bigint,
        maxFeePerGas: bigint,
        maxPriorityFeePerGas: bigint
    ): {
        type: number;
        chainId: number;
        to: string;
        value: bigint;
        data: string;
        nonce: number;
        gasLimit: bigint;
        maxFeePerGas: bigint;
        maxPriorityFeePerGas: bigint;
        authorizations: Array<{
            chainId: number;
            contractAddress: string;
            version: bigint;
            r: string;
            s: string;
            yParity: number;
        }>;
    } {
        return {
            type: SET_CODE_TX_TYPE,
            chainId: chainId,
            to: getAddress(eoaAddress),
            value: 0n,
            data: '0x',
            nonce: nonce,
            gasLimit: gasLimit,
            maxFeePerGas: maxFeePerGas,
            maxPriorityFeePerGas: maxPriorityFeePerGas,
            authorizations: authorizationList.map(auth => ({
                chainId: auth.chainId,
                contractAddress: getAddress(auth.contractAddress),
                version: typeof auth.version === 'bigint' ? auth.version : BigInt(auth.version),
                r: auth.r,
                s: auth.s,
                yParity: auth.yParity
            }))
        };
    }

    /**
     * Build and sign type-4 transaction using RLP encoding
     */
    static async buildAndSignType4Transaction(
        tx: {
            chainId: number;
            to: string;
            nonce: number;
            gasLimit: bigint;
            maxFeePerGas: bigint;
            maxPriorityFeePerGas: bigint;
            authorizations: Array<{
                chainId: number;
                contractAddress: string;
                version: bigint;
                r: string;
                s: string;
                yParity: number;
                nonce?: number | null;
            }>;
        },
        privateKey: string
    ): Promise<string> {
        const chainId = BigInt(tx.chainId);
        const toAddrBytes = this.addressToBytes(tx.to);

        // Build transaction: [chainId, nonce, gasTip, gasFeeCap, gasLimit, toAddress, value, txData, access_list, [authorization_tuple]]
        // For transaction RLP encoding, we need Uint8Array so RLP treats them as bytes, not lists
        // Convert number[] from bigIntToMinimalBytes to Uint8Array
        const rawTx: any[] = [
            new Uint8Array(this.bigIntToMinimalBytes(chainId)),
            new Uint8Array(this.bigIntToMinimalBytes(BigInt(tx.nonce))),
            new Uint8Array(this.bigIntToMinimalBytes(tx.maxPriorityFeePerGas)),
            new Uint8Array(this.bigIntToMinimalBytes(tx.maxFeePerGas)),
            new Uint8Array(this.bigIntToMinimalBytes(tx.gasLimit)),
            toAddrBytes, // Uint8Array - RLP recognizes as bytes
            new Uint8Array([]), // value = 0 (empty Uint8Array)
            new Uint8Array([]), // txData = empty (empty Uint8Array)
            [], // access_list = empty array
            tx.authorizations.map(auth => {
                const contractAddrBytes = this.addressToBytes(auth.contractAddress);
                const authNonce = auth.nonce !== null && auth.nonce !== undefined
                    ? BigInt(auth.nonce)
                    : auth.version;

                // CRITICAL: r and s MUST be exactly 32 bytes for ECDSA signatures
                // Do NOT use bigIntToMinimalBytes as it removes leading zeros!
                const rHex = numberToHex(BigInt(auth.r), { size: 32 });
                const sHex = numberToHex(BigInt(auth.s), { size: 32 });
                const rBytes = hexToBytes(rHex as `0x${string}`);
                const sBytes = hexToBytes(sHex as `0x${string}`);

                // EIP-7702 authorization tuple: [chain_id, address, nonce, y_parity, r, s]
                // Authority is derived from the signature, not included in the tuple
                // For transaction RLP, use Uint8Array so RLP treats them as bytes
                // CRITICAL: yParity must be encoded as a single byte value [0] or [1], not as a number
                // Reference: 7702-cleaner uses yParity directly, which RLP encodes as a single byte
                return [
                    new Uint8Array(this.bigIntToMinimalBytes(BigInt(auth.chainId))),
                    contractAddrBytes, // Delegated contract address
                    new Uint8Array(this.bigIntToMinimalBytes(authNonce)),
                    auth.yParity, // Single byte value (uint8) - RLP encodes directly as byte (0 or 1)
                    rBytes,
                    sBytes
                ];
            })
        ];

        // RLP encode unsigned transaction
        const rlpPayload = RLP.encode(rawTx);

        // Hash: keccak256(0x04 || rlpPayload)
        // RLP.encode returns Uint8Array - ensure it's a Uint8Array
        const rlpBytes = rlpPayload instanceof Uint8Array
            ? rlpPayload
            : new Uint8Array(rlpPayload);
        const hashInput = new Uint8Array([SET_CODE_TX_TYPE, ...Array.from(rlpBytes)]);
        const hash = keccak256(bytesToHex(hashInput));

        // Sign with private key
        const account = privateKeyToAccount(privateKey as `0x${string}`);
        const signature = await account.sign({ hash });

        // Extract r, s from signature
        const sigHex = signature.startsWith('0x') ? signature.slice(2) : signature;
        const sigR = '0x' + sigHex.slice(0, 64);
        const sigS = '0x' + sigHex.slice(64, 128);
        const v = parseInt(sigHex.slice(128, 130), 16);
        const sigYParity = v - 27;

        // Convert to bigints
        const sigRBigInt = BigInt(sigR);
        const sigSBigInt = BigInt(sigS);

        // CRITICAL: r and s MUST be exactly 32 bytes for ECDSA signatures
        // Do NOT use bigIntToMinimalBytes as it removes leading zeros!
        const txSigRHex = numberToHex(sigRBigInt, { size: 32 });
        const txSigSHex = numberToHex(sigSBigInt, { size: 32 });
        const txSigRBytes = hexToBytes(txSigRHex as `0x${string}`);
        const txSigSBytes = hexToBytes(txSigSHex as `0x${string}`);

        // Build signed transaction: append [yParity, r, s] to unsigned transaction
        const signedTxRaw = [
            ...rawTx,
            sigYParity, // Single byte value (uint8) - RLP encodes directly as byte
            txSigRBytes,
            txSigSBytes
        ];

        // RLP encode signed transaction
        const finalPayload = RLP.encode(signedTxRaw);

        // Prepend transaction type byte
        // RLP.encode returns Uint8Array - ensure it's a Uint8Array
        const finalPayloadBytes = finalPayload instanceof Uint8Array
            ? finalPayload
            : new Uint8Array(finalPayload);
        const finalTx = new Uint8Array([SET_CODE_TX_TYPE, ...Array.from(finalPayloadBytes)]);

        return bytesToHex(finalTx);
    }
}

