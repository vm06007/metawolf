export interface Account {
    address: string;
    name?: string;
    encrypted?: boolean;
    haloLinked?: boolean;
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

