/**
 * Firefly Adapter - Interface to Firefly Wallet library
 * Based on https://firefly.box/demo/
 * Uses WebUSB to connect to Firefly hardware wallet
 */

export interface FireflyDevice {
    model: string;
    serialNumber: string;
    discover(): Promise<FireflyDevice>;
    destroy(): void;
    ondisconnect?: () => void;
}

export interface FireflySigner {
    getAddress(): Promise<string>;
    sendTransaction(tx: any): Promise<any>;
}

export interface FireflyModule {
    Firefly: {
        discover(): Promise<FireflyDevice>;
    };
    FireflySigner: new (firefly: FireflyDevice, provider?: any) => FireflySigner;
    JsonRpcProvider: any;
    parseEther: (value: string) => string;
}

export class FireflyAdapter {
    private static fireflyModule: FireflyModule | null = null;

    /**
     * Check if Firefly library is available
     */
    static isAvailable(): boolean {
        return this.fireflyModule !== null;
    }

    /**
     * Load Firefly library from local file
     * The library is bundled with the extension and loaded via chrome.runtime.getURL()
     */
    static async loadLibrary(): Promise<boolean> {
        if (this.isAvailable()) {
            return true;
        }

        // Load from local file (CSP requires 'self' only)
        return new Promise((resolve) => {
            // Check if already loaded via window
            if ((window as any).__FIREFLY_MODULE__) {
                this.fireflyModule = (window as any).__FIREFLY_MODULE__;
                resolve(true);
                return;
            }

            const script = document.createElement('script');
            script.type = 'module';
            script.textContent = `
                import { Firefly, FireflySigner, JsonRpcProvider, parseEther } from '${chrome.runtime.getURL('popup/lib/firefly.js')}';
                window.__FIREFLY_MODULE__ = { Firefly, FireflySigner, JsonRpcProvider, parseEther };
            `;
            
            script.onload = () => {
                // Check if Firefly is available
                if ((window as any).__FIREFLY_MODULE__) {
                    this.fireflyModule = (window as any).__FIREFLY_MODULE__;
                    resolve(true);
                } else {
                    console.error('Firefly module not found after loading firefly.js');
                    resolve(false);
                }
            };
            
            script.onerror = () => {
                console.error('Failed to load firefly.js from local file');
                resolve(false);
            };

            document.head.appendChild(script);
        });
    }

    /**
     * Discover and connect to a Firefly device
     */
    static async discover(): Promise<FireflyDevice | null> {
        if (!this.isAvailable()) {
            const loaded = await this.loadLibrary();
            if (!loaded) {
                console.error('Failed to load Firefly library');
                return null;
            }
        }

        try {
            if (!this.fireflyModule || !this.fireflyModule.Firefly) {
                throw new Error('Firefly module not available');
            }

            const firefly = await this.fireflyModule.Firefly.discover();
            return firefly;
        } catch (error: any) {
            console.error('Error discovering Firefly device:', error);
            throw new Error(error.message || 'Failed to discover Firefly device');
        }
    }

    /**
     * Create a FireflySigner instance
     */
    static createSigner(firefly: FireflyDevice, provider?: any): FireflySigner | null {
        if (!this.isAvailable() || !this.fireflyModule) {
            return null;
        }

        try {
            return new this.fireflyModule.FireflySigner(firefly, provider);
        } catch (error) {
            console.error('Error creating FireflySigner:', error);
            return null;
        }
    }

    /**
     * Get address from Firefly device
     */
    static async getAddress(firefly: FireflyDevice): Promise<string | null> {
        try {
            const signer = this.createSigner(firefly);
            if (!signer) {
                return null;
            }

            const address = await signer.getAddress();
            return address;
        } catch (error: any) {
            console.error('Error getting Firefly address:', error);
            if (error.message === 'NOT READY') {
                throw new Error('Wallet App not running on Firefly');
            }
            throw new Error(error.message || 'Failed to get Firefly address');
        }
    }
}

declare global {
    interface Window {
        __FIREFLY_MODULE__?: FireflyModule;
    }
}

