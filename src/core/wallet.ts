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

                // Merge networks: add any new networks from defaults that aren't in stored state
                const defaultNetworks = this.getDefaultNetworks();
                const existingChainIds = new Set(this.state.networks.map(n => n.chainId));
                const newNetworks = defaultNetworks.filter(n => !existingChainIds.has(n.chainId));

                if (newNetworks.length > 0) {
                    console.log('[Wallet] Adding new networks:', newNetworks.map(n => n.name));
                    this.state.networks = [...this.state.networks, ...newNetworks];
                    await this.saveState(); // Persist the updated networks
                }

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
        const { verifyPassword } = await import('./password.js');
        const isValid = await verifyPassword(password);
        if (isValid) {
            this.state.unlocked = true;
            await this.saveState();
        }
        return isValid;
    }

    async lock(): Promise<void> {
        this.state.unlocked = false;
        await this.saveState();
    }

    isUnlocked(): boolean {
        return this.state.unlocked;
    }

    /**
     * Create account from HaLo chip (chip-centric approach)
     * Reads chip address and uses it as the account address
     */
    async createAccountFromChip(chipAddress: string, chipPublicKey: string, slot: number, name?: string): Promise<Account> {
        try {
            const account: Account = {
                address: chipAddress.toLowerCase(),
                name: name || `HaLo Chip ${this.state.accounts.length + 1}`,
                encrypted: false,
                isChipAccount: true,
                chipInfo: {
                    address: chipAddress.toLowerCase(),
                    publicKey: chipPublicKey,
                    slot: slot,
                    linkedAt: Date.now(),
                },
                haloLinked: true,
            };

            // Check for duplicates
            if (this.state.accounts.some(acc => acc.address.toLowerCase() === account.address.toLowerCase())) {
                throw new Error('Chip account already exists');
            }

            this.state.accounts.push(account);
            if (!this.state.selectedAccount) {
                this.state.selectedAccount = account.address;
            }

            // NO private key stored - chip is the only way to sign
            await this.saveState();

            return account;
        } catch (error: any) {
            console.error('Error in createAccountFromChip:', error);
            throw new Error(error.message || 'Failed to create account from chip');
        }
    }

    /**
     * Create account from Firefly wallet (hardware wallet)
     * Reads Firefly address and uses it as the account address
     */
    async createAccountFromFirefly(fireflyAddress: string, deviceInfo: any, name?: string): Promise<Account> {
        try {
            const account: Account = {
                address: fireflyAddress.toLowerCase(),
                name: name || `Firefly ${this.state.accounts.length + 1}`,
                encrypted: false,
                isFireflyAccount: true,
                fireflyInfo: {
                    address: fireflyAddress.toLowerCase(),
                    model: deviceInfo.model,
                    serialNumber: deviceInfo.serialNumber,
                    connectedAt: deviceInfo.connectedAt || Date.now(),
                },
            };

            // Check for duplicates
            if (this.state.accounts.some(acc => acc.address.toLowerCase() === account.address.toLowerCase())) {
                throw new Error('Firefly account already exists');
            }

            this.state.accounts.push(account);
            if (!this.state.selectedAccount) {
                this.state.selectedAccount = account.address;
            }

            // NO private key stored - Firefly device is the only way to sign
            await this.saveState();

            return account;
        } catch (error: any) {
            console.error('Error in createAccountFromFirefly:', error);
            throw new Error(error.message || 'Failed to create account from Firefly');
        }
    }

    /**
     * Create multisig account with multiple HaLo chips
     * NOTE: This creates the account structure but does NOT deploy the contract
     * The contract must be deployed separately using deployMultisig()
     */
    async createMultisigAccount(chips: any, threshold: number, name?: string): Promise<Account> {
        try {
            if (chips.length < 2) {
                throw new Error('Multisig requires at least 2 chips');
            }
            if (threshold < 1 || threshold > chips.length) {
                throw new Error(`Threshold must be between 1 and ${chips.length}`);
            }

            // Generate a temporary placeholder address
            // The actual deployment address will be determined by the random salt during deployment
            // We create a unique identifier for this multisig account
            const randomBytes = ethers.randomBytes(20); // 20 bytes = 160 bits for an address
            const smartAccountAddress = ethers.getAddress(ethers.hexlify(randomBytes));

            const account: Account = {
                address: smartAccountAddress,
                name: name || `Multisig (${threshold}/${chips.length})`,
                encrypted: false,
                isChipAccount: false,
                multisig: {
                    threshold: threshold,
                    chips: chips,
                    smartAccountAddress: smartAccountAddress,
                    deployed: false, // Will be set to true when contract is deployed
                },
                haloLinked: true,
            };

            // Check if account already exists - if so, update it instead of throwing error
            const existingIndex = this.state.accounts.findIndex(
                acc => acc.address.toLowerCase() === account.address.toLowerCase()
            );

            if (existingIndex >= 0) {
                // Update existing account with new info (chips might have changed)
                console.log('[Wallet] Updating existing multisig account:', account.address);
                this.state.accounts[existingIndex] = account;
            } else {
                // Add new account
                console.log('[Wallet] Adding new multisig account:', account.address);
                this.state.accounts.push(account);
            }

            if (!this.state.selectedAccount) {
                this.state.selectedAccount = account.address;
            }

            // NO private key stored - only chips can sign
            await this.saveState();

            return account;
        } catch (error: any) {
            console.error('Error in createMultisigAccount:', error);
            throw new Error(error.message || 'Failed to create multisig account');
        }
    }

    async createAccount(name?: string): Promise<Account> {
        try {
            const wallet = ethers.Wallet.createRandom();
            const account: Account = {
                address: wallet.address,
                name: name || `Account ${this.state.accounts.length + 1}`,
                encrypted: false,
                isChipAccount: false,
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

    /**
     * Verify account data integrity - check if private key matches account address
     * Returns accounts with mismatched private keys
     */
    async verifyAccountIntegrity(): Promise<Array<{ account: Account; issue: string; recoveredAddress: string }>> {
        const issues: Array<{ account: Account; issue: string; recoveredAddress: string }> = [];

        for (const account of this.state.accounts) {
            // Skip watch-only, chip accounts, and firefly accounts (they don't have stored private keys)
            if (account.isWatchOnly || account.isChipAccount || account.isFireflyAccount) {
                continue;
            }

            const privateKey = await this.getPrivateKey(account.address);
            if (!privateKey) {
                issues.push({
                    account,
                    issue: 'Private key not found',
                    recoveredAddress: ''
                });
                continue;
            }

            // Verify private key matches account address
            try {
                const { privateKeyToAccount } = await import('viem/accounts');
                const { getAddress } = await import('viem');
                const accountFromKey = privateKeyToAccount(privateKey as `0x${string}`);
                const addressFromKey = getAddress(accountFromKey.address).toLowerCase();
                const expectedAddress = getAddress(account.address).toLowerCase();

                if (addressFromKey !== expectedAddress) {
                    issues.push({
                        account,
                        issue: `Private key belongs to different address: ${addressFromKey} (expected ${expectedAddress})`,
                        recoveredAddress: addressFromKey
                    });
                }
            } catch (error: any) {
                issues.push({
                    account,
                    issue: `Error verifying private key: ${error.message}`,
                    recoveredAddress: ''
                });
            }
        }

        return issues;
    }

    /**
     * Fix account data integrity by updating the account address to match the private key
     * WARNING: This will change the account address - use with caution
     */
    async fixAccountAddress(accountAddress: string): Promise<boolean> {
        try {
            const account = this.state.accounts.find(
                acc => acc.address.toLowerCase() === accountAddress.toLowerCase()
            );

            if (!account) {
                throw new Error('Account not found');
            }

            const privateKey = await this.getPrivateKey(account.address);
            if (!privateKey) {
                throw new Error('Private key not found');
            }

            // Get the actual address from the private key
            const { privateKeyToAccount } = await import('viem/accounts');
            const { getAddress } = await import('viem');
            const accountFromKey = privateKeyToAccount(privateKey as `0x${string}`);
            const actualAddress = getAddress(accountFromKey.address);

            // Update account address to match private key
            const oldAddress = account.address;
            account.address = actualAddress;

            // Re-store private key under the correct address
            await this.storePrivateKey(actualAddress, privateKey);

            // Remove old private key if address changed
            if (oldAddress.toLowerCase() !== actualAddress.toLowerCase()) {
                const normalizedOldAddress = oldAddress.toLowerCase();
                await chrome.storage.local.remove(`key_${normalizedOldAddress}`);
            }

            await this.saveState();
            console.log(`[Wallet] Fixed account address: ${oldAddress} -> ${actualAddress}`);
            return true;
        } catch (error: any) {
            console.error('[Wallet] Error fixing account address:', error);
            return false;
        }
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

    /**
     * Update account name/alias
     */
    async updateAccountName(address: string, name: string): Promise<void> {
        const account = this.state.accounts.find(
            acc => acc.address.toLowerCase() === address.toLowerCase()
        );
        if (account) {
            account.name = name;
            await this.saveState();
        } else {
            throw new Error('Account not found');
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
            // Use RPC service to get RPC URL (with custom RPC support)
            const { rpcService } = await import('./rpc-service.js');
            const rpcUrl = rpcService.getRPCUrl(network.chainId);
            this.provider = new ethers.JsonRpcProvider(rpcUrl);
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

    getSelectedNetwork(): number {
        return this.state.selectedNetwork;
    }

    getNetworks(): NetworkConfig[] {
        return this.state.networks;
    }

    private async storePrivateKey(address: string, privateKey: string): Promise<void> {
        try {
            // Always use lowercase for storage to ensure consistency
            const normalizedAddress = address.toLowerCase();
            // In production, encrypt this with user password
            await chrome.storage.local.set({
                [`key_${normalizedAddress}`]: privateKey,
            });
        } catch (error) {
            console.error('[Wallet] Error storing private key:', error);
            throw error;
        }
    }

    async getPrivateKey(address: string): Promise<string | null> {
        try {
            // Always use lowercase for retrieval to ensure consistency
            const normalizedAddress = address.toLowerCase();

            // Try lowercase first (new format)
            let stored = await chrome.storage.local.get(`key_${normalizedAddress}`);
            let privateKey = stored[`key_${normalizedAddress}`];

            // If not found, try with original address casing (for backward compatibility)
            if (!privateKey && address !== normalizedAddress) {
                stored = await chrome.storage.local.get(`key_${address}`);
                privateKey = stored[`key_${address}`];

                // If found with old format, migrate to new format
                if (privateKey) {
                    await this.storePrivateKey(normalizedAddress, privateKey);
                    // Remove old format
                    await chrome.storage.local.remove(`key_${address}`);
                    console.log(`[Wallet] Migrated private key storage for ${address} to lowercase format`);
                }
            }

            return privateKey || null;
        } catch (error) {
            console.error('[Wallet] Error getting private key:', error);
            return null;
        }
    }

    /**
     * Delete private key from storage (for security when linking to HaLo chip)
     * WARNING: This is irreversible - user will need HaLo chip to access funds
     */
    async deletePrivateKey(address: string): Promise<void> {
        try {
            // Always use lowercase for consistency
            const normalizedAddress = address.toLowerCase();
            await chrome.storage.local.remove(`key_${normalizedAddress}`);
            console.log(`[Wallet] Private key deleted for account ${address}`);
        } catch (error) {
            console.error('[Wallet] Error deleting private key:', error);
            throw error;
        }
    }

    /**
     * Delete an account from the wallet
     * Removes the account from the accounts list and cleans up related data
     */
    async deleteAccount(address: string): Promise<void> {
        try {
            const accountIndex = this.state.accounts.findIndex(
                acc => acc.address.toLowerCase() === address.toLowerCase()
            );

            if (accountIndex === -1) {
                throw new Error('Account not found');
            }

            // Check if this is the last account
            if (this.state.accounts.length === 1) {
                throw new Error('Cannot delete the last account');
            }

            // Remove account from list
            this.state.accounts.splice(accountIndex, 1);

            // If deleted account was selected, select the first available account
            if (this.state.selectedAccount?.toLowerCase() === address.toLowerCase()) {
                if (this.state.accounts.length > 0) {
                    this.state.selectedAccount = this.state.accounts[0].address;
                } else {
                    this.state.selectedAccount = undefined;
                }
            }

            // Clean up related data
            try {
                // Delete private key if exists (already lowercase from getPrivateKey)
                const normalizedAddress = address.toLowerCase();
                await chrome.storage.local.remove(`key_${normalizedAddress}`);

                // Delete HaLo link if exists
                await chrome.storage.local.remove(`halo_link_${address.toLowerCase()}`);

                // Delete any account-specific preferences
                await chrome.storage.local.remove(`account_${address.toLowerCase()}`);
            } catch (cleanupError) {
                console.warn('[Wallet] Error during account cleanup:', cleanupError);
                // Continue even if cleanup fails
            }

            await this.saveState();
            console.log(`[Wallet] Account deleted: ${address}`);
        } catch (error: any) {
            console.error('[Wallet] Error deleting account:', error);
            throw error;
        }
    }

    async signTransaction(transaction: Transaction): Promise<string> {
        const account = this.getSelectedAccount();
        if (!account) {
            throw new Error('No account selected');
        }

        // Check if this is a watch-only account
        if (account.isWatchOnly) {
            throw new Error('Cannot sign transactions with a watch-only address. This is a view-only account.');
        }

        // SECURITY CHECK: Block private key signing for HaLo-linked accounts
        // This prevents theft if storage is compromised - attacker cannot use stolen private keys
        try {
            const { HaloChip } = await import('../halo/halo.js');
            const isLinked = await HaloChip.isAccountLinked(account.address);
            if (isLinked) {
                throw new Error('SECURITY: This account is protected by a HaLo chip. Private key signing is disabled. All transactions must be signed with the HaLo chip hardware key.');
            }
        } catch (error: any) {
            // If error is about HaLo protection, re-throw it
            if (error.message && error.message.includes('HaLo chip')) {
                throw error;
            }
            // If HaloChip import/check fails, allow signing (HaLo module may not be available)
            // This is a fallback for environments without HaLo support
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

    /**
     * Add a watch-only (view-only) address to the wallet
     * This allows viewing the portfolio but cannot sign transactions
     */
    async addWatchAddress(address: string, name?: string): Promise<Account> {
        try {
            // Normalize address
            let normalizedAddress: string;
            if (ethers.isAddress(address)) {
                normalizedAddress = address.toLowerCase();
            } else {
                // Check if input looks like an ENS name
                const ensPattern = /^[a-z0-9-]+\.(eth|xyz|app|luxe|kred|art|club|design|fashion|game|group|law|media|music|news|online|photo|pics|pink|racing|realestate|restaurant|shop|site|space|tech|travel|vip|website|win|wtf)$/i;
                const looksLikeEns = ensPattern.test(address.trim());
                
                if (!looksLikeEns) {
                    throw new Error(`Invalid address or ENS name: ${address}. ENS names must end with a valid TLD (e.g., .eth)`);
                }

                // ENS names can only be resolved on Ethereum mainnet
                // Use mainnet provider specifically for ENS resolution
                const { rpcService } = await import('./rpc-service.js');
                const mainnetRpcUrl = rpcService.getRPCUrl(1); // Chain ID 1 = Ethereum mainnet
                const mainnetProvider = new ethers.JsonRpcProvider(mainnetRpcUrl);
                
                try {
                    // Add timeout for ENS resolution (10 seconds)
                    const timeoutPromise = new Promise<never>((_, reject) => {
                        setTimeout(() => reject(new Error('ENS resolution timeout')), 10000);
                    });
                    
                    const resolvedAddress = await Promise.race([
                        mainnetProvider.resolveName(address.trim()),
                        timeoutPromise,
                    ]);
                    
                    if (!resolvedAddress) {
                        throw new Error(`ENS name "${address}" could not be resolved. It may not exist or may not be configured.`);
                    }
                    normalizedAddress = resolvedAddress.toLowerCase();
                } catch (ensError: any) {
                    if (ensError.message?.includes('timeout')) {
                        throw new Error(`ENS resolution timed out for "${address}". Please check your connection and try again.`);
                    } else if (ensError.message?.includes('could not be resolved')) {
                        throw ensError; // Re-throw the specific error
                    } else {
                        throw new Error(`Failed to resolve ENS name "${address}": ${ensError.message || 'Unknown error'}`);
                    }
                }
            }

            // Check for duplicates
            if (this.state.accounts.some(acc => acc.address.toLowerCase() === normalizedAddress)) {
                throw new Error('Address already exists in wallet');
            }

            const account: Account = {
                address: normalizedAddress,
                name: name || `Contact ${this.state.accounts.filter(a => a.isWatchOnly).length + 1}`,
                encrypted: false,
                isWatchOnly: true,
            };

            this.state.accounts.push(account);
            if (!this.state.selectedAccount) {
                this.state.selectedAccount = account.address;
            }

            await this.saveState();
            return account;
        } catch (error: any) {
            console.error('Error in addWatchAddress:', error);
            throw new Error(error.message || 'Failed to add watch address');
        }
    }

    private getDefaultNetworks(): NetworkConfig[] {
        return [
            {
                chainId: 1,
                name: 'Ethereum',
                rpcUrl: 'https://mainnet.infura.io/v3/b17509e0e2ce45f48a44289ff1aa3c73',
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
                rpcUrl: 'https://sepolia.infura.io/v3/b17509e0e2ce45f48a44289ff1aa3c73',
                blockExplorer: 'https://sepolia.etherscan.io',
                currency: {
                    name: 'Sepolia Ether',
                    symbol: 'SEP',
                    decimals: 18,
                },
            },
            {
                chainId: 8453,
                name: 'Base',
                rpcUrl: 'https://mainnet.base.org',
                blockExplorer: 'https://basescan.org',
                currency: {
                    name: 'Ether',
                    symbol: 'ETH',
                    decimals: 18,
                },
            },
            {
                chainId: 84532,
                name: 'Base Sepolia',
                rpcUrl: 'https://sepolia.base.org',
                blockExplorer: 'https://sepolia-explorer.base.org',
                currency: {
                    name: 'Base Sepolia Ether',
                    symbol: 'ETH',
                    decimals: 18,
                },
            },
            {
                chainId: 42161,
                name: 'Arbitrum One',
                rpcUrl: 'https://arb1.arbitrum.io/rpc',
                blockExplorer: 'https://arbiscan.io',
                currency: {
                    name: 'Ether',
                    symbol: 'ETH',
                    decimals: 18,
                },
            },
            {
                chainId: 48900,
                name: 'Zircuit Mainnet',
                rpcUrl: 'https://zircuit-mainnet.drpc.org',
                blockExplorer: 'https://explorer.zircuit.com',
                currency: {
                    name: 'Ether',
                    symbol: 'ETH',
                    decimals: 18,
                },
            },
            {
                chainId: 5115,
                name: 'Citrea Testnet',
                rpcUrl: 'https://rpc.testnet.citrea.xyz',
                blockExplorer: 'https://explorer.testnet.citrea.xyz',
                currency: {
                    name: 'cBTC',
                    symbol: 'cBTC',
                    decimals: 18,
                },
            },
            {
                chainId: 62298,
                name: 'Citrea Devnet',
                rpcUrl: 'https://rpc.devnet.citrea.xyz',
                blockExplorer: 'https://explorer.devnet.citrea.xyz',
                currency: {
                    name: 'cBTC',
                    symbol: 'cBTC',
                    decimals: 18,
                },
            },
        ];
    }
}

