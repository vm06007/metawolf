import { ethers } from 'ethers';
import type { Transaction, EIP5742Batch } from '../core/types.js';

/**
 * EIP-5792: Transaction Batching
 * Allows batching multiple transactions into a single transaction
 * for improved efficiency and reduced gas costs
 */
export
    class EIP5742 {
    /**
     * Create a batched transaction from multiple transactions
     */
    static createBatch(transactions: Transaction[]): EIP5742Batch {
        // Calculate total gas limit (with overhead)
        const totalGas = transactions.reduce((sum, tx) => {
            const gas = tx.gasLimit ? BigInt(tx.gasLimit) : BigInt(21000);
            return sum + gas;
        }, BigInt(0));

        // Add batch overhead (typically ~50000 gas per additional tx)
        const batchOverhead = BigInt(50000) * BigInt(transactions.length - 1);
        const totalGasLimit = (totalGas + batchOverhead).toString();

        return {
            transactions,
            gasLimit: totalGasLimit,
        };
    }

    /**
     * Encode batched transactions for execution
     * Uses a batch contract pattern or multicall
     */
    static encodeBatch(batch: EIP5742Batch): string {
        // Multicall pattern: batch.execute([tx1, tx2, ...])
        const multicallInterface = new ethers.Interface([
            'function multicall(bytes[] calldata calls) external returns (bytes[] memory results)',
            'function batchExecute(tuple(address to, uint256 value, bytes data)[] transactions) external',
        ]);

        // Prepare transaction data array
        const calls = batch.transactions.map((tx) => {
            return {
                to: tx.to || ethers.ZeroAddress,
                value: tx.value || '0',
                data: tx.data || '0x',
            };
        });

        // Encode as batchExecute
        const encoded = multicallInterface.encodeFunctionData('batchExecute', [
            calls,
        ]);

        return encoded;
    }

    /**
     * Estimate gas for batched transactions
     */
    static async estimateBatchGas(
        provider: ethers.JsonRpcProvider,
        batch: EIP5742Batch,
        from: string
    ): Promise<bigint> {
        const encoded = this.encodeBatch(batch);

        // Estimate using first transaction's to address as batch contract
        // In practice, this would be a deployed batch contract
        const batchContractAddress =
            batch.transactions[0]?.to || ethers.ZeroAddress;

        try {
            const estimate = await provider.estimateGas({
                from,
                to: batchContractAddress,
                data: encoded,
            });

            // Add safety margin (20%)
            return (estimate * BigInt(120)) / BigInt(100);
        } catch (error) {
            console.error('Error estimating batch gas:', error);
            // Fallback to sum of individual estimates
            return BigInt(batch.gasLimit);
        }
    }

    /**
     * Validate batch structure
     */
    static validateBatch(batch: EIP5742Batch): {
        valid: boolean;
        error?: string;
    } {
        if (!batch.transactions || batch.transactions.length === 0) {
            return { valid: false, error: 'Batch must contain at least one transaction' };
        }

        if (batch.transactions.length > 100) {
            return {
                valid: false,
                error: 'Batch size exceeds maximum (100 transactions)',
            };
        }

        // Validate each transaction
        for (let i = 0; i < batch.transactions.length; i++) {
            const tx = batch.transactions[i];
            if (tx.to && !ethers.isAddress(tx.to)) {
                return {
                    valid: false,
                    error: `Invalid 'to' address in transaction ${i}`,
                };
            }

            if (tx.value && BigInt(tx.value) < 0) {
                return {
                    valid: false,
                    error: `Invalid value in transaction ${i}`,
                };
            }
        }

        return { valid: true };
    }

    /**
     * Split a batch into individual transactions (for fallback)
     */
    static splitBatch(batch: EIP5742Batch): Transaction[] {
        return [...batch.transactions];
    }

    /**
     * Calculate gas savings from batching
     */
    static calculateGasSavings(batch: EIP5742Batch): {
        individualGas: bigint;
        batchGas: bigint;
        savings: bigint;
        savingsPercent: number;
    } {
        const individualGas = batch.transactions.reduce((sum, tx) => {
            const gas = tx.gasLimit ? BigInt(tx.gasLimit) : BigInt(21000);
            return sum + gas;
        }, BigInt(0));

        const batchGas = BigInt(batch.gasLimit);
        const savings = individualGas - batchGas;
        const savingsPercent =
            individualGas > 0
                ? Number((savings * BigInt(10000)) / individualGas) / 100
                : 0;

        return {
            individualGas,
            batchGas,
            savings,
            savingsPercent,
        };
    }
}

