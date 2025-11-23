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
     * @param messageHash - The message or hash to sign (hex-encoded)
     * @param slot - The key slot to use (1 or 3)
     * @param password - Optional password for the key slot
     * @param onPairing - Optional callback for pairing info
     * @param useDigest - If true, sign as raw digest (plain ECDSA). If false, sign as EIP-191 message.
     */
    static async signMessage(
        messageHash: string,
        slot: number = 1,
        password?: string,
        onPairing?: (pairInfo: HaloGatewayPairInfo) => void,
        useDigest: boolean = false
    ): Promise<LibHaLoSignResult | null> {
        // Load library first if needed
        if (!this.isAvailable()) {
            const loaded = await this.loadLibrary();
            if (!loaded) {
                console.error('[LibHaLoAdapter] Failed to load library');
                throw new Error('Failed to load LibHaLo library');
            }
        }

        const gate = await this.createGateway();
        if (!gate) {
            throw new Error('Failed to create Halo Gateway');
        }

        try {
            // Start pairing and show QR code FIRST
            console.log('[LibHaLoAdapter] Starting pairing...');
            const pairInfo = await gate.startPairing();
            console.log('[LibHaLoAdapter] Pairing info received:', pairInfo);
            
            // Call onPairing callback immediately to show QR code
            if (onPairing) {
                console.log('[LibHaLoAdapter] Calling onPairing callback');
                onPairing(pairInfo);
            } else {
                console.warn('[LibHaLoAdapter] No onPairing callback provided');
            }

            // Wait for phone to connect (this happens after QR code is scanned)
            console.log('[LibHaLoAdapter] Waiting for phone to connect...');
            await gate.waitConnected();
            console.log('[LibHaLoAdapter] Phone connected!');

            // Execute sign command
            // For transaction hashes (raw digests), use 'digest' parameter
            // For EIP-191 messages, use 'message' parameter
            const cmd: any = {
                name: 'sign',
                keyNo: slot,
            };
            
            if (useDigest) {
                // Sign as raw digest using plain ECDSA (for transaction hashes)
                cmd.digest = messageHash;
            } else {
                // Sign as EIP-191 message (for personal_sign)
                cmd.message = messageHash;
            }

            const result = await gate.execHaloCmd(cmd);
            await gate.close();

            if (result && result.signature) {
                // The gateway returns a full signature object with raw, der, and ether fields
                // Return the entire signature object so it can be properly parsed
                return {
                    signature: result.signature, // Full signature object, not just a string
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
            const reader = new NDEFReader();
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

