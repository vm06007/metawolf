import { sendMessageWithRetry } from '../utils/messaging';

export class WalletService {
    async checkUnlocked(): Promise<boolean> {
        try {
            const response = await sendMessageWithRetry({
                type: 'CHECK_UNLOCKED',
            }, 2, 2000);
            return response?.unlocked || false;
        } catch (error: any) {
            console.error('Error checking unlock status:', error);
            return false;
        }
    }

    async getAccounts(): Promise<any[]> {
        try {
            const response = await sendMessageWithRetry({
                type: 'GET_ACCOUNTS',
            }, 2, 2000);
            if (response && response.success) {
                return response.accounts || [];
            }
            return [];
        } catch (error: any) {
            console.error('Error loading accounts:', error);
            return [];
        }
    }

    async getSelectedAccount(): Promise<any | null> {
        try {
            const response = await sendMessageWithRetry({
                type: 'GET_SELECTED_ACCOUNT',
            }, 2, 2000);
            if (response && response.success && response.account) {
                return response.account;
            }
            return null;
        } catch (error: any) {
            console.error('Error loading selected account:', error);
            return null;
        }
    }

    async getNetworks(): Promise<any[]> {
        try {
            const response = await sendMessageWithRetry({
                type: 'GET_NETWORKS',
            }, 2, 2000);
            if (response && response.success) {
                return response.networks || [];
            }
            return this.getDefaultNetworks();
        } catch (error: any) {
            console.error('Error loading networks:', error);
            return this.getDefaultNetworks();
        }
    }

    private getDefaultNetworks(): any[] {
        return [{
            chainId: 1,
            name: 'Ethereum Mainnet',
            rpcUrl: 'https://mainnet.infura.io/v3/db2e296c0a0f475fb6c3a3281a0c39d6',
            currency: { name: 'Ether', symbol: 'ETH', decimals: 18 }
        }];
    }

    async unlock(password: string): Promise<boolean> {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'UNLOCK',
                password,
            });
            if (chrome.runtime.lastError) {
                throw new Error(chrome.runtime.lastError.message);
            }
            return response?.success || false;
        } catch (error) {
            console.error('Error unlocking:', error);
            return false;
        }
    }

    async lock(): Promise<void> {
        try {
            await chrome.runtime.sendMessage({ type: 'LOCK' });
            if (chrome.runtime.lastError) {
                console.error('Error:', chrome.runtime.lastError.message);
            }
        } catch (error) {
            console.error('Error locking:', error);
        }
    }

    async createAccount(name?: string): Promise<any> {
        const response = await sendMessageWithRetry({
            type: 'CREATE_ACCOUNT',
            name: name || undefined,
        }, 5, 3000);
        if (!response) {
            throw new Error('No response from background script');
        }
        if (!response.success) {
            throw new Error(response.error || 'Failed to create account');
        }
        return response;
    }

    async importAccount(privateKey: string, name?: string): Promise<any> {
        const response = await sendMessageWithRetry({
            type: 'IMPORT_ACCOUNT',
            privateKey: privateKey.trim(),
            name: name || undefined,
        });
        if (!response) {
            throw new Error('No response from background script');
        }
        if (!response.success) {
            throw new Error(response.error || 'Failed to import account');
        }
        return response;
    }

    async selectAccount(address: string): Promise<void> {
        try {
            await chrome.runtime.sendMessage({
                type: 'SET_SELECTED_ACCOUNT',
                address: address,
            });
            if (chrome.runtime.lastError) {
                console.error('Error:', chrome.runtime.lastError.message);
            }
        } catch (error) {
            console.error('Error selecting account:', error);
        }
    }

    async deleteAccount(address: string): Promise<void> {
        const response = await sendMessageWithRetry({
            type: 'DELETE_ACCOUNT',
            address: address,
        }, 5, 3000);
        if (!response) {
            throw new Error('No response from background script');
        }
        if (!response.success) {
            throw new Error(response.error || 'Failed to delete account');
        }
    }

    async switchNetwork(chainId: number): Promise<void> {
        try {
            await chrome.runtime.sendMessage({
                type: 'SET_NETWORK',
                chainId: chainId,
            });
            if (chrome.runtime.lastError) {
                console.error('Error:', chrome.runtime.lastError.message);
            }
        } catch (error) {
            console.error('Error switching network:', error);
        }
    }
}
