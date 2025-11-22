import { formatAddress, getDisplayName } from '../utils/account';
import { ethers } from 'ethers';

export function renderAccountDetailModal(
    account: any,
    onUpdateName: (address: string, name: string) => void,
    onExportPrivateKey: (address: string) => void,
    onDelete: (address: string) => void,
    onClose: () => void,
    visible: boolean,
    isFirstRender: boolean = true
): string {
    if (!visible || !account) return '';

    const displayName = getDisplayName(account);
    const accountType = account.isWatchOnly 
        ? 'Contact (View-Only)' 
        : account.isChipAccount 
        ? 'HaLo Chip Account'
        : account.multisig
        ? `Multisig (${account.multisig.threshold}/${account.multisig.chips.length})`
        : account.haloLinked
        ? 'HaLo Linked'
        : 'Standard Account';

    // Generate QR code data URL (simple approach - in production, use a QR library)
    const qrCodeData = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(account.address)}`;

    return `
        <div class="account-detail-modal-overlay" id="account-detail-overlay" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.4);
            z-index: 1000;
            display: flex;
            align-items: flex-end;
            ${isFirstRender ? 'animation: fadeIn 0.2s;' : ''}
        ">
            <div class="account-detail-modal" style="
                width: 100%;
                max-height: 90%;
                background: var(--r-neutral-bg1);
                border-radius: 16px 16px 0 0;
                padding: 0;
                display: flex;
                flex-direction: column;
                ${isFirstRender ? 'animation: slideUp 0.3s;' : ''}
            ">
                <div style="
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    border-bottom: 1px solid var(--r-neutral-line);
                ">
                    <h3 style="
                        font-size: 20px;
                        font-weight: 500;
                        color: var(--r-neutral-title1);
                        margin: 0;
                    ">Address Detail</h3>
                    <button id="account-detail-close" style="
                        background: none;
                        border: none;
                        cursor: pointer;
                        padding: 4px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                            <path d="M5 5L15 15M15 5L5 15" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
                <div style="
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                ">
                    <div style="
                        background: var(--r-neutral-bg2);
                        border-radius: 12px;
                        padding: 16px;
                        margin-bottom: 16px;
                    ">
                        <div style="margin-bottom: 16px;">
                            <div style="
                                font-size: 12px;
                                color: var(--r-neutral-foot);
                                margin-bottom: 6px;
                            ">Address</div>
                            <div style="
                                display: flex;
                                align-items: center;
                                gap: 8px;
                            ">
                                <span style="
                                    font-family: monospace;
                                    font-size: 14px;
                                    color: var(--r-neutral-title1);
                                    flex: 1;
                                    word-break: break-all;
                                ">${account.address}</span>
                                <button id="copy-address-btn" style="
                                    background: none;
                                    border: none;
                                    padding: 4px;
                                    cursor: pointer;
                                    display: flex;
                                    align-items: center;
                                    color: var(--r-neutral-foot);
                                " title="Copy address">
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                                        <path d="M4.89062 4.38987V2.95301C4.89062 2.46982 5.28232 2.07812 5.76551 2.07812H13.3478C13.831 2.07812 14.2227 2.46982 14.2227 2.95301V10.5353C14.2227 11.0185 13.831 11.4102 13.3478 11.4102H11.8948" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                        <path d="M10.2307 4.57031H2.64832C2.16514 4.57031 1.77344 4.96201 1.77344 5.4452V13.0275C1.77344 13.5107 2.16514 13.9024 2.64832 13.9024H10.2307C10.7138 13.9024 11.1055 13.5107 11.1055 13.0275V5.4452C11.1055 4.96201 10.7138 4.57031 10.2307 4.57031Z" stroke-width="1.5" stroke-linejoin="round"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div style="margin-bottom: 16px;">
                            <div style="
                                font-size: 12px;
                                color: var(--r-neutral-foot);
                                margin-bottom: 6px;
                            ">Address Note</div>
                            <div style="
                                display: flex;
                                align-items: center;
                                gap: 8px;
                            ">
                                <input
                                    type="text"
                                    id="account-name-input"
                                    value="${displayName}"
                                    placeholder="Enter a nickname"
                                    style="
                                        flex: 1;
                                        padding: 8px 12px;
                                        border: 1px solid var(--r-neutral-line);
                                        border-radius: 6px;
                                        font-size: 14px;
                                        background: var(--r-neutral-bg1);
                                        color: var(--r-neutral-title1);
                                        box-sizing: border-box;
                                    "
                                />
                                <button id="save-name-btn" style="
                                    background: none;
                                    border: none;
                                    padding: 4px;
                                    cursor: pointer;
                                    display: flex;
                                    align-items: center;
                                    color: var(--r-neutral-foot);
                                " title="Save name">
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                                        <path d="M13 2L6 9L3 6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div style="margin-bottom: 16px;">
                            <div style="
                                font-size: 12px;
                                color: var(--r-neutral-foot);
                                margin-bottom: 6px;
                            ">Source</div>
                            <div style="
                                display: flex;
                                align-items: center;
                                gap: 6px;
                                font-size: 14px;
                                color: var(--r-neutral-title1);
                            ">
                                ${account.isWatchOnly ? `
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                                        <path d="M8 2C5.79086 2 4 3.79086 4 6C4 8.20914 5.79086 10 8 10C10.2091 10 12 8.20914 12 6C12 3.79086 10.2091 2 8 2Z" stroke-width="1.5"/>
                                        <path d="M2 14C2 11.7909 3.79086 10 6 10H10C12.2091 10 14 11.7909 14 14" stroke-width="1.5" stroke-linecap="round"/>
                                    </svg>
                                    <span>Contact</span>
                                ` : account.isChipAccount ? `
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                                        <rect x="3" y="3" width="10" height="10" rx="2" stroke-width="1.5"/>
                                        <path d="M6 6H10V10H6V6Z" stroke-width="1.5"/>
                                    </svg>
                                    <span>HaLo Chip</span>
                                ` : account.multisig ? `
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                                        <path d="M8 2L2 5L8 8L14 5L8 2Z" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                        <path d="M2 11L8 14L14 11" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                        <path d="M2 8L8 11L14 8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                    <span>Multisig</span>
                                ` : `
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                                        <circle cx="8" cy="8" r="6" stroke-width="1.5"/>
                                    </svg>
                                    <span>Standard</span>
                                `}
                            </div>
                        </div>
                        <div style="margin-bottom: 16px;">
                            <div style="
                                font-size: 12px;
                                color: var(--r-neutral-foot);
                                margin-bottom: 6px;
                            ">QR Code</div>
                            <div style="
                                display: flex;
                                justify-content: center;
                                padding: 12px;
                                background: white;
                                border-radius: 8px;
                            ">
                                <img src="${qrCodeData}" alt="QR Code" style="
                                    width: 150px;
                                    height: 150px;
                                " />
                            </div>
                        </div>
                    </div>
                    ${!account.isWatchOnly ? `
                        <div style="
                            background: var(--r-neutral-bg2);
                            border-radius: 12px;
                            padding: 16px;
                            margin-bottom: 16px;
                        ">
                            <button id="export-private-key-btn" style="
                                width: 100%;
                                padding: 12px;
                                background: var(--r-blue-default);
                                color: white;
                                border: none;
                                border-radius: 8px;
                                font-size: 14px;
                                font-weight: 500;
                                cursor: pointer;
                                transition: opacity 0.2s;
                            " onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                                Export Private Key
                            </button>
                        </div>
                    ` : ''}
                    <div style="
                        background: var(--r-neutral-bg2);
                        border-radius: 12px;
                        padding: 16px;
                    ">
                        <button id="delete-account-btn" style="
                            width: 100%;
                            padding: 12px;
                            background: transparent;
                            color: var(--r-red-default);
                            border: 1px solid var(--r-red-default);
                            border-radius: 8px;
                            font-size: 14px;
                            font-weight: 500;
                            cursor: pointer;
                            transition: background 0.2s;
                        " onmouseover="this.style.background='var(--r-red-light)'" onmouseout="this.style.background='transparent'">
                            Delete Address
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

