import { ethers } from 'ethers';
import type { Wallet } from '../../core/wallet.js';

export async function handleApproveTransaction(
    message: any,
    wallet: Wallet,
    safeSendResponse: (response: any) => void
): Promise<void> {
    try {
        const requestId = message.requestId;
        const storage = await chrome.storage.local.get('pendingTransaction');
        const pendingTransaction = storage.pendingTransaction;

        if (!pendingTransaction || pendingTransaction.id !== requestId) {
            safeSendResponse({ success: false, error: 'Transaction request not found' });
            return;
        }

        const account = wallet.getAccounts().find(
            acc => acc.address.toLowerCase() === pendingTransaction.address.toLowerCase()
        );
        if (!account) {
            safeSendResponse({ success: false, error: 'Account not found' });
            return;
        }

        const txParams = message.transaction || pendingTransaction.transaction;
        const chainId = txParams.chainId || 1;

        const { rpcService } = await import('../../core/rpc-service.js');
        const rpcUrl = rpcService.getRPCUrl(chainId);
        const provider = new ethers.JsonRpcProvider(rpcUrl);

        const isContractInteraction = txParams.data &&
            txParams.data !== '0x' &&
            txParams.data !== '0x0' &&
            txParams.data.length > 2;

        const transaction: any = {
            from: account.address,
            to: txParams.to,
            value: txParams.value ? BigInt(txParams.value) : undefined,
            data: txParams.data || '0x',
            gasLimit: txParams.gasLimit ? BigInt(txParams.gasLimit) : undefined,
            gasPrice: txParams.gasPrice ? BigInt(txParams.gasPrice) : undefined,
            maxFeePerGas: txParams.maxFeePerGas ? BigInt(txParams.maxFeePerGas) : undefined,
            maxPriorityFeePerGas: txParams.maxPriorityFeePerGas ? BigInt(txParams.maxPriorityFeePerGas) : undefined,
            nonce: txParams.nonce,
            chainId: txParams.chainId,
            type: txParams.type,
        };

        let signedTx: string;
        if (account.isChipAccount && account.chipInfo) {
            const { HaloSigner } = await import('../../halo/halo-signer.js');
            const haloSigner = new HaloSigner(account.address, account.chipInfo.slot, provider);
            signedTx = await haloSigner.signTransaction(transaction);
        } else {
            const privateKey = await wallet.getPrivateKey(account.address);
            if (!privateKey) {
                throw new Error('Private key not found');
            }
            const signerWallet = new ethers.Wallet(privateKey, provider);

            let populatedTx = await signerWallet.populateTransaction(transaction);

            if (isContractInteraction) {
                const MIN_CONTRACT_GAS = BigInt(1000000);
                const currentGas = populatedTx.gasLimit ? BigInt(populatedTx.gasLimit.toString()) : BigInt(0);

                if (currentGas < MIN_CONTRACT_GAS) {
                    console.log(`[APPROVE_TRANSACTION] Contract interaction detected. Setting minimum gas limit: ${MIN_CONTRACT_GAS} (was: ${currentGas})`);
                    populatedTx.gasLimit = MIN_CONTRACT_GAS;
                } else if (txParams.gasLimit) {
                    const userGas = BigInt(txParams.gasLimit);
                    if (userGas < MIN_CONTRACT_GAS) {
                        console.log(`[APPROVE_TRANSACTION] User gas limit ${userGas} below minimum ${MIN_CONTRACT_GAS}, using minimum`);
                        populatedTx.gasLimit = MIN_CONTRACT_GAS;
                    } else {
                        populatedTx.gasLimit = userGas;
                    }
                }
            } else if (txParams.gasLimit) {
                populatedTx.gasLimit = BigInt(txParams.gasLimit);
            }

            signedTx = await signerWallet.signTransaction(populatedTx);
        }

        const txResponse = await provider.broadcastTransaction(signedTx);
        const tx = ethers.Transaction.from(signedTx);
        const txHash = tx.hash || (typeof txResponse === 'string' ? txResponse : txResponse?.hash);

        const convertBigInt = (val: any): string | undefined => {
            if (val === null || val === undefined) return undefined;
            if (typeof val === 'bigint') return '0x' + val.toString(16);
            return String(val);
        };

        const convertNumber = (val: any): number | undefined => {
            if (val === null || val === undefined) return undefined;
            return Number(val);
        };

        const txResponseObject = {
            hash: txHash,
            from: account.address,
            to: tx.to || null,
            value: tx.value ? convertBigInt(tx.value) || '0x0' : '0x0',
            data: tx.data || '0x',
            gasLimit: convertBigInt(tx.gasLimit),
            gasPrice: convertBigInt(tx.gasPrice),
            maxFeePerGas: convertBigInt(tx.maxFeePerGas),
            maxPriorityFeePerGas: convertBigInt(tx.maxPriorityFeePerGas),
            nonce: convertNumber(tx.nonce),
            chainId: convertNumber(tx.chainId),
            type: convertNumber(tx.type),
        };

        await chrome.storage.local.set({ pendingTransaction: null });

        if (pendingTransaction.tabId) {
            try {
                await chrome.tabs.sendMessage(pendingTransaction.tabId, {
                    type: 'TRANSACTION_APPROVED',
                    requestId: requestId,
                    transactionHash: txHash,
                    transaction: txResponseObject,
                });
            } catch (error) {
                console.error('[APPROVE_TRANSACTION] Error sending to content script:', error);
            }
        }

        safeSendResponse({
            success: true,
            transactionHash: txHash,
            transaction: txResponseObject,
        });
    } catch (error: any) {
        console.error('[APPROVE_TRANSACTION] Error:', error);
        safeSendResponse({ success: false, error: error.message });
    }
}

export async function handleRejectTransaction(
    message: any,
    safeSendResponse: (response: any) => void
): Promise<void> {
    try {
        const requestId = message.requestId;
        const storage = await chrome.storage.local.get('pendingTransaction');
        const pendingTransaction = storage.pendingTransaction;

        if (!pendingTransaction || pendingTransaction.id !== requestId) {
            safeSendResponse({ success: false, error: 'Transaction request not found' });
            return;
        }

        await chrome.storage.local.set({ pendingTransaction: null });

        if (pendingTransaction.tabId) {
            try {
                await chrome.tabs.sendMessage(pendingTransaction.tabId, {
                    type: 'TRANSACTION_REJECTED',
                    requestId: requestId,
                });
            } catch (error) {
                console.error('[REJECT_TRANSACTION] Error sending to content script:', error);
            }
        }

        safeSendResponse({ success: true });
    } catch (error: any) {
        console.error('[REJECT_TRANSACTION] Error:', error);
        safeSendResponse({ success: false, error: error.message });
    }
}

