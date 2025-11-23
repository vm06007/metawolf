import { sendMessageWithRetry } from '../utils/messaging';
import { loadEthers } from '../ethers-loader';
import { HaloService } from './halo-service';
import { getMultisigFactoryAddress } from '../../core/multisig-config.js';

const FACTORY_ABI = [
    'function createMultisig(address[] calldata owners, uint256 threshold, bytes32 salt) external returns (address)',
    'function computeAddress(address[] calldata owners, uint256 threshold, bytes32 salt) external view returns (address)',
    'event MultisigCreated(address indexed multisig, address[] owners, uint256 threshold)',
];

const MULTISIG_ABI = [
    'function submitTransaction(address to, uint256 value, bytes calldata data) external returns (uint256)',
    'function confirmTransaction(uint256 txNonce) external',
    'function executeTransaction(uint256 txNonce) external',
    'function getOwners() external view returns (address[])',
    'function threshold() external view returns (uint256)',
    'function transactions(uint256) external view returns (address to, uint256 value, bytes data, bool executed, uint256 confirmations)',
    'function isConfirmedBy(uint256 txNonce, address owner) external view returns (bool)',
    'event TransactionExecuted(address indexed to, uint256 value, bytes data)',
];

export class MultisigService {
    private haloService: HaloService;

    constructor() {
        this.haloService = new HaloService();
    }

    /**
     * Deploy multisig contract using 2 Halo chips
     * First chip signs the deployment transaction
     */
    async deployMultisig(
        account: any,
        factoryAddress: string | null,
        chainId: number
    ): Promise<{ address: string; txHash: string }> {
        // Get factory address if not provided
        if (!factoryAddress) {
            factoryAddress = getMultisigFactoryAddress(chainId);
        }
        if (!account.multisig || account.multisig.chips.length < 2) {
            throw new Error('Multisig account requires at least 2 chips');
        }

        const chips = account.multisig.chips;
        const threshold = account.multisig.threshold;

        // Get network RPC URL
        const networks = await chrome.runtime.sendMessage({ type: 'GET_NETWORKS' });
        const network = networks.find((n: any) => n.chainId === chainId);
        if (!network || !network.rpcUrl) {
            throw new Error(`Network not found for chainId ${chainId}`);
        }

        const ethersModule = await loadEthers();
        const ethers = ethersModule.ethers || ethersModule.default || ethersModule;
        const provider = new ethers.JsonRpcProvider(network.rpcUrl);

        // Normalize and sort owner addresses
        const owners = chips.map((c: any) => ethers.getAddress(c.address)).sort();

        // Create salt for deterministic address
        const salt = ethers.keccak256(
            ethers.toUtf8Bytes(owners.join('') + threshold.toString() + account.address.toLowerCase())
        );

        // Compute expected address
        const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, provider);
        const expectedAddress = await factory.computeAddress(owners, threshold, salt);

        // Use first chip to sign deployment transaction
        const firstChip = chips[0];
        
        // Build deployment transaction
        const factoryContract = new ethers.Contract(factoryAddress, FACTORY_ABI);
        const data = factoryContract.interface.encodeFunctionData('createMultisig', [owners, threshold, salt]);

        // Get gas price (use hardcoded gas limit instead of estimation)
        const feeData = await provider.getFeeData();

        // Use hardcoded gas limit of 4,000,000
        const gasLimit = BigInt(4000000);
        console.log('[MultisigService] Using hardcoded gas limit for deployment:', gasLimit.toString());

        const transaction = {
            to: factoryAddress,
            data: data,
            value: '0x0',
            gasLimit: gasLimit,
            maxFeePerGas: feeData.maxFeePerGas?.toString(),
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
            chainId: chainId,
            nonce: await provider.getTransactionCount(firstChip.address, 'pending'),
        };

        // Sign with first chip via background script
        const signResponse = await chrome.runtime.sendMessage({
            type: 'SIGN_MULTISIG_DEPLOYMENT',
            transaction: transaction,
            chipAddress: firstChip.address,
            chipPublicKey: firstChip.publicKey,
            slot: firstChip.slot || 1,
        });

