import { loadEthers } from '../ethers-loader';
import type { WalletService } from './wallet-service';

export interface FireflyTransferParams {
    to: string;
    amount: string;
    chainId: number;
    data?: string;
    address: string;
}

export class FireflyTransferService {
    /**
     * Sign and send transaction using Firefly device
     * Opens a separate page for device connection and signing
     */
    async signAndSendTransaction(
        params: FireflyTransferParams,
        walletService: WalletService
    ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
        try {
            const ethersModule = await loadEthers();
            const ethers = ethersModule.ethers || ethersModule.default || ethersModule;

            // Get network RPC URL
            const networks = await walletService.getNetworks();
            const network = networks.find(n => n.chainId === params.chainId);
            if (!network || !network.rpcUrl) {
                throw new Error(`Network not found for chainId ${params.chainId}`);
            }
            const provider = new ethers.JsonRpcProvider(network.rpcUrl);

            // Build transaction
            const value = ethers.parseEther(params.amount);
            
            // Estimate gas
            let gasLimit: bigint;
            try {
                const estimatedGas = await provider.estimateGas({
                    to: params.to,
                    value: value,
                    data: params.data || '0x',
                    from: params.address,
                });
                gasLimit = (estimatedGas * BigInt(120)) / BigInt(100);
            } catch (error) {
                console.warn('[FireflyTransfer] Gas estimation failed, using default:', error);
                gasLimit = BigInt(21000);
            }

            // Get fee data
            const feeData = await provider.getFeeData();
            const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice;
            const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || undefined;
            const nonce = await provider.getTransactionCount(params.address, 'pending');

            // Create request ID
            const requestId = `firefly_sign_${Date.now()}_${Math.random()}`;

            // Store transaction data for signing page
            // Note: FireflySigner will populate gas, nonce, etc. automatically
            // We only need: chainId, to, value, data
            await chrome.storage.local.set({
                [`firefly_sign_${requestId}`]: {
                    transaction: {
                        to: params.to,
                        value: value.toString(), // Already in wei format from parseEther
                        amount: params.amount, // Human-readable amount for display
                        data: params.data || '0x',
                        chainId: params.chainId,
                        // Gas, nonce, fees will be populated by FireflySigner automatically
                    },
                    address: params.address,
                },
            });

            // Open signing page
            const url = chrome.runtime.getURL(`popup/firefly-sign.html?requestId=${requestId}`);
            const tab = await chrome.tabs.create({ url });

            // Wait for signing result
            return new Promise((resolve, reject) => {
                let resolved = false;
                
                // Listen for storage changes
                const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
                    if (areaName !== 'local') return;
                    
                    const storageKey = `firefly_sign_${requestId}`;
                    if (changes[storageKey] && changes[storageKey].newValue && !resolved) {
                        resolved = true;
                        chrome.storage.onChanged.removeListener(storageListener);
                        
                        const result = changes[storageKey].newValue;
                        
                        // Clean up storage
                        chrome.storage.local.remove(storageKey).catch(() => {});
                        
                        // Close the signing tab
                        chrome.tabs.remove(tab.id!).catch(() => {});
                        
                        if (result.success && result.transactionHash) {
                            resolve({
                                success: true,
                                transactionHash: result.transactionHash,
                            });
                        } else {
                            resolve({
                                success: false,
                                error: result.error || 'Transaction signing failed',
                            });
                        }
                    }
                };

                chrome.storage.onChanged.addListener(storageListener);

                // Also poll storage as fallback
                const pollInterval = setInterval(async () => {
                    if (resolved) {
                        clearInterval(pollInterval);
                        return;
                    }
                    
                    try {
                        const storage = await chrome.storage.local.get(`firefly_sign_${requestId}`);
                        const result = storage[`firefly_sign_${requestId}`];
                        
                        if (result && result.timestamp && !resolved) {
                            resolved = true;
                            clearInterval(pollInterval);
                            chrome.storage.onChanged.removeListener(storageListener);
                            
                            // Clean up storage
                            chrome.storage.local.remove(`firefly_sign_${requestId}`).catch(() => {});
                            
                            // Close the signing tab
                            chrome.tabs.remove(tab.id!).catch(() => {});
                            
                            if (result.success && result.transactionHash) {
                                resolve({
                                    success: true,
                                    transactionHash: result.transactionHash,
                                });
                            } else {
                                resolve({
                                    success: false,
                                    error: result.error || 'Transaction signing failed',
                                });
                            }
                        }
                    } catch (error) {
                        // Ignore polling errors
                    }
                }, 500);

                // Timeout after 5 minutes
                setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        clearInterval(pollInterval);
                        chrome.storage.onChanged.removeListener(storageListener);
                        chrome.tabs.remove(tab.id!).catch(() => {});
                        chrome.storage.local.remove(`firefly_sign_${requestId}`).catch(() => {});
                        resolve({
                            success: false,
                            error: 'Transaction signing timeout. Please try again.',
                        });
                    }
                }, 300000);
            });
        } catch (error: any) {
            console.error('[FireflyTransferService] Error:', error);
            return {
                success: false,
                error: error.message || 'Failed to initiate Firefly transaction',
            };
        }
    }
}

export const fireflyTransferService = new FireflyTransferService();

