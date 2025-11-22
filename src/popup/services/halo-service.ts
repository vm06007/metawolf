import { sendMessageWithRetry } from '../utils/messaging';
import { ethers } from 'ethers';

export class HaloService {
    async addChipAccount(name?: string): Promise<any> {
        try {
            // Show linking progress UI
            let HaloUI: any;
            let removeProgress: () => void = () => { };
            let qrCodeUI: { remove: () => void; updateStatus: (status: string) => void } | null = null;
            let removeWaiting: () => void = () => { };

            try {
                const haloModule = await import('../halo-ui.js');
                HaloUI = haloModule.HaloUI;
                removeProgress = HaloUI.showLinkingProgress();
            } catch (error) {
                console.warn('Could not load HaloUI, using simple prompts:', error);
            }

            try {
                const { LibHaLoAdapter } = await import('../../halo/libhalo-adapter.js');
                const gate = await LibHaLoAdapter.createGateway();
                if (!gate) {
                    throw new Error('Failed to initialize HaLo Gateway. Please reload the extension.');
                }

                removeProgress();

                // Start pairing to get QR code
                const pairInfo = await gate.startPairing();

                // Show QR code
                if (HaloUI) {
                    qrCodeUI = HaloUI.showQRCode(pairInfo.qrCode, pairInfo.execURL, async () => {
                        try {
                            await gate.close();
                        } catch (e) {
                            // Ignore
                        }
                        if (qrCodeUI) qrCodeUI.remove();
                        if (removeWaiting) removeWaiting();
                    });
                }

                if (qrCodeUI) {
                    qrCodeUI.updateStatus('Waiting for phone to scan QR code...');
                }

                // Wait for phone to connect
                await gate.waitConnected();

                if (qrCodeUI) {
                    qrCodeUI.updateStatus('Phone connected! Tap your HaLo chip to your phone when prompted...');
                }

                if (qrCodeUI) {
                    qrCodeUI.remove();
                    qrCodeUI = null;
                }

                if (HaloUI) {
                    removeWaiting = HaloUI.showWaitingForConnection();
                }

                // Get key info from chip
                const cmd = {
                    name: 'get_key_info',
                    keyNo: 1,
                };

                const result = await gate.execHaloCmd(cmd);
                await gate.close();

                if (removeWaiting) removeWaiting();

                if (!result || !result.publicKey) {
                    throw new Error('Failed to read key info from HaLo chip');
                }

                // Derive address from public key
                const publicKey = result.publicKey;
                let chipAddress = result.address || ethers.computeAddress('0x' + publicKey);

                // Create account from chip
                const response = await sendMessageWithRetry({
                    type: 'CREATE_ACCOUNT_FROM_CHIP',
                    chipAddress: chipAddress,
                    chipPublicKey: publicKey,
                    slot: 1,
                    name: name || undefined,
                }, 5, 3000);

                if (!response || !response.success) {
                    throw new Error(response?.error || 'Failed to create account from chip');
                }

                return {
                    success: true,
                    account: response.account,
                    chipAddress: chipAddress,
                };
            } catch (error: any) {
                if (removeProgress) removeProgress();
                if (qrCodeUI) qrCodeUI.remove();
                if (removeWaiting) removeWaiting();
                throw error;
            }
        } catch (error: any) {
            console.error('Error adding chip account:', error);
            throw error;
        }
    }

    async scanChip(chipNumber: number, totalChips: number): Promise<any> {
        let HaloUI: any;
        let removeProgress: () => void = () => { };
        let qrCodeUI: { remove: () => void; updateStatus: (status: string) => void } | null = null;
        let removeWaiting: () => void = () => { };

        try {
            const haloModule = await import('../halo-ui.js');
            HaloUI = haloModule.HaloUI;
        } catch (error) {
            console.warn('Could not load HaloUI:', error);
        }

        if (HaloUI) {
            removeProgress = HaloUI.showLinkingProgress();
        }

        try {
            const { LibHaLoAdapter } = await import('../../halo/libhalo-adapter.js');
            const gate = await LibHaLoAdapter.createGateway();
            if (!gate) {
                throw new Error('Failed to initialize HaLo Gateway');
            }

            removeProgress();

            const pairInfo = await gate.startPairing();

            if (HaloUI) {
                qrCodeUI = HaloUI.showQRCode(pairInfo.qrCode, pairInfo.execURL);
            }

            if (qrCodeUI) {
                qrCodeUI.updateStatus(`Waiting for chip ${chipNumber}...`);
            }

            await gate.waitConnected();

            if (qrCodeUI) {
                qrCodeUI.remove();
                qrCodeUI = null;
            }

            if (HaloUI) {
                removeWaiting = HaloUI.showWaitingForConnection();
            }

            const result = await gate.execHaloCmd({
                name: 'get_key_info',
                keyNo: 1,
            });

            await gate.close();

            if (removeWaiting) removeWaiting();

            if (!result || !result.publicKey) {
                throw new Error(`Failed to read chip ${chipNumber}`);
            }

            const publicKey = result.publicKey;
            const chipAddress = result.address || ethers.computeAddress('0x' + publicKey);

            return {
                address: chipAddress.toLowerCase(),
                publicKey: publicKey,
                slot: 1,
                name: `Chip ${chipNumber}`,
                linkedAt: Date.now(),
            };
        } catch (error: any) {
            if (removeProgress) removeProgress();
            if (qrCodeUI) qrCodeUI.remove();
            if (removeWaiting) removeWaiting();
            throw error;
        }
    }

