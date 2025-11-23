import { transferService } from '../services/transfer-service';
import { unifiedBalanceService } from '../services/unified-balance-service';
import { multisigService } from '../services/multisig-service';
import { fireflyTransferService } from '../services/firefly-transfer-service';
import { loadEthers } from '../ethers-loader';
import { encodeERC20Transfer, getTokenContractAddress } from '../utils/erc20';
import type { AppState } from '../types/app-state';
import type { WalletService } from '../services/wallet-service';

export interface TransferContext {
    state: AppState;
    walletService: WalletService;
    render: () => void;
    showSuccessMessage: (message: string, transactionHash?: string, chainId?: number) => void;
    showErrorMessage: (message: string) => void;
    loadUnifiedBalances: () => Promise<void>;
    handleHaloETHTransfer: (params: { amount: string; recipient: string; chainId: number }) => Promise<{ success: boolean; transactionHash?: string; error?: string }>;
}

export async function handleSendTransfer(
    params: {
        token: string;
        amount: string;
        recipient: string;
        chainId: number;
        sourceChains?: number[];
    },
    context: TransferContext
): Promise<void> {
    const { state, walletService, render, showSuccessMessage, showErrorMessage, loadUnifiedBalances, handleHaloETHTransfer } = context;
    
    try {
        const isNative = params.token.toUpperCase() === 'ETH' ||
            params.token.toUpperCase() === 'MATIC' ||
            params.token.toUpperCase() === 'BNB' ||
            params.token.toUpperCase() === 'AVAX';

        const selectedAccount = await walletService.getSelectedAccount();
        const isHaloChipAccount = selectedAccount?.isChipAccount && selectedAccount?.chipInfo;
        const isMultisigAccount = selectedAccount?.multisig;
        const isFireflyAccount = selectedAccount?.isFireflyAccount;

        // Handle Firefly account transfers (requires device connection and signing)
        if (isFireflyAccount) {
            if (!selectedAccount.address) {
                throw new Error('Firefly account address not found');
            }

            const ethersModule = await loadEthers();
            const ethers = ethersModule.ethers || ethersModule.default || ethersModule;

            // Build transaction parameters
            let toAddress = params.recipient;
            let transferAmount = params.amount;
            let data = '0x';

            if (isNative) {
                // Native ETH transfer - send directly to recipient
                toAddress = params.recipient;
                transferAmount = params.amount;
                data = '0x';
            } else {
                // ERC20 token transfer - send to token contract with encoded data
                const asset = state.unifiedBalanceData?.assets.find(a => a.symbol === params.token);
                if (!asset) {
                    throw new Error(`Token ${params.token} not found in balance`);
                }

                let tokenContractAddress: string | null = null;
                if ((asset as any).contractAddress) {
                    tokenContractAddress = (asset as any).contractAddress;
                } else if ((asset as any).address) {
                    tokenContractAddress = (asset as any).address;
                } else {
                    tokenContractAddress = getTokenContractAddress(params.token, params.chainId);
                }

                if (!tokenContractAddress) {
                    throw new Error(`Token contract address not found for ${params.token} on chain ${params.chainId}`);
                }

                const decimals = (asset as any).decimals || 18;
                const amountBigInt = ethers.parseUnits(params.amount, decimals);
                data = encodeERC20Transfer(params.recipient, amountBigInt);
                toAddress = tokenContractAddress;
                transferAmount = '0'; // ERC20 uses data field, value is 0
            }

            // Use Firefly transfer service (opens connection page)
            const result = await fireflyTransferService.signAndSendTransaction({
                to: toAddress,
                amount: transferAmount,
                chainId: params.chainId,
                data: data,
                address: selectedAccount.address,
            }, walletService);

            if (result.success && result.transactionHash) {
                // Show transaction hash immediately after device confirmation
                showSuccessMessage('Transaction submitted!', result.transactionHash, params.chainId);
                await loadUnifiedBalances();
                state.showSendScreen = false;
                render();
            } else {
                throw new Error(result.error || 'Firefly transfer failed');
            }
            return;
        }

        // Handle multisig account transfers (requires 2 chip scans)
        if (isMultisigAccount) {
            if (!selectedAccount.multisig?.deployed || !selectedAccount.multisig?.deployedAddress) {
                throw new Error('Multisig contract not deployed. Please deploy it first.');
            }

            const ethersModule = await loadEthers();
            const ethers = ethersModule.ethers || ethersModule.default || ethersModule;
            
            let value = '0x0';
            let data = '0x';

            if (isNative) {
                // Native ETH transfer - value in wei (as decimal string)
                value = ethers.parseEther(params.amount).toString();
            } else {
                // ERC20 token transfer
                const asset = state.unifiedBalanceData?.assets.find(a => a.symbol === params.token);
                if (!asset) {
                    throw new Error(`Token ${params.token} not found in balance`);
                }

                let tokenContractAddress: string | null = null;
                if ((asset as any).contractAddress) {
                    tokenContractAddress = (asset as any).contractAddress;
                } else if ((asset as any).address) {
                    tokenContractAddress = (asset as any).address;
                } else {
                    tokenContractAddress = getTokenContractAddress(params.token, params.chainId);
                }

                if (!tokenContractAddress) {
                    throw new Error(`Token contract address not found for ${params.token} on chain ${params.chainId}`);
                }

                const decimals = (asset as any).decimals || 18;
                const amountBigInt = ethers.parseUnits(params.amount, decimals);
                data = encodeERC20Transfer(params.recipient, amountBigInt);
            }

            // Execute multisig transaction (will prompt for 2 chip scans)
            const result = await multisigService.executeMultisigTransaction(
                selectedAccount,
                params.recipient,
                value,
                data,
                params.chainId
            );

            if (result.success) {
                showSuccessMessage('Transfer successful!', result.transactionHash, params.chainId);
                await loadUnifiedBalances();
                state.showSendScreen = false;
                render();
            } else {
                throw new Error(result.error || 'Multisig transfer failed');
            }
            return;
        }

        if (isNative && isHaloChipAccount) {
            const result = await handleHaloETHTransfer({
                amount: params.amount,
                recipient: params.recipient,
                chainId: params.chainId,
            });

            if (result.success) {
                showSuccessMessage('Transfer successful!', result.transactionHash, params.chainId);
                await loadUnifiedBalances();
                state.showSendScreen = false;
                render();
            } else {
                throw new Error(result.error || 'Transfer failed');
            }
        } else if (isNative) {
            // Check if chain is supported by Nexus SDK (Zircuit and others may not be)
            // For unsupported chains, fall back to direct ETH transfer
            const unsupportedChains = [48900]; // Zircuit
            const useDirectTransfer = unsupportedChains.includes(params.chainId);

            if (useDirectTransfer) {
                // Use direct ETH transfer for unsupported chains
                const result = await handleDirectETHTransfer(params, context);
                if (result.success) {
                    showSuccessMessage('Transfer successful!', result.transactionHash, params.chainId);
                    await loadUnifiedBalances();
                    state.showSendScreen = false;
                    render();
                } else {
                    throw new Error(result.error || 'Transfer failed');
                }
            } else {
                // Use Nexus SDK for supported chains
                const result = await transferService.transfer({
                    token: params.token,
                    amount: params.amount,
                    chainId: params.chainId,
                    recipient: params.recipient as `0x${string}`,
                    sourceChains: params.sourceChains,
                });

                if (result.success) {
                    showSuccessMessage('Transfer successful!', result.transactionHash, params.chainId);
                    await loadUnifiedBalances();
                    state.showSendScreen = false;
                    render();
                } else {
                    throw new Error(result.error || 'Transfer failed');
                }
            }
        } else {
            // ERC20 token transfer
            const result = await handleERC20Transfer(params, context);
            if (result.success) {
                showSuccessMessage('Transfer successful!', result.transactionHash, params.chainId);
                await loadUnifiedBalances();
                state.showSendScreen = false;
                render();
            } else {
                throw new Error(result.error || 'Transfer failed');
            }
        }
    } catch (error: any) {
        console.error('[PopupApp] Transfer error:', error);
        throw error;
    }
}

