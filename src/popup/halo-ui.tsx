/**
 * HaLo Chip UI Components
 */

export class HaloUI {
    /**
     * Show NFC permission request dialog
     */
    static async requestNFCPermission(): Promise<boolean> {
        return new Promise((resolve) => {
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            `;

            dialog.innerHTML = `
                <div style="
                    background: white;
                    padding: 30px;
                    border-radius: 12px;
                    max-width: 400px;
                    text-align: center;
                ">
                    <h2 style="margin-bottom: 15px;">NFC Permission Required</h2>
                    <p style="margin-bottom: 20px; color: #666;">
                        Please allow NFC access to communicate with your HaLo chip.
                    </p>
                    <button id="allow-nfc" style="
                        padding: 12px 24px;
                        background: #4f46e5;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        margin-right: 10px;
                    ">Allow NFC</button>
                    <button id="cancel-nfc" style="
                        padding: 12px 24px;
                        background: #f3f4f6;
                        color: #333;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                    ">Cancel</button>
                </div>
            `;

            document.body.appendChild(dialog);

            document.getElementById('allow-nfc')?.addEventListener('click', async () => {
                try {
                    const granted = await (window as any).requestNFCPermission?.();
                    dialog.remove();
                    resolve(granted || false);
                } catch (error) {
                    dialog.remove();
                    resolve(false);
                }
            });

            document.getElementById('cancel-nfc')?.addEventListener('click', () => {
                dialog.remove();
                resolve(false);
            });
        });
    }

    /**
     * Show HaLo chip tap prompt
     */
    static showTapPrompt(message: string = 'Tap your HaLo chip'): () => void {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            color: white;
        `;

        overlay.innerHTML = `
            <div style="
                text-align: center;
                animation: pulse 2s infinite;
            ">
                <div style="
                    width: 120px;
                    height: 120px;
                    border: 4px solid white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 20px;
                    font-size: 48px;
                ">📱</div>
                <h2 style="margin-bottom: 10px;">${message}</h2>
                <p style="color: #ccc;">Bring your HaLo chip close to your device</p>
            </div>
            <style>
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
            </style>
        `;

        document.body.appendChild(overlay);

        return () => overlay.remove();
    }

    /**
     * Show linking progress
     */
    static showLinkingProgress(): () => void {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            color: white;
        `;

        overlay.innerHTML = `
            <div style="text-align: center;">
                <div class="spinner" style="
                    width: 50px;
                    height: 50px;
                    border: 4px solid rgba(255,255,255,0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 20px;
                "></div>
                <h2>Linking HaLo Chip...</h2>
                <p style="color: #ccc; margin-top: 10px;">Preparing connection...</p>
            </div>
            <style>
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            </style>
        `;

        document.body.appendChild(overlay);

        return () => overlay.remove();
    }

    /**
     * Show QR code for phone scanning
     */
    static showQRCode(
        qrCode: string,
        execURL: string,
        onCancel?: () => void
    ): { remove: () => void; updateStatus: (status: string) => void } {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.9);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            color: white;
            padding: 20px;
        `;

        overlay.innerHTML = `
            <div style="
                background: #1a1a1a;
                border-radius: 12px;
                padding: 30px;
                max-width: 400px;
                width: 100%;
                text-align: center;
            ">
                <h2 style="margin-bottom: 20px;">Scan QR Code with Phone</h2>
                <p id="qr-status" style="color: #ccc; margin-bottom: 20px; font-size: 14px;">
                    Scan this QR code with your smartphone to connect your HaLo chip
                </p>
                <div style="
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    display: inline-block;
                ">
                    <img src="${qrCode}" alt="QR Code" style="
                        max-width: 300px;
                        width: 100%;
                        height: auto;
                        display: block;
                    " />
                </div>
                <p style="color: #666; font-size: 12px; margin-bottom: 20px; word-break: break-all;">
                    ${execURL}
                </p>
                <p style="color: #888; font-size: 12px; margin-bottom: 20px;">
                    After scanning, tap your HaLo chip to your phone when prompted
                </p>
                <button id="cancel-qr" style="
                    padding: 12px 24px;
                    background: #ef4444;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                ">Cancel</button>
            </div>
        `;

        document.body.appendChild(overlay);

        const cancelBtn = overlay.querySelector('#cancel-qr');
        cancelBtn?.addEventListener('click', () => {
            if (onCancel) {
                onCancel();
            }
            overlay.remove();
        });

        const statusEl = overlay.querySelector('#qr-status');
        
        return {
            remove: () => overlay.remove(),
            updateStatus: (status: string) => {
                if (statusEl) {
                    statusEl.textContent = status;
                }
            }
        };
    }

    /**
     * Show waiting for phone connection
     */
    static showWaitingForConnection(): () => void {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 10002;
            color: white;
        `;

        overlay.innerHTML = `
            <div style="text-align: center;">
                <div class="spinner" style="
                    width: 50px;
                    height: 50px;
                    border: 4px solid rgba(255,255,255,0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 20px;
                "></div>
                <h2>Waiting for Phone Connection...</h2>
                <p style="color: #ccc; margin-top: 10px;">
                    Please scan the QR code and tap your HaLo chip
                </p>
            </div>
            <style>
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            </style>
        `;

        document.body.appendChild(overlay);

        return () => overlay.remove();
    }
}

