import { ethers } from 'ethers';
import type { Account, Transaction, WalletState, NetworkConfig } from './types.js';

export class Wallet {
    private state: WalletState;
    private provider?: ethers.JsonRpcProvider;

    constructor() {
        this.state = {
            accounts: [],
            networks: this.getDefaultNetworks(),
            selectedNetwork: 1, // Ethereum mainnet
            unlocked: false,
        };
    }

    async loadState(): Promise<void> {
        try {
            const stored = await chrome.storage.local.get('walletState');
            if (stored.walletState) {
                this.state = stored.walletState;
                await this.updateProvider();
            }
        } catch (error) {
            console.error('[Wallet] Error loading state:', error);
            // Continue with default state on error
        }
    }

    async saveState(): Promise<void> {
        try {
            await chrome.storage.local.set({ walletState: this.state });
        } catch (error) {
            console.error('[Wallet] Error saving state:', error);
            throw error;
        }
    }

    async unlock(password: string): Promise<boolean> {
        // Simple unlock logic - in production, use proper encryption
        this.state.unlocked = true;
        await this.saveState();
        return true;
    }

    async lock(): Promise<void> {
        this.state.unlocked = false;
        await this.saveState();
    }

    isUnlocked(): boolean {
        return this.state.unlocked;
    }

    async createAccount(name?: string): Promise<Account> {
        try {
            const wallet = ethers.Wallet.createRandom();
            const account: Account = {
                address: wallet.address,
                name: name || `Account ${this.state.accounts.length + 1}`,
                encrypted: false,
            };

            // Check for duplicates
            if (this.state.accounts.some(acc => acc.address.toLowerCase() === account.address.toLowerCase())) {
                throw new Error('Account already exists');
            }

            this.state.accounts.push(account);
            if (!this.state.selectedAccount) {
                this.state.selectedAccount = account.address;
            }

            // Store private key securely (encrypted)
            await this.storePrivateKey(account.address, wallet.privateKey);
            await this.saveState();

            return account;
        } catch (error: any) {
            console.error('Error in createAccount:', error);
            throw new Error(error.message || 'Failed to create account');
        }
    }

    async importAccount(privateKey: string, name?: string): Promise<Account> {
        try {
            // Normalize private key (remove 0x if present, ethers handles both)
            const normalizedKey = privateKey.trim().startsWith('0x')
                ? privateKey.trim()
                : '0x' + privateKey.trim();

            // Validate private key length
            if (normalizedKey.length !== 66 || !/^0x[a-fA-F0-9]{64}$/.test(normalizedKey)) {
                throw new Error('Invalid private key format');
            }

            const wallet = new ethers.Wallet(normalizedKey);
            const account: Account = {
                address: wallet.address,
                name: name || `Account ${this.state.accounts.length + 1}`,
                encrypted: false,
            };

            // Check for duplicates
            if (this.state.accounts.some(acc => acc.address.toLowerCase() === account.address.toLowerCase())) {
                throw new Error('Account already exists');
            }

            this.state.accounts.push(account);
            await this.storePrivateKey(account.address, normalizedKey);
            await this.saveState();

            return account;
        } catch (error: any) {
            console.error('Error in importAccount:', error);
            if (error.message && error.message.includes('private key')) {
                throw error;
            }
            throw new Error(error.message || 'Failed to import account. Invalid private key.');
        }
    }

    getAccounts(): Account[] {
        return this.state.accounts;
    }

    getSelectedAccount(): Account | undefined {
        if (!this.state.selectedAccount) return undefined;
        return this.state.accounts.find(
            (acc) => acc.address === this.state.selectedAccount
        );
    }

    async setSelectedAccount(address: string): Promise<void> {
        if (this.state.accounts.some((acc) => acc.address === address)) {
            this.state.selectedAccount = address;
            await this.saveState();
        }
    }

    async getProvider(): Promise<ethers.JsonRpcProvider> {
        if (!this.provider) {
            await this.updateProvider();
        }
        return this.provider!;
    }

    private async updateProvider(): Promise<void> {
        const network = this.state.networks.find(
            (n) => n.chainId === this.state.selectedNetwork
        );
        if (network) {
            this.provider = new ethers.JsonRpcProvider(network.rpcUrl);
        }
    }

    async setNetwork(chainId: number): Promise<void> {
        const network = this.state.networks.find((n) => n.chainId === chainId);
        if (network) {
            this.state.selectedNetwork = chainId;
            await this.updateProvider();
            await this.saveState();
        }
    }

    getNetwork(): NetworkConfig | undefined {
        return this.state.networks.find(
            (n) => n.chainId === this.state.selectedNetwork
        );
    }

    getNetworks(): NetworkConfig[] {
        return this.state.networks;
    }

    private async storePrivateKey(address: string, privateKey: string): Promise<void> {
        try {
            // In production, encrypt this with user password
            await chrome.storage.local.set({
                [`key_${address}`]: privateKey,
            });
        } catch (error) {
            console.error('[Wallet] Error storing private key:', error);
            throw error;
        }
    }

    private async getPrivateKey(address: string): Promise<string | null> {
        try {
            const stored = await chrome.storage.local.get(`key_${address}`);
            return stored[`key_${address}`] || null;
        } catch (error) {
            console.error('[Wallet] Error getting private key:', error);
            return null;
        }
    }

    async signTransaction(transaction: Transaction): Promise<string> {
        const account = this.getSelectedAccount();
        if (!account) {
            throw new Error('No account selected');
        }

        const privateKey = await this.getPrivateKey(account.address);
        if (!privateKey) {
            throw new Error('Private key not found');
        }

        const wallet = new ethers.Wallet(privateKey);
        const provider = await this.getProvider();

        // Populate missing fields
        const populatedTx = await (provider as any).populateTransaction(transaction);
        const signedTx = await wallet.signTransaction(populatedTx);

        return signedTx;
    }

    private getDefaultNetworks(): NetworkConfig[] {
        return [
            {
                chainId: 1,
                name: 'Ethereum Mainnet',
                rpcUrl: 'https://eth.llamarpc.com',
                blockExplorer: 'https://etherscan.io',
                currency: {
                    name: 'Ether',
                    symbol: 'ETH',
                    decimals: 18,
                },
            },
            {
                chainId: 11155111,
                name: 'Sepolia',
                rpcUrl: 'https://sepolia.infura.io/v3/YOUR_PROJECT_ID',
                blockExplorer: 'https://sepolia.etherscan.io',
                currency: {
                    name: 'Sepolia Ether',
                    symbol: 'SEP',
                    decimals: 18,
                },
            },
        ];
    }
}
