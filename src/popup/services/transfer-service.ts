import { NexusSDK } from '@avail-project/nexus-core';
import type { TransferParams, TransferResult, SimulationResult } from '@avail-project/nexus-core';

export interface TransferServiceParams {
    token: string;
    amount: number | string;
    chainId: number;
    recipient: `0x${string}`;
    sourceChains?: number[];
}

export class TransferService {
    private sdk: NexusSDK | null = null;

    setSDK(sdk: NexusSDK): void {
        this.sdk = sdk;
    }

    async transfer(params: TransferServiceParams): Promise<TransferResult> {
        if (!this.sdk) {
            return {
                success: false,
                error: 'SDK not initialized',
            };
        }

        try {
            const transferParams: TransferParams = {
                token: params.token as any, // SDK will validate
                amount: params.amount,
                chainId: params.chainId as any, // SDK will validate
                recipient: params.recipient,
                sourceChains: params.sourceChains,
            };

            console.log('[TransferService] Initiating transfer:', transferParams);
            const result = await this.sdk.transfer(transferParams);
            console.log('[TransferService] Transfer result:', result);
            return result;
        } catch (error: any) {
            console.error('[TransferService] Transfer error:', error);
            return {
                success: false,
                error: error.message || 'Transfer failed',
            };
        }
    }

    async simulateTransfer(params: TransferServiceParams): Promise<SimulationResult | null> {
        if (!this.sdk) {
            return null;
        }

        try {
            const transferParams: TransferParams = {
                token: params.token as any,
                amount: params.amount,
                chainId: params.chainId as any,
                recipient: params.recipient,
                sourceChains: params.sourceChains,
            };

            console.log('[TransferService] Simulating transfer:', transferParams);
            const result = await this.sdk.simulateTransfer(transferParams);
            console.log('[TransferService] Simulation result:', result);
            return result;
        } catch (error: any) {
            console.error('[TransferService] Simulation error:', error);
            return null;
        }
    }
}

export const transferService = new TransferService();