    async createMultisigAccount(numChips: number, threshold: number, name?: string): Promise<any> {
        const chips: any[] = [];

        // Scan each chip
        for (let i = 0; i < numChips; i++) {
            alert(`Scan chip ${i + 1} of ${numChips}\n\nTap your HaLo chip when the QR code appears.`);

            try {
                const chipInfo = await this.scanChip(i + 1, numChips);
                chips.push(chipInfo);
                alert(`✅ Chip ${i + 1} scanned!\nAddress: ${chipInfo.address}`);
            } catch (error: any) {
                throw new Error(`Failed to scan chip ${i + 1}: ${error.message}`);
            }
        }

        // Create multisig account
        const response = await sendMessageWithRetry({
            type: 'CREATE_MULTISIG_ACCOUNT',
            chips: chips,
            threshold: threshold,
            name: name || undefined,
        }, 5, 3000);

        if (!response || !response.success) {
            throw new Error(response?.error || 'Failed to create multisig account');
        }

        return response;
    }

    async linkAccount(address: string, deletePrivateKey: boolean): Promise<any> {
        // Show linking progress UI
        let HaloUI: any;
        let removeProgress: () => void = () => { };
        let qrCodeUI: { remove: () => void; updateStatus: (status: string) => void } | null = null;
        let removeWaiting: () => void = () => { };

        try {
            const haloModule = await import('../halo-ui.js');
            HaloUI = haloModule.HaloUI;
            removeProgress = HaloUI.showLinkingProgress();
        } catch (error) {
            console.warn('Could not load HaloUI, using simple prompts:', error);
        }

        try {
            const { LibHaLoAdapter } = await import('../../halo/libhalo-adapter.js');
            const gate = await LibHaLoAdapter.createGateway();
            if (!gate) {
                throw new Error('Failed to initialize HaLo Gateway. Please reload the extension.');
            }

            removeProgress();

            // Start pairing to get QR code
            const pairInfo = await gate.startPairing();

            // Show QR code
            if (HaloUI) {
                qrCodeUI = HaloUI.showQRCode(pairInfo.qrCode, pairInfo.execURL, async () => {
                    try {
                        await gate.close();
                    } catch (e) {
                        // Ignore
                    }
                    if (qrCodeUI) qrCodeUI.remove();
                    if (removeWaiting) removeWaiting();
                });
            } else {
                const proceed = confirm(`Please scan this URL with your phone:\n${pairInfo.execURL}\n\nThen tap your HaLo chip.`);
                if (!proceed) {
                    await gate.close();
                    return;
                }
            }

            if (qrCodeUI) {
                qrCodeUI.updateStatus('Waiting for phone to scan QR code...');
            }

            // Wait for phone to connect
            await gate.waitConnected();

            if (qrCodeUI) {
                qrCodeUI.updateStatus('Phone connected! Tap your HaLo chip to your phone when prompted...');
            }

            if (qrCodeUI) {
                qrCodeUI.remove();
                qrCodeUI = null;
            }

            if (HaloUI) {
                removeWaiting = HaloUI.showWaitingForConnection();
            }

            // Get key info from chip
            let result: any = null;
            try {
                result = await gate.execHaloCmd({ name: 'get_key_info', keyNo: 1 });
            } catch (err1: any) {
                try {
                    result = await gate.execHaloCmd({ name: 'get_key_info', slot: 1 });
                } catch (err2: any) {
                    result = await gate.execHaloCmd({ keyNo: 1 });
                }
            }

            await gate.close();

            if (removeWaiting) removeWaiting();

            if (!result || !result.publicKey) {
                throw new Error('Failed to read key info from HaLo chip');
            }

            // Extract address and public key
            const publicKey = result.publicKey;
            const chipAddress = result.address || ethers.computeAddress('0x' + publicKey);

            // Link the account
            const response = await sendMessageWithRetry({
                type: 'HALO_LINK_ACCOUNT',
                address: address,
                slot: 1,
                keyInfo: {
                    address: chipAddress,
                    publicKey: publicKey,
                    slot: 1,
                },
                deletePrivateKey: deletePrivateKey,
            }, 5, 3000);

            if (!response || !response.success) {
                throw new Error(response?.error || 'Failed to link account');
            }

            return {
                ...response,
                chipAddress: chipAddress,
            };
        } catch (error: any) {
            if (removeProgress) removeProgress();
            if (qrCodeUI) qrCodeUI.remove();
            if (removeWaiting) removeWaiting();
            throw error;
        }
    }

    async createAccountFromChip(chipAddress: string, chipPublicKey: string, slot: number, name?: string): Promise<any> {
        const response = await sendMessageWithRetry({
            type: 'CREATE_ACCOUNT_FROM_CHIP',
            chipAddress: chipAddress,
            chipPublicKey: chipPublicKey,
            slot: slot,
            name: name || undefined,
        });
        if (!response || !response.success) {
            throw new Error(response?.error || 'Failed to create account from chip');
        }
        return response;
    }

    computeAddressFromPublicKey(publicKey: string): string {
        return ethers.computeAddress('0x' + publicKey);
    }
}