        if (!signResponse || !signResponse.success) {
            throw new Error(signResponse?.error || 'Failed to sign deployment transaction');
        }

        // Send transaction
        const sendResponse = await chrome.runtime.sendMessage({
            type: 'SEND_SIGNED_TRANSACTION',
            signedTransaction: signResponse.signedTransaction,
        });

        if (!sendResponse || !sendResponse.success) {
            throw new Error(sendResponse?.error || 'Failed to send deployment transaction');
        }

        const transactionHash = sendResponse.transactionHash;

        // Return transaction hash immediately, then wait for confirmation in background
        // This allows UI to show the transaction right away
        (async () => {
            try {
                // Wait for transaction receipt in background
                const receipt = await provider.waitForTransaction(transactionHash, 1);

                if (!receipt || receipt.status !== 1) {
                    console.error('[MultisigService] Deployment transaction failed:', transactionHash);
                    return;
                }

                // Extract deployed address from event
                const factoryInterface = new ethers.Interface(FACTORY_ABI);
                const event = receipt.logs.find((log: any) => {
                    try {
                        const parsed = factoryInterface.parseLog(log);
                        return parsed?.name === 'MultisigCreated';
                    } catch {
                        return false;
                    }
                });

                if (!event) {
                    console.error('[MultisigService] Failed to find MultisigCreated event');
                    return;
                }

                const parsedEvent = factoryInterface.parseLog(event);
                const deployedAddress = parsedEvent?.args[0];

                // Update account to mark as deployed
                await chrome.runtime.sendMessage({
                    type: 'UPDATE_MULTISIG_DEPLOYED',
                    address: account.address,
                    deployedAddress: deployedAddress,
                    chainId: chainId,
                });
            } catch (error) {
                console.error('[MultisigService] Error waiting for deployment confirmation:', error);
            }
        })();

