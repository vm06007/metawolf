/**
 * HaLo Transaction Authorization UI
 */

export class HaloTransactionUI {
    /**
     * Show transaction authorization prompt with HaLo chip
     */
    static showAuthorizationPrompt(
        transaction: any,
        onApprove: () => Promise<void>,
        onReject: () => void
    ): void {
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
            z-index: 10000;
            color: white;
            padding: 20px;
        `;

        const value = transaction.value
            ? `${(parseInt(transaction.value, 16) / 1e18).toFixed(4)} ETH`
            : '0 ETH';

        overlay.innerHTML = `
            <div style="
                background: #1a1a1a;
                border-radius: 12px;
                padding: 30px;
                max-width: 500px;
                width: 100%;
                max-height: 90vh;
                overflow-y: auto;
            ">
                <h2 style="margin-bottom: 20px; text-align: center;">
                    Authorize with HaLo Chip
                </h2>

                <div style="
                    background: #2a2a2a;
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 20px;
                ">
                    <div style="margin-bottom: 15px;">
                        <strong>To:</strong>
                        <div style="
                            font-family: monospace;
                            font-size: 12px;
                            color: #888;
                            margin-top: 5px;
                            word-break: break-all;
                        ">${transaction.to || 'Contract Creation'}</div>
                    </div>

                    <div style="margin-bottom: 15px;">
                        <strong>Value:</strong>
                        <div style="color: #4f46e5; margin-top: 5px; font-size: 18px;">
                            ${value}
                        </div>
                    </div>

                    ${transaction.data && transaction.data !== '0x' ? `
                        <div>
                            <strong>Data:</strong>
                            <div style="
                                font-family: monospace;
                                font-size: 11px;
                                color: #888;
                                margin-top: 5px;
                                word-break: break-all;
                            ">${transaction.data}</div>
                        </div>
                    ` : ''}
                </div>

                <div style="
                    text-align: center;
                    margin: 30px 0;
                ">
                    <div style="
                        width: 100px;
                        height: 100px;
                        border: 3px solid #4f46e5;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 20px;
                        font-size: 48px;
                        animation: pulse 2s infinite;
                    ">📱</div>
                    <p style="color: #ccc; margin-bottom: 10px;">
                        Tap your HaLo chip to authorize this transaction
                    </p>
                    <p style="color: #666; font-size: 12px;">
                        Make sure your chip is close to your device
                    </p>
                </div>

                <div style="display: flex; gap: 10px;">
                    <button id="reject-tx" style="
                        flex: 1;
                        padding: 14px;
                        background: #ef4444;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 16px;
                        font-weight: 600;
                    ">Reject</button>
                    <button id="approve-tx" style="
                        flex: 1;
                        padding: 14px;
                        background: #4f46e5;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 16px;
                        font-weight: 600;
                    ">Authorize</button>
                </div>
            </div>
            <style>
                @keyframes pulse {
                    0%, 100% {
                        transform: scale(1);
                        opacity: 1;
                    }
                    50% {
                        transform: scale(1.05);
                        opacity: 0.8;
                    }
                }
            </style>
        `;

        document.body.appendChild(overlay);

        let isProcessing = false;

        document.getElementById('approve-tx')?.addEventListener('click', async () => {
            if (isProcessing) return;
            isProcessing = true;

            const button = document.getElementById('approve-tx');
            if (button) {
                button.textContent = 'Signing...';
                (button as HTMLButtonElement).disabled = true;
            }

            try {
                await onApprove();
            } catch (error) {
                console.error('Authorization error:', error);
                alert('Failed to authorize transaction: ' + (error as Error).message);
            } finally {
                overlay.remove();
            }
        });

        document.getElementById('reject-tx')?.addEventListener('click', () => {
            if (isProcessing) return;
            onReject();
            overlay.remove();
        });
    }

    /**
     * Show signing progress
     */
    static showSigningProgress(): () => void {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            color: white;
        `;

        overlay.innerHTML = `
            <div style="text-align: center;">
                <div style="
                    width: 60px;
                    height: 60px;
                    border: 4px solid rgba(255,255,255,0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 20px;
                "></div>
                <h2>Signing with HaLo Chip...</h2>
                <p style="color: #ccc; margin-top: 10px;">Please keep your chip close</p>
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

