export interface ReceiveScreenProps {
    address: string;
    accountName: string;
    balance: string;
    chainName?: string;
    onBack: () => void;
    onCopyAddress: () => void;
    hideBalance?: boolean;
    onToggleVisibility?: () => void;
}

export function renderReceiveScreen(props: ReceiveScreenProps): string {
    const { address, accountName, balance, chainName = 'Ethereum', onBack, onCopyAddress, hideBalance = false } = props;
    const displayBalance = hideBalance ? '***' : `$${balance}`;

    return `
        <div class="receive-screen">
            <div class="receive-nav">
                <div class="receive-nav-left" id="receive-back-btn">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12.5 15L7.5 10L12.5 5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="receive-nav-content">
                    <div class="receive-account">
                        <div class="receive-account-icon">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <circle cx="10" cy="10" r="10" fill="rgba(255,255,255,0.2)"/>
                                <circle cx="10" cy="10" r="6" fill="rgba(255,255,255,0.5)"/>
                            </svg>
                        </div>
                        <div class="receive-account-content">
                            <div class="receive-account-row">
                                <div class="receive-account-name" title="${accountName}">${accountName}</div>
                                <div class="receive-account-balance" title="${hideBalance ? 'Balance hidden' : `$${balance}`}">${displayBalance}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="receive-nav-right" id="receive-toggle-visibility-btn">
                    ${hideBalance ? `
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.5 10C2.5 10 5.5 4.5 10 4.5C14.5 4.5 17.5 10 17.5 10C17.5 10 14.5 15.5 10 15.5C5.5 15.5 2.5 10 2.5 10Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M12.5 10C12.5 11.3807 11.3807 12.5 10 12.5C8.61929 12.5 7.5 11.3807 7.5 10C7.5 8.61929 8.61929 7.5 10 7.5C11.3807 7.5 12.5 8.61929 12.5 10Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M3.75 3.75L16.25 16.25" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    ` : `
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 3C6 3 2.73 5.11 1 8.5C2.73 11.89 6 14 10 14C14 14 17.27 11.89 19 8.5C17.27 5.11 14 3 10 3ZM10 12.5C7.52 12.5 5.5 10.48 5.5 8C5.5 5.52 7.52 3.5 10 3.5C12.48 3.5 14.5 5.52 14.5 8C14.5 10.48 12.48 12.5 10 12.5ZM10 5.5C8.62 5.5 7.5 6.62 7.5 8C7.5 9.38 8.62 10.5 10 10.5C11.38 10.5 12.5 9.38 12.5 8C12.5 6.62 11.38 5.5 10 5.5Z" fill="white" fill-opacity="0.9"/>
                    </svg>
                    `}
                </div>
            </div>

            <div class="receive-qr-card">
                <div class="receive-qr-card-header">Receive assets on ${chainName}</div>
                <div class="receive-qr-card-img" id="receive-qr-container">
                    <canvas id="receive-qr-canvas" width="200" height="200"></canvas>
                    <div class="receive-qr-logo-overlay" id="receive-qr-logo-overlay" style="display: none;">
                        <img src="${chrome.runtime.getURL('popup/wolfy-logo.png')}" alt="Wolfy" class="receive-qr-logo"
                            onerror="this.parentElement.style.display='none';">
                    </div>
                </div>
                <div class="receive-qr-card-address" id="receive-address-display">${address}</div>
                <button type="button" class="receive-qr-card-btn" id="receive-copy-btn">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4.89062 4.38987V2.95301C4.89062 2.46982 5.28232 2.07812 5.76551 2.07812H13.3478C13.831 2.07812 14.2227 2.46982 14.2227 2.95301V10.5353C14.2227 11.0185 13.831 11.4102 13.3478 11.4102H11.8948" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M10.2307 4.57031H2.64832C2.16514 4.57031 1.77344 4.96201 1.77344 5.4452V13.0275C1.77344 13.5107 2.16514 13.9024 2.64832 13.9024H10.2307C10.7138 13.9024 11.1055 13.5107 11.1055 13.0275V5.4452C11.1055 4.96201 10.7138 4.57031 10.2307 4.57031Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                    </svg>
                    Copy address
                </button>
            </div>
        </div>
    `;
}

/**
 * Initialize QR code rendering for the receive screen
 * This needs to be called after the HTML is inserted into the DOM
 */
export async function initReceiveScreenQRCode(address: string): Promise<void> {
    const container = document.getElementById('receive-qr-container');
    const canvas = document.getElementById('receive-qr-canvas') as HTMLCanvasElement;

    if (!container || !canvas) {
        console.error('[ReceiveScreen] Container or canvas not found');
        return;
    }

    try {
        // Try to use bundled qrcode library
        const QRCodeModule = await import('qrcode' as any);

        // qrcode library exports toCanvas as a named export
        const toCanvas = QRCodeModule.toCanvas || (QRCodeModule.default && QRCodeModule.default.toCanvas);

        if (toCanvas && typeof toCanvas === 'function') {
            await toCanvas(canvas, address, {
                width: 200,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                },
                errorCorrectionLevel: 'M' // Medium error correction for logo overlay
            });
            console.log('[ReceiveScreen] QR code generated successfully');

            // Add logo overlay after QR code is generated
            addLogoOverlay(container);
        } else {
            throw new Error('QRCode.toCanvas not available');
        }
    } catch (error: any) {
        console.error('[ReceiveScreen] Error generating QR code:', error);

        // Fallback: Try CDN
        try {
            await loadQRCodeLibrary();
            if ((window as any).QRCode) {
                (window as any).QRCode.toCanvas(
                    canvas,
                    address,
                    { width: 200, margin: 2, errorCorrectionLevel: 'M' },
                    (cdnError: any) => {
                        if (cdnError) {
                            console.error('[ReceiveScreen] CDN QR code generation error:', cdnError);
                            showQRCodeError(container);
                        } else {
                            // Add logo overlay after QR code is generated
                            addLogoOverlay(container);
                        }
                    }
                );
            } else {
                showQRCodeError(container);
            }
        } catch (cdnError) {
            console.error('[ReceiveScreen] Failed to load QR code from CDN:', cdnError);
            showQRCodeError(container);
        }
    }
}

/**
 * Add logo overlay in the center of QR code
 */
function addLogoOverlay(container: HTMLElement): void {
    // Logo overlay should already be in the HTML, just ensure it's visible
    const overlay = document.getElementById('receive-qr-logo-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
    }
}

/**
 * Show error placeholder for QR code
 */
function showQRCodeError(container: HTMLElement): void {
    container.innerHTML = `
        <div style="width: 200px; height: 200px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border-radius: 8px;">
            <div style="text-align: center; color: #999; font-size: 12px;">
                QR Code<br/>Error
            </div>
        </div>
    `;
}

/**
 * Load QR code library from CDN as fallback
 */
function loadQRCodeLibrary(): Promise<void> {
    return new Promise((resolve, reject) => {
        if ((window as any).QRCode) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load QR code library from CDN'));
        document.head.appendChild(script);
    });
}

