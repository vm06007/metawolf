/**
 * Arx HaLo Chip Integration
 * Supports NFC communication with HaLo hardware security module
 * Based on LibHaLo demos: https://halo-demos.arx.org/examples/
 */

export interface HaloConfig {
    slot?: number;
    password?: string;
    onPairing?: (pairInfo: any) => void;
}

export interface HaloResponse {
    success: boolean;
    data?: any;
    error?: string;
}

export class HaloChip {
    private static readonly HALO_MIME_TYPE = 'application/halo';
    private static readonly DEFAULT_SLOT = 1;

    /**
     * Check if WebNFC is available
     */
    static isAvailable(): boolean {
        return 'NDEFReader' in window;
    }

    /**
     * Check if HaLo chip is present via NFC
     */
    static async detectChip(): Promise<boolean> {
        if (!this.isAvailable()) {
            return false;
        }

        try {
            const reader = new NDEFReader();
            await reader.scan();
            return true;
        } catch (error) {
            console.error('HaLo chip detection error:', error);
            return false;
        }
    }

    /**
     * Execute command on HaLo chip via Gateway or direct NFC
     */
    static async executeCommand(
        command: string,
        config?: HaloConfig
    ): Promise<HaloResponse> {
        if (!this.isAvailable()) {
            // Fallback to Gateway mode (HTTP-based)
            return await this.executeViaGateway(command, config);
        }

        try {
            // Try direct NFC communication
            return await this.executeViaNFC(command, config);
        } catch (error) {
            console.error('NFC execution failed, trying Gateway:', error);
            return await this.executeViaGateway(command, config);
        }
    }

    /**
     * Sign message/transaction with HaLo chip
     */
    static async sign(
        message: string | Uint8Array,
        config?: HaloConfig
    ): Promise<HaloResponse> {
        try {
            // Always try LibHaLo first (it will load the library if needed)
            const { LibHaLoAdapter } = await import('./libhalo-adapter.js');
            
            // Convert message to hex
            const messageHex =
                typeof message === 'string'
                    ? message.startsWith('0x')
                        ? message.slice(2)
                        : message
                    : Array.from(message)
                          .map((b) => b.toString(16).padStart(2, '0'))
                          .join('');

            // Try to sign with LibHaLo (it will load library and create gateway if needed)
            // For transaction hashes, we need to use 'digest' parameter (plain ECDSA)
            // For messages, we use 'message' parameter (EIP-191)
            // Since we're signing a transaction hash (32-byte digest), use digest=true
            const result = await LibHaLoAdapter.signMessage(
                messageHex,
                config?.slot || this.DEFAULT_SLOT,
                config?.password,
                config?.onPairing,
                true // useDigest = true for transaction hashes
            );

            if (result && result.signature) {
                return {
                    success: true,
                    data: {
                        signature: result.signature,
                        messageHash: result.messageHash,
                    },
                };
            }
        } catch (error) {
            console.warn('LibHaLo signing failed, using fallback:', error);
        }

        // Fallback to command-based approach
        const messageHex =
            typeof message === 'string'
                ? message
                : Array.from(message)
                      .map((b) => b.toString(16).padStart(2, '0'))
                      .join('');

        const command = {
            action: 'sign',
            message: messageHex,
            slot: config?.slot || this.DEFAULT_SLOT,
            password: config?.password,
        };

        return await this.executeCommand(JSON.stringify(command), config);
    }

    /**
     * Generate new key pair on HaLo chip
     */
    static async generateKey(
        slot: number = this.DEFAULT_SLOT,
        password?: string
    ): Promise<HaloResponse> {
        const command = {
            action: 'generate_key',
            slot: slot,
            password: password,
        };

        return await this.executeCommand(JSON.stringify(command), { slot, password });
    }

    /**
     * Get public key for a slot
     */
    static async getPublicKey(
        slot: number = this.DEFAULT_SLOT
    ): Promise<HaloResponse> {
        const command = {
            action: 'get_public_key',
            slot: slot,
        };

        return await this.executeCommand(JSON.stringify(command), { slot });
    }

    /**
     * Get key information (address, etc.) using Gateway
     */
    static async getKeyInfo(
        slot: number = this.DEFAULT_SLOT,
        onPairing?: (pairInfo: any) => void
    ): Promise<HaloResponse> {
        try {
            // Use LibHaLo Gateway for phone-based NFC scanning
            const { LibHaLoAdapter } = await import('./libhalo-adapter.js');
            const keyInfo = await LibHaLoAdapter.getKeyInfo(slot, onPairing);
            
            if (keyInfo) {
                return {
                    success: true,
                    data: {
                        address: keyInfo.address,
                        publicKey: keyInfo.publicKey,
                        slot: keyInfo.slot,
                    },
                };
            }
            
            return {
                success: false,
                error: 'Failed to get key info from HaLo chip',
            };
        } catch (error: any) {
            console.error('Error getting key info:', error);
            return {
                success: false,
                error: error.message || 'Failed to get key info from HaLo chip',
            };
        }
    }

