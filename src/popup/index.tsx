// Main entry point - uses modular architecture
import { PopupApp } from './app';

// Initialize app
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
console.log('[App] Starting initialization...');
app.init().catch((error) => {
    console.error('[App] Init error:', error);
    // Force render on error
    app.state.loading = false;
    app.render();
});