async function handleDirectETHTransfer(
    params: { amount: string; recipient: string; chainId: number },
    context: TransferContext
): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    const { walletService } = context;
    
    try {
        const selectedAccount = await walletService.getSelectedAccount();
        if (!selectedAccount) {
            throw new Error('No account selected');
        }

        const ethersModule = await loadEthers();
        const ethers = ethersModule.ethers || ethersModule.default || ethersModule;

        const networks = await walletService.getNetworks();
        const network = networks.find(n => n.chainId === params.chainId) || networks[0];
        if (!network || !network.rpcUrl) {
            throw new Error(`Network not found for chainId ${params.chainId}`);
        }
        const provider = new ethers.JsonRpcProvider(network.rpcUrl);

        const value = ethers.parseEther(params.amount);

        const transaction = {
            to: params.recipient,
            value: value.toString(),
            chainId: params.chainId,
        };

        let gasLimit: bigint;
        try {
            const estimatedGas = await provider.estimateGas({
                ...transaction,
                from: selectedAccount.address,
            });
            gasLimit = (estimatedGas * BigInt(120)) / BigInt(100);
        } catch (error) {
            console.warn('[handleDirectETHTransfer] Gas estimation failed, using default:', error);
            gasLimit = BigInt(21000);
        }

        const feeData = await provider.getFeeData();
        const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice;
        const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || undefined;
        const nonce = await provider.getTransactionCount(selectedAccount.address, 'pending');

        const finalTransaction: any = {
            ...transaction,
            gasLimit: gasLimit,
            maxFeePerGas: maxFeePerGas,
            maxPriorityFeePerGas: maxPriorityFeePerGas,
            nonce: nonce,
            type: maxFeePerGas ? 2 : 0,
        };

        const response = await chrome.runtime.sendMessage({
            type: 'SEND_TRANSACTION',
            transaction: {
                to: finalTransaction.to,
                value: finalTransaction.value,
                data: '0x',
                gasLimit: finalTransaction.gasLimit.toString(),
                maxFeePerGas: finalTransaction.maxFeePerGas?.toString(),
                maxPriorityFeePerGas: finalTransaction.maxPriorityFeePerGas?.toString(),
                chainId: finalTransaction.chainId,
            },
            address: selectedAccount.address,
        });

        if (chrome.runtime.lastError) {
            throw new Error(chrome.runtime.lastError.message);
        }

        if (response?.success && response?.transactionHash) {
            return {
                success: true,
                transactionHash: response.transactionHash,
            };
        } else {
            throw new Error(response?.error || 'Transaction failed');
        }
    } catch (error: any) {
        console.error('[PopupApp] Direct ETH transfer error:', error);
        return {
            success: false,
            error: error.message || 'Direct ETH transfer failed',
        };
    }
}

