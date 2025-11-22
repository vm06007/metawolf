import { formatAddress } from '../../popup/utils/account';
import { loadEthers } from '../ethers-loader';

export interface SignatureRequest {
    id: string;
    message?: string;
    typedData?: any;
    address: string;
    origin: string;
    dappName: string;
    dappIcon: string;
    isTypedData?: boolean;
}

/**
 * Decode hex message to readable text
 */
async function decodeMessage(message: string): Promise<string> {
    try {
        // If it's hex, try to decode it
        if (message.startsWith('0x')) {
            try {
                const ethersModule = await loadEthers();
                const ethers = ethersModule.ethers || ethersModule.default || ethersModule;
                return ethers.toUtf8String(message);
            } catch {
                // If UTF-8 decode fails, return hex representation
                return message;
            }
        }
        return message;
    } catch {
        return message;
    }
}

/**
 * Format typed data for display
 */
function formatTypedData(typedData: any): string {
    try {
        if (typeof typedData === 'string') {
            return typedData;
        }
        // Format EIP-712 typed data
        if (typedData.domain) {
            const domain = typedData.domain;
            const message = typedData.message || {};
            return JSON.stringify({
                domain: {
                    name: domain.name,
                    version: domain.version,
                    chainId: domain.chainId,
                    verifyingContract: domain.verifyingContract,
                },
                message: message,
            }, null, 2);
        }
        return JSON.stringify(typedData, null, 2);
    } catch {
        return JSON.stringify(typedData);
    }
}

export async function renderSignatureModal(
    request: SignatureRequest,
    onApprove: () => void,
    onReject: () => void
): Promise<string> {
    const isTypedData = request.isTypedData || false;
    const messageContent = isTypedData 
        ? formatTypedData(request.typedData)
        : await decodeMessage(request.message || '');
    
    const displayMessage = isTypedData
        ? messageContent
        : (messageContent.length > 200 
            ? messageContent.substring(0, 200) + '...' 
            : messageContent);

    return `
        <div class="signature-modal-container" style="
            width: 100%;
            height: 100vh;
            display: flex;
            flex-direction: column;
            background: var(--r-neutral-bg2);
            overflow: hidden;
        ">
            <div style="
                padding: 20px 24px;
                background: var(--r-neutral-bg1);
                border-bottom: 1px solid var(--r-neutral-line);
            ">
                <h2 style="
                    font-size: 18px;
                    font-weight: 500;
                    color: var(--r-neutral-title1);
                    margin: 0;
                ">Sign Message</h2>
            </div>

            <div style="
                flex: 1;
                overflow-y: auto;
                padding: 20px 24px;
            ">
                <div style="
                    background: var(--r-neutral-card1);
                    border-radius: 8px;
                    padding: 22px;
                    margin-bottom: 20px;
                ">
                    <div style="
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        padding-bottom: 20px;
                        border-bottom: 0.5px solid var(--r-neutral-line);
                    ">
                        <div style="
                            width: 44px;
                            height: 44px;
                            border-radius: 8px;
                            margin-bottom: 8px;
                            overflow: hidden;
                            background: var(--r-neutral-bg2);
                        ">
                            <img src="${request.dappIcon}" 
                                 alt="${request.dappName}"
                                 style="width: 100%; height: 100%; object-fit: cover;"
                                 onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--r-blue-light1);color:var(--r-blue-default);font-weight:500;\\'>${request.dappName.charAt(0).toUpperCase()}</div>'">
                        </div>
                        <p style="
                            font-size: 16px;
                            font-weight: 500;
                            color: var(--r-neutral-title1);
                            margin: 8px 0 0 0;
                            text-align: center;
                            word-wrap: break-word;
                            max-width: 100%;
                        ">${request.dappName}</p>
                        <p style="
                            font-size: 13px;
                            color: var(--r-neutral-foot);
                            margin: 4px 0 0 0;
                            text-align: center;
                            word-wrap: break-word;
                            max-width: 100%;
                        ">${request.origin}</p>
                    </div>
                </div>

                <div style="
                    background: var(--r-neutral-card1);
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 20px;
                ">
                    <div style="
                        font-size: 14px;
                        color: var(--r-neutral-body);
                        margin-bottom: 12px;
                        font-weight: 500;
                    ">Signing Address</div>
                    <div style="
                        font-size: 15px;
                        color: var(--r-neutral-title1);
                        font-family: monospace;
                        word-break: break-all;
                    ">${formatAddress(request.address)}</div>
                </div>

                <div style="
                    background: var(--r-neutral-card1);
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 20px;
                ">
                    <div style="
                        font-size: 14px;
                        color: var(--r-neutral-body);
                        margin-bottom: 12px;
                        font-weight: 500;
                    ">${isTypedData ? 'Typed Data' : 'Message'}</div>
                    <div style="
                        background: var(--r-neutral-bg2);
                        border-radius: 6px;
                        padding: 12px;
                        max-height: 200px;
                        overflow-y: auto;
                        font-size: 13px;
                        color: var(--r-neutral-title1);
                        font-family: monospace;
                        white-space: pre-wrap;
                        word-break: break-all;
                        line-height: 1.5;
                    ">${displayMessage}</div>
                    ${messageContent.length > 200 && !isTypedData ? `
                        <div style="
                            font-size: 12px;
                            color: var(--r-neutral-foot);
                            margin-top: 8px;
                            text-align: center;
                        ">Message truncated for display</div>
                    ` : ''}
                </div>

                <div style="
                    background: var(--r-yellow-light1);
                    border: 1px solid var(--r-yellow-default);
                    border-radius: 8px;
                    padding: 12px;
                    font-size: 13px;
                    color: var(--r-neutral-title1);
                    line-height: 1.5;
                ">
                    <div style="
                        display: flex;
                        align-items: flex-start;
                        gap: 8px;
                    ">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink: 0; margin-top: 2px;">
                            <path d="M8 1L15 14H1L8 1Z" fill="var(--r-yellow-default)"/>
                            <path d="M8 6V10M8 12V12.01" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                        <div>
                            <strong>Warning:</strong> Only sign messages from sites you trust. Signing a malicious message can lead to loss of funds.
                        </div>
                    </div>
                </div>
            </div>

            <div style="
                padding: 20px 24px;
                background: var(--r-neutral-bg1);
                border-top: 1px solid var(--r-neutral-line);
            ">
                <div style="
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                ">
                    <button id="approve-signature-btn" style="
                        width: 100%;
                        padding: 14px;
                        background: var(--r-blue-default);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: background 0.2s;
                    ">Sign</button>
                    <button id="reject-signature-btn" style="
                        width: 100%;
                        padding: 14px;
                        background: var(--r-neutral-card1);
                        color: var(--r-neutral-title1);
                        border: 1px solid var(--r-neutral-line);
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: background 0.2s;
                    ">Reject</button>
                </div>
            </div>
        </div>
    `;
}

