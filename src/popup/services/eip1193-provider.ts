import type { EthereumProvider } from '@avail-project/nexus-core';
import type { JsonRpcProvider } from 'ethers';

/**
 * Creates an EIP-1193 provider wrapper from an ethers JsonRpcProvider
 * This allows the Nexus SDK to work with the wallet's provider
 * Supports signing methods needed for SIWE (Sign-In with Ethereum)
 */
export function createEIP1193Provider(provider: JsonRpcProvider, address: string): EthereumProvider {
    const eip1193Provider: EthereumProvider = {
        request: async (args: { method: string; params?: any[] }) => {
            switch (args.method) {
                case 'eth_accounts':
                    return [address];
                case 'eth_requestAccounts':
                    return [address];
                case 'eth_chainId':
                    const network = await provider.getNetwork();
                    return `0x${network.chainId.toString(16)}`;
                case 'eth_getBalance':
                    if (args.params && args.params[0]) {
                        const balance = await provider.getBalance(args.params[0]);
                        return `0x${balance.toString(16)}`;
                    }
                    throw new Error('Missing address parameter');
                case 'personal_sign':
                    // Sign message for SIWE - required by Nexus SDK
                    if (args.params && args.params.length >= 2) {
                        const message = args.params[0];
                        const signerAddress = args.params[1];
                        
                        try {
                            // Call background script to sign the message
                            const response = await chrome.runtime.sendMessage({
                                type: 'SIGN_MESSAGE',
                                message: message,
                                address: signerAddress || address,
                            });
                            
                            if (chrome.runtime.lastError) {
                                throw new Error(chrome.runtime.lastError.message);
                            }
                            
                            if (response?.success && response?.signature) {
                                return response.signature;
                            } else {
                                throw new Error(response?.error || 'Failed to sign message');
                            }
                        } catch (error: any) {
                            console.error('[EIP1193Provider] Error signing message:', error);
                            throw error;
                        }
                    }
                    throw new Error('Invalid parameters for personal_sign');
                case 'eth_signTypedData_v4':
                case 'eth_signTypedData':
                    // Sign typed data for SIWE
                    if (args.params && args.params.length >= 2) {
                        const signerAddress = args.params[0];
                        const typedData = args.params[1];
                        
                        try {
                            const response = await chrome.runtime.sendMessage({
                                type: 'SIGN_TYPED_DATA',
                                address: signerAddress || address,
                                typedData: typedData,
                            });
                            
                            if (chrome.runtime.lastError) {
                                throw new Error(chrome.runtime.lastError.message);
                            }
                            
                            if (response?.success && response?.signature) {
                                return response.signature;
                            } else {
                                throw new Error(response?.error || 'Failed to sign typed data');
                            }
                        } catch (error: any) {
                            console.error('[EIP1193Provider] Error signing typed data:', error);
                            throw error;
                        }
                    }
                    throw new Error('Invalid parameters for eth_signTypedData');
                case 'eth_sign':
                    // Legacy sign method - use personal_sign
                    if (args.params && args.params.length >= 2) {
                        const signerAddress = args.params[0];
                        const messageHash = args.params[1];
                        // Recursively call personal_sign
                        return eip1193Provider.request({ method: 'personal_sign', params: [messageHash, signerAddress] });
                    }
                    throw new Error('Invalid parameters for eth_sign');
                case 'wallet_switchEthereumChain':
                    // SDK tries to switch to chain 1 (Ethereum mainnet) for SIWE signing
                    // Our provider is already on mainnet, so we can just return success
                    if (args.params && args.params[0] && args.params[0].chainId) {
                        const requestedChainId = parseInt(args.params[0].chainId, 16);
                        const currentChainId = (await provider.getNetwork()).chainId;
                        
                        if (requestedChainId === currentChainId) {
                            // Already on the requested chain
                            return null;
                        }
                        
                        // If different chain, we can't switch but that's okay for read-only operations
                        console.log(`[EIP1193Provider] Chain switch requested to ${requestedChainId}, currently on ${currentChainId}`);
                        return null; // Return null to indicate success (EIP-1193 spec)
                    }
                    return null;
                case 'eth_sendTransaction':
                    // Transaction signing and sending - required by Nexus SDK
                    if (args.params && args.params[0]) {
                        const txParams = args.params[0];
                        
                        try {
                            // Send transaction to background script for signing and sending
                            const response = await chrome.runtime.sendMessage({
                                type: 'SEND_TRANSACTION',
                                transaction: {
                                    to: txParams.to,
                                    value: txParams.value || '0x0',
                                    data: txParams.data || '0x',
                                    gasLimit: txParams.gas || txParams.gasLimit,
                                    gasPrice: txParams.gasPrice,
                                    maxFeePerGas: txParams.maxFeePerGas,
                                    maxPriorityFeePerGas: txParams.maxPriorityFeePerGas,
                                    nonce: txParams.nonce,
                                    chainId: txParams.chainId ? parseInt(txParams.chainId, 16) : undefined,
                                    type: txParams.type,
                                },
                                address: address,
                            });
                            
                            if (chrome.runtime.lastError) {
                                throw new Error(chrome.runtime.lastError.message);
                            }
                            
                            if (response?.success && response?.transactionHash) {
                                return response.transactionHash;
                            } else {
                                throw new Error(response?.error || 'Failed to send transaction');
                            }
                        } catch (error: any) {
                            console.error('[EIP1193Provider] Error sending transaction:', error);
                            throw error;
                        }
                    }
                    throw new Error('Invalid parameters for eth_sendTransaction');
                default:
                    // For other methods, try to call the provider directly
                    try {
                        return await provider.send(args.method, args.params || []);
                    } catch (error) {
                        console.error(`[EIP1193Provider] Error calling ${args.method}:`, error);
                        throw error;
                    }
            }
        },
        on: (event: string, handler: (...args: any[]) => void) => {
            // Provider event handling - can be extended if needed
            console.log(`[EIP1193Provider] Event listener registered: ${event}`);
        },
        removeListener: (event: string, handler: (...args: any[]) => void) => {
            // Provider event handling - can be extended if needed
            console.log(`[EIP1193Provider] Event listener removed: ${event}`);
        },
    } as EthereumProvider;
    
    return eip1193Provider;
}

