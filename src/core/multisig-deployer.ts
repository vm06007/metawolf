import { ethers } from 'ethers';
import type { ChipInfo, MultisigConfig } from './types.js';

/**
 * Multisig Wallet Deployer
 * Deploys multisig contracts and handles transaction execution
 */

// Minimal Multisig Wallet ABI (simplified version)
const MULTISIG_ABI = [
    'function submitTransaction(address to, uint256 value, bytes calldata data) external returns (uint256)',
    'function confirmTransaction(uint256 txNonce) external',
    'function executeTransaction(uint256 txNonce) external',
    'function getOwners() external view returns (address[])',
    'function threshold() external view returns (uint256)',
    'function transactions(uint256) external view returns (address to, uint256 value, bytes memory data, bool executed, uint256 confirmations)',
    'function isConfirmedBy(uint256 txNonce, address owner) external view returns (bool)',
    'event TransactionExecuted(address indexed to, uint256 value, bytes data)',
];

// Factory ABI (for CREATE2 deterministic addresses)
const FACTORY_ABI = [
    'function createMultisig(address[] calldata owners, uint256 threshold, bytes32 salt) external returns (address)',
    'function computeAddress(address[] calldata owners, uint256 threshold, bytes32 salt) external view returns (address)',
    'event MultisigCreated(address indexed multisig, address[] owners, uint256 threshold)',
];

/**
 * Compute deterministic address for multisig wallet
 * Uses CREATE2 pattern with a factory contract
 */
export function computeMultisigAddress(
    factoryAddress: string,
    owners: string[],
    threshold: number,
    salt: string
): string {
    // Normalize owners addresses
    const normalizedOwners = owners.map(addr => addr.toLowerCase()).sort();

    // Create salt from chip addresses + threshold
    const saltBytes = ethers.keccak256(
        ethers.toUtf8Bytes(normalizedOwners.join('') + threshold.toString() + salt)
    );

    // In a real implementation, this would use CREATE2 with actual contract bytecode
    // For now, we'll use a deterministic hash
    const addressHash = ethers.keccak256(
        ethers.concat([
            ethers.toUtf8Bytes('multisig'),
            ethers.getAddress(factoryAddress),
            saltBytes,
            ethers.toUtf8Bytes(normalizedOwners.join('') + threshold.toString()),
        ])
    );

    // Convert to address (last 20 bytes)
    return ethers.getAddress('0x' + addressHash.slice(26));
}

/**
 * Deploy multisig wallet contract
 * NOTE: This requires one of the chips to sign the deployment transaction
 */
export async function deployMultisig(
    provider: ethers.Provider,
    signer: ethers.Signer,
    factoryAddress: string,
    owners: string[],
    threshold: number
): Promise<{ address: string; txHash: string }> {
    const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, signer);

    // Create salt for deterministic address
    const salt = ethers.keccak256(
        ethers.toUtf8Bytes(owners.join('') + threshold.toString() + Date.now().toString())
    );

    // Deploy via factory
    const tx = await factory.createMultisig(owners, threshold, salt);
    const receipt = await tx.wait();

    // Extract deployed address from event
    const event = receipt.logs.find((log: any) => {
        try {
            const parsed = factory.interface.parseLog(log);
            return parsed?.name === 'MultisigCreated';
        } catch {
            return false;
        }
    });

    if (!event) {
        throw new Error('Failed to find MultisigCreated event');
    }

    const parsedEvent = factory.interface.parseLog(event);
    const multisigAddress = parsedEvent?.args[0];

    return {
        address: multisigAddress,
        txHash: receipt.hash,
    };
}

/**
 * Submit and execute transaction on multisig wallet
 */
export async function executeMultisigTransaction(
    provider: ethers.Provider,
    multisigAddress: string,
    chipSigners: Array<{ address: string; signer: ethers.Signer }>,
    to: string,
    value: bigint,
    data: string,
    threshold: number
): Promise<string> {
    const multisig = new ethers.Contract(multisigAddress, MULTISIG_ABI, chipSigners[0].signer);

    // Submit transaction (requires one signature)
    const submitTx = await multisig.submitTransaction(to, value, data);
    await submitTx.wait();

    // Get transaction nonce (from event or state)
    const txNonce = await provider.getTransactionCount(multisigAddress);

    // Collect confirmations from required chips
    const confirmations = chipSigners.slice(0, threshold);
    for (const { signer } of confirmations) {
        const multisigWithSigner = new ethers.Contract(multisigAddress, MULTISIG_ABI, signer);
        const confirmTx = await multisigWithSigner.confirmTransaction(txNonce);
        await confirmTx.wait();
    }

    // Transaction should auto-execute when threshold is met
    // If not, manually execute
    const multisigFinal = new ethers.Contract(multisigAddress, MULTISIG_ABI, chipSigners[0].signer);
    const executeTx = await multisigFinal.executeTransaction(txNonce);
    const receipt = await executeTx.wait();

    return receipt.hash;
}

/**
 * Check if multisig is deployed
 */
export async function isMultisigDeployed(
    provider: ethers.Provider,
    address: string
): Promise<boolean> {
    try {
        const code = await provider.getCode(address);
        return code !== '0x' && code.length > 2;
    } catch {
        return false;
    }
}
