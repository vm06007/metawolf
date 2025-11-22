/**
 * Parallel Multisig Scanning Component
 * Shows 2 QR codes side-by-side in expanded view for parallel chip scanning
 */

export interface ParallelScanState {
    chip1: {
        status: 'pending' | 'scanning' | 'connected' | 'done' | 'error';
        qrCode?: string;
        execURL?: string;
        chipInfo?: any;
        gate?: any;
    };
    chip2: {
        status: 'pending' | 'scanning' | 'connected' | 'done' | 'error';
        qrCode?: string;
        execURL?: string;
        chipInfo?: any;
        gate?: any;
    };
}

export function renderParallelMultisigScan(
    state: ParallelScanState,
    onChip1Scanned: (chipInfo: any) => void,
    onChip2Scanned: (chipInfo: any) => void,
    onCancel: () => void,
    visible: boolean
): string {
    if (!visible) return '';

    const chip1Status = state.chip1.status;
    const chip2Status = state.chip2.status;
    const bothDone = chip1Status === 'done' && chip2Status === 'done';

    return `
        <div class="parallel-scan-overlay" id="parallel-scan-overlay" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.9);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.2s;
        ">
            <div class="parallel-scan-container" style="
                width: 90%;
                max-width: 1200px;
                background: var(--r-neutral-bg1);
                border-radius: 16px;
                padding: 32px;
                display: flex;
                flex-direction: column;
                gap: 24px;
            ">
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                ">
                    <h2 style="
                        font-size: 24px;
                        font-weight: 600;
                        color: var(--r-neutral-title1);
                        margin: 0;
                    ">Scan Your Halo Chips</h2>
                    <button id="parallel-scan-cancel" style="
                        padding: 8px 16px;
                        border: 1px solid var(--r-neutral-line);
                        border-radius: 8px;
                        background: var(--r-neutral-card1);
                        color: var(--r-neutral-title1);
                        font-size: 14px;
                        cursor: pointer;
                    ">Cancel</button>
                </div>
                
                <p style="
                    color: var(--r-neutral-body);
                    font-size: 14px;
                    margin: 0 0 24px 0;
                    text-align: center;
                ">Scan both QR codes with your phones in parallel. Once both chips are scanned, the multisig will be deployed automatically.</p>
                
                <div class="parallel-scan-grid" style="
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 24px;
                    min-height: 500px;
                ">
                    <!-- Chip 1 -->
                    <div class="chip-scan-panel" id="chip1-panel" style="
                        background: var(--r-neutral-card1);
                        border: 2px solid ${chip1Status === 'done' ? 'var(--r-green-default)' : chip1Status === 'error' ? 'var(--r-red-default)' : 'var(--r-neutral-line)'};
                        border-radius: 12px;
                        padding: 24px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 16px;
                        position: relative;
                    ">
                        <div style="
                            position: absolute;
                            top: 12px;
                            right: 12px;
                            width: 24px;
                            height: 24px;
                            border-radius: 50%;
                            background: ${chip1Status === 'done' ? 'var(--r-green-default)' : chip1Status === 'error' ? 'var(--r-red-default)' : 'var(--r-neutral-line)'};
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-size: 12px;
                            font-weight: bold;
                        ">
                            ${chip1Status === 'done' ? '✓' : chip1Status === 'error' ? '✕' : '1'}
                        </div>
                        
                        <h3 style="
                            font-size: 18px;
                            font-weight: 500;
                            color: var(--r-neutral-title1);
                            margin: 0;
                        ">Chip 1</h3>
                        
                        ${chip1Status === 'pending' ? `
                            <div style="
                                padding: 40px;
                                text-align: center;
                                color: var(--r-neutral-foot);
                            ">
                                <div style="font-size: 48px; margin-bottom: 16px;">⏳</div>
                                <div>Waiting to start...</div>
                            </div>
                        ` : chip1Status === 'scanning' && state.chip1.qrCode ? `
                            <div style="
                                background: white;
                                padding: 20px;
                                border-radius: 8px;
                                margin-bottom: 12px;
                            ">
                                <img src="${state.chip1.qrCode}" alt="QR Code 1" style="
                                    width: 100%;
                                    max-width: 300px;
                                    height: auto;
                                    display: block;
                                " />
                            </div>
                            <p style="
                                color: var(--r-neutral-body);
                                font-size: 13px;
                                text-align: center;
                                margin: 0;
                                word-break: break-all;
                            ">${state.chip1.execURL || ''}</p>
                            <p style="
                                color: var(--r-neutral-foot);
                                font-size: 12px;
                                text-align: center;
                                margin: 0;
                            ">Scan with your phone, then tap your chip</p>
                        ` : chip1Status === 'connected' ? `
                            <div style="
                                padding: 40px;
                                text-align: center;
                                color: var(--r-blue-default);
                            ">
                                <div style="font-size: 48px; margin-bottom: 16px;">📱</div>
                                <div>Phone connected!<br/>Tap your chip now...</div>
                            </div>
                        ` : chip1Status === 'done' ? `
                            <div style="
                                padding: 40px;
                                text-align: center;
                                color: var(--r-green-default);
                            ">
                                <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
                                <div style="font-weight: 500; margin-bottom: 8px;">Chip 1 Scanned!</div>
                                <div style="font-size: 12px; color: var(--r-neutral-foot); word-break: break-all;">
                                    ${state.chip1.chipInfo?.address ? state.chip1.chipInfo.address.slice(0, 6) + '...' + state.chip1.chipInfo.address.slice(-4) : ''}
                                </div>
                            </div>
                        ` : chip1Status === 'error' ? `
                            <div style="
                                padding: 40px;
                                text-align: center;
                                color: var(--r-red-default);
                            ">
                                <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
                                <div>Error scanning chip</div>
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- Chip 2 -->
                    <div class="chip-scan-panel" id="chip2-panel" style="
                        background: var(--r-neutral-card1);
                        border: 2px solid ${chip2Status === 'done' ? 'var(--r-green-default)' : chip2Status === 'error' ? 'var(--r-red-default)' : 'var(--r-neutral-line)'};
                        border-radius: 12px;
                        padding: 24px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 16px;
                        position: relative;
                    ">
                        <div style="
                            position: absolute;
                            top: 12px;
                            right: 12px;
                            width: 24px;
                            height: 24px;
                            border-radius: 50%;
                            background: ${chip2Status === 'done' ? 'var(--r-green-default)' : chip2Status === 'error' ? 'var(--r-red-default)' : 'var(--r-neutral-line)'};
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-size: 12px;
                            font-weight: bold;
                        ">
                            ${chip2Status === 'done' ? '✓' : chip2Status === 'error' ? '✕' : '2'}
                        </div>
                        
                        <h3 style="
                            font-size: 18px;
                            font-weight: 500;
                            color: var(--r-neutral-title1);
                            margin: 0;
                        ">Chip 2</h3>
                        
                        ${chip2Status === 'pending' ? `
                            <div style="
                                padding: 40px;
                                text-align: center;
                                color: var(--r-neutral-foot);
                            ">
                                <div style="font-size: 48px; margin-bottom: 16px;">⏳</div>
                                <div>Waiting to start...</div>
                            </div>
                        ` : chip2Status === 'scanning' && state.chip2.qrCode ? `
                            <div style="
                                background: white;
                                padding: 20px;
                                border-radius: 8px;
                                margin-bottom: 12px;
                            ">
                                <img src="${state.chip2.qrCode}" alt="QR Code 2" style="
                                    width: 100%;
                                    max-width: 300px;
                                    height: auto;
                                    display: block;
                                " />
                            </div>
                            <p style="
                                color: var(--r-neutral-body);
                                font-size: 13px;
                                text-align: center;
                                margin: 0;
                                word-break: break-all;
                            ">${state.chip2.execURL || ''}</p>
                            <p style="
                                color: var(--r-neutral-foot);
                                font-size: 12px;
                                text-align: center;
                                margin: 0;
                            ">Scan with your phone, then tap your chip</p>
                        ` : chip2Status === 'connected' ? `
                            <div style="
                                padding: 40px;
                                text-align: center;
                                color: var(--r-blue-default);
                            ">
                                <div style="font-size: 48px; margin-bottom: 16px;">📱</div>
                                <div>Phone connected!<br/>Tap your chip now...</div>
                            </div>
                        ` : chip2Status === 'done' ? `
                            <div style="
                                padding: 40px;
                                text-align: center;
                                color: var(--r-green-default);
                            ">
                                <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
                                <div style="font-weight: 500; margin-bottom: 8px;">Chip 2 Scanned!</div>
                                <div style="font-size: 12px; color: var(--r-neutral-foot); word-break: break-all;">
                                    ${state.chip2.chipInfo?.address ? state.chip2.chipInfo.address.slice(0, 6) + '...' + state.chip2.chipInfo.address.slice(-4) : ''}
                                </div>
                            </div>
                        ` : chip2Status === 'error' ? `
                            <div style="
                                padding: 40px;
                                text-align: center;
                                color: var(--r-red-default);
                            ">
                                <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
                                <div>Error scanning chip</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                ${bothDone ? `
                    <div style="
                        padding: 16px;
                        background: var(--r-green-light);
                        border-radius: 8px;
                        text-align: center;
                        color: var(--r-green-default);
                        font-weight: 500;
                    ">
                        ✅ Both chips scanned! Deploying multisig contract...
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

