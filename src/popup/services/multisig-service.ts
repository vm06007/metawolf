import { sendMessageWithRetry } from '../utils/messaging';
import { loadEthers } from '../ethers-loader';
import { HaloService } from './halo-service';

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
        factoryAddress: string,
        chainId: number
    ): Promise<{ address: string; txHash: string }> {
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

        // Get gas price and estimate gas
        const feeData = await provider.getFeeData();
        const gasEstimate = await provider.estimateGas({
            to: factoryAddress,
            data: data,
            from: firstChip.address,
        });

        const transaction = {
            to: factoryAddress,
            data: data,
            value: '0x0',
            gasLimit: (gasEstimate * BigInt(120)) / BigInt(100),
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

        // Wait for transaction receipt
        const receipt = await provider.waitForTransaction(sendResponse.transactionHash, 1);

        if (!receipt || receipt.status !== 1) {
            throw new Error('Deployment transaction failed');
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
            throw new Error('Failed to find MultisigCreated event');
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

        return {
            address: deployedAddress,
            txHash: receipt.hash,
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
        const submitData = multisigContract.interface.encodeFunctionData('submitTransaction', [to, value, data]);

        // Estimate gas for submit
        const submitGasEstimate = await provider.estimateGas({
            to: multisigAddress,
            data: submitData,
            from: firstChip.address,
        });

        const feeData = await provider.getFeeData();
        const submitTransaction = {
            to: multisigAddress,
            data: submitData,
            value: '0x0',
            gasLimit: (submitGasEstimate * BigInt(120)) / BigInt(100),
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
        // The submitTransaction function returns the nonce, but we need to get it from the contract
        const multisigInterface = new ethers.Interface(MULTISIG_ABI);
        const multisig = new ethers.Contract(multisigAddress, MULTISIG_ABI, provider);
        
        // Get the current nonce (which is the transaction nonce we just submitted)
        // The nonce is incremented after submission, so we subtract 1
        const currentNonce = await multisig.nonce();
        const txNonce = Number(currentNonce) - 1;

        // Step 2: Confirm transaction with second chip (if threshold > 1)
        if (threshold > 1 && account.multisig.chips.length >= 2) {
            const secondChip = account.multisig.chips[1];
            const confirmData = multisigContract.interface.encodeFunctionData('confirmTransaction', [txNonce]);

            const confirmGasEstimate = await provider.estimateGas({
                to: multisigAddress,
                data: confirmData,
                from: secondChip.address,
            });

            const confirmTransaction = {
                to: multisigAddress,
                data: confirmData,
                value: '0x0',
                gasLimit: (confirmGasEstimate * BigInt(120)) / BigInt(100),
                maxFeePerGas: feeData.maxFeePerGas?.toString(),
                maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
                chainId: chainId,
                nonce: await provider.getTransactionCount(secondChip.address, 'pending'),
            };

            // Sign confirm transaction with second chip
            const confirmSignResponse = await chrome.runtime.sendMessage({
                type: 'SIGN_MULTISIG_TRANSACTION',
                transaction: confirmTransaction,
                chipAddress: secondChip.address,
                chipPublicKey: secondChip.publicKey,
                slot: secondChip.slot || 1,
                step: 'confirm',
            });

            if (!confirmSignResponse || !confirmSignResponse.success) {
                throw new Error(confirmSignResponse?.error || 'Failed to sign confirm transaction');
            }

            // Send confirm transaction
            const confirmSendResponse = await chrome.runtime.sendMessage({
                type: 'SEND_SIGNED_TRANSACTION',
                signedTransaction: confirmSignResponse.signedTransaction,
            });

            if (!confirmSendResponse || !confirmSendResponse.success) {
                throw new Error(confirmSendResponse?.error || 'Failed to send confirm transaction');
            }

            // Wait for confirm transaction to be mined
            const confirmReceipt = await provider.waitForTransaction(confirmSendResponse.transactionHash, 1);
            if (!confirmReceipt || confirmReceipt.status !== 1) {
                throw new Error('Confirm transaction failed');
            }

            // Transaction should auto-execute when threshold is met
            // Check if it was executed
            const txInfo = await multisig.transactions(txNonce);
            if (txInfo.executed) {
                // Find the execution transaction hash from logs
                const executionEvent = confirmReceipt.logs.find((log: any) => {
                    try {
                        const parsed = multisigInterface.parseLog(log);
                        return parsed?.name === 'TransactionExecuted';
                    } catch {
                        return false;
                    }
                });

                if (executionEvent) {
                    return {
                        success: true,
                        transactionHash: confirmReceipt.hash, // Use confirm receipt hash
                    };
                }
            }
        }

        // If threshold is 1 or transaction didn't auto-execute, manually execute
        const executeData = multisigContract.interface.encodeFunctionData('executeTransaction', [txNonce]);
        const executeGasEstimate = await provider.estimateGas({
            to: multisigAddress,
            data: executeData,
            from: firstChip.address,
        });

        const executeTransaction = {
            to: multisigAddress,
            data: executeData,
            value: '0x0',
            gasLimit: (executeGasEstimate * BigInt(120)) / BigInt(100),
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