async function handleERC20Transfer(
    params: { token: string; amount: string; recipient: string; chainId: number },
    context: TransferContext
): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    const { state, walletService } = context;
    
    try {
        const asset = state.unifiedBalanceData?.assets.find(a => a.symbol === params.token);
        if (!asset) {
            throw new Error(`Token ${params.token} not found in balance`);
        }

        let tokenContractAddress: string | null = null;
        if ((asset as any).contractAddress) {
            tokenContractAddress = (asset as any).contractAddress;
        } else if ((asset as any).address) {
            tokenContractAddress = (asset as any).address;
        } else {
            tokenContractAddress = getTokenContractAddress(params.token, params.chainId);
        }

        if (!tokenContractAddress) {
            throw new Error(`Token contract address not found for ${params.token} on chain ${params.chainId}`);
        }

        const decimals = (asset as any).decimals || 18;
        const ethersModule = await loadEthers();
        const ethers = ethersModule.ethers || ethersModule.default || ethersModule;
        const amountBigInt = ethers.parseUnits(params.amount, decimals);
        const data = encodeERC20Transfer(params.recipient, amountBigInt);

        const selectedAccount = await walletService.getSelectedAccount();
        if (!selectedAccount) {
            throw new Error('No account selected');
        }

        const networks = await walletService.getNetworks();
        const network = networks.find(n => n.chainId === params.chainId) || networks[0];
        if (!network || !network.rpcUrl) {
            throw new Error(`Network not found for chainId ${params.chainId}`);
        }
        const provider = new ethers.JsonRpcProvider(network.rpcUrl);

        const transaction = {
            to: tokenContractAddress,
            value: '0x0',
            data: data,
            chainId: params.chainId,
        };

        let gasLimit: bigint;
        try {
            const estimatedGas = await provider.estimateGas({
                ...transaction,
                from: selectedAccount.address,
            });
            gasLimit = (estimatedGas * BigInt(120)) / BigInt(100);
        } catch (error) {
            console.warn('[handleERC20Transfer] Gas estimation failed, using default:', error);
            gasLimit = BigInt(65000);
        }

        const feeData = await provider.getFeeData();
        const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice;
        const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || undefined;

        const finalTransaction: any = {
            ...transaction,
            gasLimit: gasLimit,
            maxFeePerGas: maxFeePerGas,
            maxPriorityFeePerGas: maxPriorityFeePerGas,
        };

        const response = await chrome.runtime.sendMessage({
            type: 'SEND_TRANSACTION',
            transaction: {
                to: finalTransaction.to,
                value: finalTransaction.value,
                data: finalTransaction.data,
                gasLimit: finalTransaction.gasLimit.toString(),
                maxFeePerGas: finalTransaction.maxFeePerGas?.toString(),
                maxPriorityFeePerGas: finalTransaction.maxPriorityFeePerGas?.toString(),
                chainId: finalTransaction.chainId,
            },
            address: selectedAccount.address,
        });

        if (chrome.runtime.lastError) {
            throw new Error(chrome.runtime.lastError.message);
        }

        if (response?.success && response?.transactionHash) {
            return {
                success: true,
                transactionHash: response.transactionHash,
            };
        } else {
            throw new Error(response?.error || 'Transaction failed');
        }
    } catch (error: any) {
        console.error('[PopupApp] ERC20 transfer error:', error);
        return {
            success: false,
            error: error.message || 'ERC20 transfer failed',
        };
    }
}

