/**
 * LibHaLo Adapter - Interface to LibHaLo library
 * Based on https://docs.arx.org/HaLo/overview
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

export class LibHaLoAdapter {
    /**
     * Check if LibHaLo is available (via CDN or module)
     */
    static isAvailable(): boolean {
        // Check if libHaLo is loaded
        return typeof window !== 'undefined' && 'libHaLo' in window;
    }

    /**
     * Load LibHaLo from CDN if not available
     */
    static async loadLibrary(): Promise<boolean> {
        if (this.isAvailable()) {
            return true;
        }

        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.arx.org/libhalo.js'; // Update with actual CDN URL
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.head.appendChild(script);
        });
    }

    /**
     * Get key information from HaLo chip slot
     */
    static async getKeyInfo(slot: number = 1): Promise<LibHaLoKeyInfo | null> {
        if (!this.isAvailable()) {
            await this.loadLibrary();
        }

        try {
            // Using LibHaLo API (adjust based on actual API)
            const haloChip = (window as any).libHaLo;
            const keyInfo = await haloChip.getKeyInfo(slot);

            return {
                address: keyInfo.address || '',
                publicKey: keyInfo.publicKey || '',
                slot: slot,
            };
        } catch (error) {
            console.error('Error getting key info:', error);
            return null;
        }
    }

    /**
     * Sign message/hash with HaLo chip
     */
    static async signMessage(
        messageHash: string,
        slot: number = 1,
        password?: string
    ): Promise<LibHaLoSignResult | null> {
        if (!this.isAvailable()) {
            await this.loadLibrary();
        }

        try {
            const haloChip = (window as any).libHaLo;
            const result = await haloChip.sign(messageHash, {
                slot: slot,
                password: password,
            });

            return {
                signature: result.signature || '',
                messageHash: result.messageHash || messageHash,
            };
        } catch (error) {
            console.error('Error signing with HaLo:', error);
            return null;
        }
    }

    /**
     * Generate new key pair on HaLo chip
     */
    static async generateKey(
        slot: number = 1,
        password?: string
    ): Promise<LibHaLoKeyInfo | null> {
        if (!this.isAvailable()) {
            await this.loadLibrary();
        }

        try {
            const haloChip = (window as any).libHaLo;
            const result = await haloChip.generateKey(slot, password);

            return {
                address: result.address || '',
                publicKey: result.publicKey || '',
                slot: slot,
            };
        } catch (error) {
            console.error('Error generating key:', error);
            return null;
        }
    }

    /**
     * Check if NFC is available
     */
    static isNFCAvailable(): boolean {
        return 'NDEFReader' in window;
    }

    /**
     * Request NFC permission
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
        libHaLo?: any;
    }
}

