export interface ChipInfo {
    address: string;
    publicKey: string;
    slot: number;
    name?: string;
    linkedAt: number;
}

export interface MultisigConfig {
    threshold: number; // Number of signatures required (e.g., 2 of 3)
    chips: ChipInfo[]; // Array of chips that can sign
    smartAccountAddress?: string; // Deployed smart contract address
    deployed?: boolean; // Whether the contract is deployed on-chain
    deploymentTxHash?: string; // Transaction hash of deployment
}

export interface Account {
    address: string; // For single chip: chip address. For multisig: smart account address
    name?: string;
    encrypted?: boolean;
    haloLinked?: boolean;
    // Chip-centric fields
    isChipAccount?: boolean; // True if account is directly from chip
    chipInfo?: ChipInfo; // Info for single chip account
    multisig?: MultisigConfig; // Configuration for multisig account
    // View-only/watch-only address
    isWatchOnly?: boolean; // True if this is a view-only address (no private key, cannot sign)
}

export interface Transaction {
    to?: string;
    from?: string;
    value?: string;
    data?: string;
    gasLimit?: string;
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    nonce?: number;
    chainId?: number;
    type?: number;
}

export interface EIP7702Transaction extends Transaction {
    type: 2; // EIP-1559 style but with delegation
    delegatedCode?: {
        address: string;
        codeHash: string;
    };
}

export interface EIP5742Batch {
    transactions: Transaction[];
    gasLimit: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
}

export interface SignedTransaction {
    rawTransaction: string;
    transaction: Transaction;
}

export interface WalletState {
    accounts: Account[];
    selectedAccount?: string;
    networks: NetworkConfig[];
    selectedNetwork: number;
    unlocked: boolean;
}

export interface NetworkConfig {
    chainId: number;
    name: string;
    rpcUrl: string;
    blockExplorer?: string;
    currency: {
        name: string;
        symbol: string;
        decimals: number;
    };
}

export interface HaloKeyInfo {
    slot: number;
    publicKey: string;
    address: string;
    name?: string;
}