        // Return immediately with transaction hash (address will be updated later)
        return {
            address: expectedAddress, // Use computed address (will be confirmed when mined)
            txHash: transactionHash,
        };
    }

    /**
     * Execute a transaction from multisig account
     * Requires scanning 2 Halo chips to sign
     */
    async executeMultisigTransaction(
        account: any,
        to: string,
        value: string,
        data: string,
        chainId: number
    ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
        if (!account.multisig || account.multisig.chips.length < 2) {
            throw new Error('Multisig account requires at least 2 chips');
        }

        if (!account.multisig.deployed || !account.multisig.deployedAddress) {
            throw new Error('Multisig contract not deployed. Please deploy it first.');
        }

        const threshold = account.multisig.threshold;
        const multisigAddress = account.multisig.deployedAddress;

        // Get network RPC URL
        const networks = await chrome.runtime.sendMessage({ type: 'GET_NETWORKS' });
        const network = networks.find((n: any) => n.chainId === chainId);
        if (!network || !network.rpcUrl) {
            throw new Error(`Network not found for chainId ${chainId}`);
        }

        const ethersModule = await loadEthers();
        const ethers = ethersModule.ethers || ethersModule.default || ethersModule;
        const provider = new ethers.JsonRpcProvider(network.rpcUrl);

        // Step 1: Submit transaction (requires 1 signature)
        const firstChip = account.multisig.chips[0];
        const multisigContract = new ethers.Contract(multisigAddress, MULTISIG_ABI);
        
        // Normalize value to bigint
        // Value can be: hex string (0x...), decimal string (wei), or bigint
        let valueBigInt: bigint;
        if (typeof value === 'string') {
            if (value.startsWith('0x')) {
                valueBigInt = ethers.getBigInt(value);
            } else {
                // Assume it's already in wei (decimal string)
                valueBigInt = BigInt(value);
            }
        } else {
            valueBigInt = BigInt(value);
        }
        
        const submitData = multisigContract.interface.encodeFunctionData('submitTransaction', [
            to, 
            valueBigInt, 
            data
        ]);

        // Use hardcoded gas limit for submit transaction
        const submitGasLimit = BigInt(500000); // 500k should be enough for submit
        console.log('[MultisigService] Using hardcoded gas limit for submit:', submitGasLimit.toString());

        const feeData = await provider.getFeeData();
        const submitTransaction = {
            to: multisigAddress,
            data: submitData,
            value: '0x0',
            gasLimit: submitGasLimit,
            maxFeePerGas: feeData.maxFeePerGas?.toString(),
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
            chainId: chainId,
            nonce: await provider.getTransactionCount(firstChip.address, 'pending'),
        };

        // Sign submit transaction with first chip
        const submitSignResponse = await chrome.runtime.sendMessage({
            type: 'SIGN_MULTISIG_TRANSACTION',
            transaction: submitTransaction,
            chipAddress: firstChip.address,
            chipPublicKey: firstChip.publicKey,
            slot: firstChip.slot || 1,
            step: 'submit',
        });

        if (!submitSignResponse || !submitSignResponse.success) {
            throw new Error(submitSignResponse?.error || 'Failed to sign submit transaction');
        }

        // Send submit transaction
        const submitSendResponse = await chrome.runtime.sendMessage({
            type: 'SEND_SIGNED_TRANSACTION',
            signedTransaction: submitSignResponse.signedTransaction,
        });

        if (!submitSendResponse || !submitSendResponse.success) {
            throw new Error(submitSendResponse?.error || 'Failed to send submit transaction');
        }

        // Wait for submit transaction to be mined
        const submitReceipt = await provider.waitForTransaction(submitSendResponse.transactionHash, 1);
        if (!submitReceipt || submitReceipt.status !== 1) {
            throw new Error('Submit transaction failed');
        }

        // Get transaction nonce from contract state
        // The submitTransaction function does: uint256 txNonce = nonce++;
        // This means it uses the current nonce value, then increments it
        // So after submission, the contract's nonce is (txNonce + 1)
        const multisig = new ethers.Contract(multisigAddress, MULTISIG_ABI, provider);
        const currentNonce = await multisig.nonce();
        const txNonce = Number(currentNonce) - 1;
        
        // Verify the transaction exists
        const txInfo = await multisig.transactions(txNonce);
        if (!txInfo || txInfo.to === ethers.ZeroAddress) {
            throw new Error('Failed to retrieve transaction nonce after submission');
        }

        // Check current confirmation count
        // Note: submitTransaction already calls confirmTransaction internally, so we have 1 confirmation
        const currentConfirmations = Number(txInfo.confirmations);
        
        // Step 2: Collect additional confirmations if needed
        // We need (threshold - 1) more confirmations since submitTransaction already confirmed once
        const confirmationsNeeded = threshold - currentConfirmations;
        
        if (confirmationsNeeded > 0) {
            // Collect confirmations from additional chips
            // Start from chip index 1 (chip 0 already submitted)
            for (let i = 1; i < account.multisig.chips.length && i <= confirmationsNeeded; i++) {
                const chip = account.multisig.chips[i];
                const confirmData = multisigContract.interface.encodeFunctionData('confirmTransaction', [txNonce]);

                // Use hardcoded gas limit for confirm transaction
                const confirmGasLimit = BigInt(200000); // 200k should be enough for confirm
                console.log(`[MultisigService] Using hardcoded gas limit for confirm (chip ${i}):`, confirmGasLimit.toString());

                const confirmTransaction = {
                    to: multisigAddress,
                    data: confirmData,
                    value: '0x0',
                    gasLimit: confirmGasLimit,
                    maxFeePerGas: feeData.maxFeePerGas?.toString(),
                    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
                    chainId: chainId,
                    nonce: await provider.getTransactionCount(chip.address, 'pending'),
                };

                // Sign confirm transaction with chip
                const confirmSignResponse = await chrome.runtime.sendMessage({
                    type: 'SIGN_MULTISIG_TRANSACTION',
                    transaction: confirmTransaction,
                    chipAddress: chip.address,
                    chipPublicKey: chip.publicKey,
                    slot: chip.slot || 1,
                    step: `confirm-${i}`,
                });

                if (!confirmSignResponse || !confirmSignResponse.success) {
                    throw new Error(confirmSignResponse?.error || `Failed to sign confirm transaction with chip ${i + 1}`);
                }

                // Send confirm transaction
                const confirmSendResponse = await chrome.runtime.sendMessage({
                    type: 'SEND_SIGNED_TRANSACTION',
                    signedTransaction: confirmSignResponse.signedTransaction,
                });

                if (!confirmSendResponse || !confirmSendResponse.success) {
                    throw new Error(confirmSendResponse?.error || `Failed to send confirm transaction from chip ${i + 1}`);
                }

                // Wait for confirm transaction to be mined
                const confirmReceipt = await provider.waitForTransaction(confirmSendResponse.transactionHash, 1);
                if (!confirmReceipt || confirmReceipt.status !== 1) {
                    throw new Error(`Confirm transaction from chip ${i + 1} failed`);
                }

                // Check if transaction was auto-executed (contract executes when threshold is met)
                const updatedTxInfo = await multisig.transactions(txNonce);
                if (updatedTxInfo.executed) {
                    // Find the execution event in the receipt logs
                    const executionEvent = confirmReceipt.logs.find((log: any) => {
                        try {
                            const parsed = multisigInterface.parseLog(log);
                            return parsed?.name === 'TransactionExecuted';
                        } catch {
                            return false;
                        }
                    });

                    if (executionEvent) {
                        // Transaction was executed automatically by the contract
                        return {
                            success: true,
                            transactionHash: confirmReceipt.hash,
                        };
                    }
                }
            }
        }

        // Check if transaction was executed (should be if threshold was met)
        const finalTxInfo = await multisig.transactions(txNonce);
        if (finalTxInfo.executed) {
            // Transaction was executed, find the transaction hash from the last confirmation
            // We'll use the submit receipt hash as fallback
            return {
                success: true,
                transactionHash: submitReceipt.hash,
            };
        }

        // If threshold is 1, transaction should have been executed already
        // If not, manually execute (shouldn't happen, but handle edge case)
        const executeData = multisigContract.interface.encodeFunctionData('executeTransaction', [txNonce]);

        // Use hardcoded gas limit for execute transaction
        const executeGasLimit = BigInt(300000); // 300k should be enough for execute
        console.log('[MultisigService] Using hardcoded gas limit for execute:', executeGasLimit.toString());

        const executeTransaction = {
            to: multisigAddress,
            data: executeData,
            value: '0x0',
            gasLimit: executeGasLimit,
            maxFeePerGas: feeData.maxFeePerGas?.toString(),
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
            chainId: chainId,
            nonce: await provider.getTransactionCount(firstChip.address, 'pending'),
        };

        // Sign execute transaction with first chip
        const executeSignResponse = await chrome.runtime.sendMessage({
            type: 'SIGN_MULTISIG_TRANSACTION',
            transaction: executeTransaction,
            chipAddress: firstChip.address,
            chipPublicKey: firstChip.publicKey,
            slot: firstChip.slot || 1,
            step: 'execute',
        });

        if (!executeSignResponse || !executeSignResponse.success) {
            throw new Error(executeSignResponse?.error || 'Failed to sign execute transaction');
        }

        // Send execute transaction
        const executeSendResponse = await chrome.runtime.sendMessage({
            type: 'SEND_SIGNED_TRANSACTION',
            signedTransaction: executeSignResponse.signedTransaction,
        });

        if (!executeSendResponse || !executeSendResponse.success) {
            throw new Error(executeSendResponse?.error || 'Failed to send execute transaction');
        }

        return {
            success: true,
            transactionHash: executeSendResponse.transactionHash,
        };
    }
}

export const multisigService = new MultisigService();