    /**
     * Link account to HaLo chip slot
     * Reads key info from chip and links it to wallet account using Gateway
     */
    static async linkAccount(
        address: string,
        slot: number = this.DEFAULT_SLOT,
        onPairing?: (pairInfo: any) => void
    ): Promise<{ success: boolean; error?: string; keyInfo?: any }> {
        try {
            // Use LibHaLo Gateway for phone-based NFC scanning
            const { LibHaLoAdapter } = await import('./libhalo-adapter.js');
            
            const keyInfo = await LibHaLoAdapter.getKeyInfo(slot, onPairing);
            
            if (keyInfo && keyInfo.address) {
                const chipAddress = keyInfo.address.toLowerCase();
                const walletAddress = address.toLowerCase();

                // Store link data
                const linkData = {
                    slot: slot,
                    publicKey: keyInfo.publicKey,
                    chipAddress: chipAddress,
                    walletAddress: walletAddress,
                    linkedAt: Date.now(),
                };

                // Store mapping in extension storage
                await chrome.storage.local.set({
                    [`halo_link_${walletAddress}`]: linkData,
                });

                return {
                    success: true,
                    keyInfo: linkData,
                };
            } else {
                return {
                    success: false,
                    error: 'Failed to read key info from HaLo chip. Make sure to scan the QR code with your phone and tap the chip.',
                };
            }
        } catch (error: any) {
            console.error('Error linking account:', error);
            return {
                success: false,
                error: error.message || 'Failed to link account to HaLo chip',
            };
        }
    }

    /**
     * Check if account is linked to HaLo chip
     */
    static async isAccountLinked(address: string): Promise<boolean> {
        // Always use lowercase for consistency with storage keys
        const normalizedAddress = address.toLowerCase();
        const stored = await chrome.storage.local.get(`halo_link_${normalizedAddress}`);
        return !!stored[`halo_link_${normalizedAddress}`];
    }

    /**
     * Get link information for an account (including chip address)
     */
    static async getLinkInfo(address: string): Promise<{ chipAddress?: string; slot?: number; linkedAt?: number } | null> {
        const normalizedAddress = address.toLowerCase();
        const stored = await chrome.storage.local.get(`halo_link_${normalizedAddress}`);
        const linkData = stored[`halo_link_${normalizedAddress}`];
        
        if (linkData) {
            return {
                chipAddress: linkData.chipAddress,
                slot: linkData.slot,
                linkedAt: linkData.linkedAt,
            };
        }
        
        return null;
    }

    /**
     * Execute command via direct NFC
     */
    private static async executeViaNFC(
        command: string,
        config?: HaloConfig
    ): Promise<HaloResponse> {
        const reader = new NDEFReader();

        try {
            await reader.scan();

            return new Promise((resolve) => {
                reader.addEventListener('reading', async (event) => {
                    try {
                        // Write command to tag
                        const message = {
                            records: [
                                {
                                    recordType: 'mime',
                                    mediaType: this.HALO_MIME_TYPE,
                                    data: new TextEncoder().encode(command),
                                },
                            ],
                        };

                        await reader.write(message);

                        // Read response
                        // In practice, HaLo chip responds with signed data
                        resolve({
                            success: true,
                            data: { method: 'nfc', command },
                        });
                    } catch (error) {
                        resolve({
                            success: false,
                            error: `NFC error: ${error}`,
                        });
                    }
                });

                // Timeout after 5 seconds
                setTimeout(() => {
                    resolve({
                        success: false,
                        error: 'NFC timeout',
                    });
                }, 5000);
            });
        } catch (error) {
            return {
                success: false,
                error: `NFC scan failed: ${error}`,
            };
        }
    }

    /**
     * Execute command via HaLo Gateway (HTTP-based fallback)
     */
    private static async executeViaGateway(
        command: string,
        config?: HaloConfig
    ): Promise<HaloResponse> {
        try {
            // HaLo Gateway endpoint (from demos)
            const gatewayUrl = 'https://gateway.arx.org/api/execute';

            const response = await fetch(gatewayUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    command: command,
                    slot: config?.slot || this.DEFAULT_SLOT,
                }),
            });

            if (!response.ok) {
                throw new Error(`Gateway error: ${response.statusText}`);
            }

            const data = await response.json();

            return {
                success: true,
                data: data,
            };
        } catch (error) {
            return {
                success: false,
                error: `Gateway error: ${error}`,
            };
        }
    }
}

// Type declarations for WebNFC
declare global {
    interface Window {
        NDEFReader: typeof NDEFReader;
    }
}

interface NDEFReader {
    scan(): Promise<void>;
    write(message: NDEFMessage): Promise<void>;
    addEventListener(
        type: 'reading',
        callback: (event: NDEFReadingEvent) => void
    ): void;
}

interface NDEFMessage {
    records: NDEFRecord[];
}

interface NDEFRecord {
    recordType: string;
    mediaType?: string;
    data: Uint8Array;
}

interface NDEFReadingEvent {
    message: NDEFMessage;
}

