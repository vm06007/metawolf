/**
 * LibHaLo Adapter - Interface to LibHaLo library
 * Based on https://docs.arx.org/HaLo/overview
 * Uses HaLo Gateway for phone-based NFC scanning
 */

export interface LibHaLoKeyInfo {
    address: string;
    publicKey: string;
    slot: number;
}

export interface LibHaLoSignResult {
    signature: string;
    messageHash: string;
}

export interface HaloGatewayPairInfo {
    qrCode: string;
    execURL: string;
    serverVersion: {
        tagName: string;
        commitId: string;
    };
}

export interface HaloGateway {
    gatewayServerHttp?: string;
    startPairing(): Promise<HaloGatewayPairInfo>;
    waitConnected(): Promise<void>;
    execHaloCmd(cmd: any): Promise<any>;
    close(): Promise<void>;
}

export class LibHaLoAdapter {
    private static gatewayUrl = 'wss://s1.halo-gateway.arx.org';
    private static httpUrl = 'https://s1.halo-gateway.arx.org/e';

    /**
     * Check if LibHaLo is available (via local file or CDN)
     */
    static isAvailable(): boolean {
        return typeof window !== 'undefined' && 'HaloGateway' in window;
    }

    /**
     * Load LibHaLo from local file
     */
    static async loadLibrary(): Promise<boolean> {
        if (this.isAvailable()) {
            return true;
        }

        // Load from local file (CSP requires 'self' only)
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('popup/lib/libhalo.js');
            script.onload = () => {
                // Check if HaloGateway is available
                if (this.isAvailable()) {
                    resolve(true);
                } else {
                    console.error('HaloGateway not found after loading libhalo.js');
                    resolve(false);
                }
            };
            script.onerror = () => {
                console.error('Failed to load libhalo.js from local file');
                resolve(false);
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Create a new HaloGateway instance
     */
    static async createGateway(themeName: string = 'default'): Promise<HaloGateway | null> {
        if (!this.isAvailable()) {
            const loaded = await this.loadLibrary();
            if (!loaded) {
                console.error('Failed to load LibHaLo library');
                return null;
            }
        }

        try {
            const HaloGatewayClass = (window as any).HaloGateway;
            if (!HaloGatewayClass) {
                console.error('HaloGateway class not found');
                return null;
            }

            const gate = new HaloGatewayClass(this.gatewayUrl, { themeName });
            gate.gatewayServerHttp = this.httpUrl;
            return gate;
        } catch (error) {
            console.error('Error creating HaloGateway:', error);
            return null;
        }
    }

    /**
     * Get key information from HaLo chip slot using Gateway
     */
    static async getKeyInfo(
        slot: number = 1,
        onPairing?: (pairInfo: HaloGatewayPairInfo) => void
    ): Promise<LibHaLoKeyInfo | null> {
        const gate = await this.createGateway();
        if (!gate) {
            return null;
        }

        try {
            // Start pairing and show QR code
            const pairInfo = await gate.startPairing();
            if (onPairing) {
                onPairing(pairInfo);
            }

            // Wait for phone to connect
            await gate.waitConnected();

            // Execute command to get key info
            const cmd = {
                name: 'get_key_info',
                keyNo: slot,
            };

            const result = await gate.execHaloCmd(cmd);
            await gate.close();

            if (result && result.address) {
                return {
                    address: result.address || '',
                    publicKey: result.publicKey || '',
                    slot: slot,
                };
            }

            return null;
        } catch (error) {
            console.error('Error getting key info:', error);
            try {
                await gate.close();
            } catch (e) {
                // Ignore close errors
            }
            return null;
        }
    }

    /**
     * Sign message/hash with HaLo chip using Gateway
     */
    static async signMessage(
        messageHash: string,
        slot: number = 1,
        password?: string,
        onPairing?: (pairInfo: HaloGatewayPairInfo) => void
    ): Promise<LibHaLoSignResult | null> {
        const gate = await this.createGateway();
        if (!gate) {
            return null;
        }

        try {
            // Start pairing and show QR code
            const pairInfo = await gate.startPairing();
            if (onPairing) {
                onPairing(pairInfo);
            }

            // Wait for phone to connect
            await gate.waitConnected();

            // Execute sign command
            const cmd = {
                name: 'sign',
                message: messageHash,
                keyNo: slot,
            };

            const result = await gate.execHaloCmd(cmd);
            await gate.close();

            if (result && result.signature) {
                return {
                    signature: result.signature || '',
                    messageHash: result.messageHash || messageHash,
                };
            }

            return null;
        } catch (error) {
            console.error('Error signing with HaLo:', error);
            try {
                await gate.close();
            } catch (e) {
                // Ignore close errors
            }
            return null;
        }
    }

    /**
     * Check if NFC is available (for direct NFC mode)
     */
    static isNFCAvailable(): boolean {
        return 'NDEFReader' in window;
    }

    /**
     * Request NFC permission (for direct NFC mode)
     */
    static async requestNFCPermission(): Promise<boolean> {
        if (!this.isNFCAvailable()) {
            return false;
        }

        try {
            const reader = new window.NDEFReader();
            await reader.scan();
            return true;
        } catch (error) {
            console.error('NFC permission error:', error);
            return false;
        }
    }
}

declare global {
    interface Window {
        HaloGateway?: any;
    }
}

