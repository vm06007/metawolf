// Expanded view - uses the same PopupApp as the main popup
// IMPORTANT: Polyfills must be imported FIRST to ensure Buffer is available
import './polyfills';

import { PopupApp } from './app';

// Wait for Buffer to be available before initializing app
async function waitForBuffer(maxWait = 2000) {
    const startTime = Date.now();
    while (typeof (window as any).Buffer === 'undefined' && (Date.now() - startTime) < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    if (typeof (window as any).Buffer === 'undefined') {
        console.error('[Expanded App] Buffer not available after waiting');
        return false;
    }
    
    console.log('[Expanded App] Buffer is available, proceeding with initialization');
    return true;
}

// Initialize app after polyfills are ready
(async () => {
    const bufferReady = await waitForBuffer();
    
    if (!bufferReady) {
        console.error('[Expanded App] Failed to load Buffer polyfill - app may not work correctly');
    }
    
    const app = new PopupApp();
    
    // Add safety timeout - always render after 2 seconds even if init hangs
    setTimeout(() => {
        if (app.state.loading) {
            console.warn('[Safety] Initialization timeout after 2s - forcing render');
            app.state.loading = false;
            app.state.unlocked = false;
            app.state.accounts = [];
            app.state.networks = [{
                chainId: 1,
                name: 'Ethereum Mainnet',
                rpcUrl: 'https://mainnet.infura.io/v3/db2e296c0a0f475fb6c3a3281a0c39d6',
                currency: { name: 'Ether', symbol: 'ETH', decimals: 18 }
            }];
            app.state.selectedNetwork = 1;
            app.render();
        }
    }, 2000);
    
    // Start initialization
    console.log('[Expanded App] Starting initialization...');
    app.init().catch((error) => {
        console.error('[Expanded App] Init error:', error);
        // Force render on error
        app.state.loading = false;
        app.render();
    });
})();
