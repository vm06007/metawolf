import type { AppState } from '../types/app-state';
import type { WalletService } from '../services/wallet-service';

export interface AppInitContext {
    state: AppState;
    walletService: WalletService;
    render: () => void;
    wakeServiceWorker: () => Promise<void>;
    checkUnlocked: () => Promise<void>;
    loadAccounts: () => Promise<void>;
    loadNetworks: () => Promise<void>;
    loadConnectedDApp: () => Promise<void>;
    loadEthPrice: () => Promise<void>;
}

export async function initializeApp(context: AppInitContext): Promise<void> {
    try {
        console.log('[Init] Initializing popup...');

        if (!chrome.runtime || !chrome.runtime.id) {
            console.error('[Init] Extension runtime not available!');
            return;
        }

        await context.wakeServiceWorker();
        await new Promise(resolve => setTimeout(resolve, 200));

        await Promise.all([
            context.checkUnlocked(),
            context.loadAccounts(),
            context.loadNetworks(),
            context.loadConnectedDApp(),
            context.loadEthPrice(),
        ]);
    } catch (error: any) {
        console.error('Error during initialization:', error);
    } finally {
        context.state.loading = false;
        setTimeout(() => context.render(), 0);
    }
}

export async function wakeServiceWorker(): Promise<void> {
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            const pingResponse = await Promise.race([
                chrome.runtime.sendMessage({ type: 'PING' }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('PING timeout')), 3000))
            ]);
            if (pingResponse && (pingResponse.success || pingResponse.pong)) {
                console.log('[Init] Service worker is awake!');
                return;
            }
        } catch (error: any) {
            if (attempt < 4) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            }
        }
    }
}

