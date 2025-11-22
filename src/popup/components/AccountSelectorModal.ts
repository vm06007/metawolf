import { formatAddress, getDisplayName } from '../utils/account';

export function renderAccountSelectorModal(
    accounts: any[],
    selectedAccount: any,
    onSelectAccount: (account: any) => void,
    onClose: () => void,
    visible: boolean,
    onDeleteAccount?: (account: any) => void
): string {
    if (!visible) return '';

    const accountsHtml = accounts.map(account => {
        const isSelected = selectedAccount?.address?.toLowerCase() === account.address?.toLowerCase();
        const displayName = getDisplayName(account);
        
        // Account type badges
        let typeBadge = '';
        if (account.isWatchOnly) {
            typeBadge = '<span style="font-size: 11px; color: var(--r-neutral-foot); margin-left: 6px;">👁️ View-Only</span>';
        } else if (account.isChipAccount) {
            typeBadge = '<span style="font-size: 11px; color: var(--r-green-default); margin-left: 6px;">🔒 Chip</span>';
        } else if (account.multisig) {
            typeBadge = `<span style="font-size: 11px; color: var(--r-blue-default); margin-left: 6px;">🔐 Multisig (${account.multisig.threshold}/${account.multisig.chips.length})</span>`;
        } else if (account.haloLinked) {
            typeBadge = '<span style="font-size: 11px; color: var(--r-green-default); margin-left: 6px;">HaLo</span>';
        }
        
        const canDelete = accounts.length > 1; // Can't delete if it's the last account
        
        return `
            <div class="account-selector-item ${isSelected ? 'selected' : ''}" 
                 data-address="${account.address}"
                 style="
                     padding: 12px 16px;
                     border-bottom: 1px solid var(--r-neutral-line);
                     cursor: pointer;
                     display: flex;
                     align-items: center;
                     gap: 12px;
                     transition: background 0.2s;
                     position: relative;
                 "
                 onmouseenter="this.style.background='var(--r-blue-light1)'"
                 onmouseleave="this.style.background='${isSelected ? 'var(--r-blue-light1)' : 'transparent'}'">
                ${isSelected ? `
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style="flex-shrink: 0;">
                        <circle cx="10" cy="10" r="10" fill="var(--r-blue-default)"/>
                        <path d="M6 10L9 13L14 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                ` : `
                    <div class="account-icon-small" style="
                        width: 20px;
                        height: 20px;
                        border-radius: 50%;
                        background: rgba(76, 101, 255, 0.1);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                    ">
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                            <circle cx="10" cy="10" r="10" fill="rgba(76, 101, 255, 0.2)"/>
                            <circle cx="10" cy="10" r="6" fill="rgba(76, 101, 255, 0.5)"/>
                        </svg>
                    </div>
                `}
                <div style="flex: 1; min-width: 0;" onclick="event.stopPropagation();">
                    <div style="
                        font-size: 15px;
                        font-weight: 500;
                        color: var(--r-neutral-title1);
                        margin-bottom: 4px;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        display: flex;
                        align-items: center;
                    ">
                        <span style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis;">${displayName}</span>
                        ${typeBadge}
                    </div>
                    <div style="
                        font-size: 12px;
                        color: var(--r-neutral-foot);
                        font-family: monospace;
                    ">${formatAddress(account.address)}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                    ${canDelete && onDeleteAccount ? `
                        <button class="account-delete-btn" 
                                data-address="${account.address}"
                                onclick="event.stopPropagation();"
                                style="
                                    background: none;
                                    border: none;
                                    padding: 4px;
                                    cursor: pointer;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    color: var(--r-neutral-foot);
                                    transition: color 0.2s;
                                    border-radius: 4px;
                                "
                                onmouseenter="this.style.color='var(--r-red-default)'; this.style.background='var(--r-red-light)'"
                                onmouseleave="this.style.color='var(--r-neutral-foot)'; this.style.background='transparent'"
                                title="Delete account">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                                <path d="M4 4L12 12M12 4L4 12" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="account-selector-modal-overlay" id="account-selector-overlay" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.4);
            z-index: 1000;
            display: flex;
            align-items: flex-end;
            animation: fadeIn 0.2s;
        ">
            <div class="account-selector-modal" style="
                width: 100%;
                max-height: 80%;
                background: var(--r-neutral-bg1);
                border-radius: 16px 16px 0 0;
                padding: 20px 0 0 0;
                display: flex;
                flex-direction: column;
                animation: slideUp 0.3s;
            ">
                <div style="
                    padding: 0 20px 16px 20px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    border-bottom: 1px solid var(--r-neutral-line);
                    background: var(--r-neutral-bg2);
                ">
                    <h3 style="
                        font-size: 20px;
                        font-weight: 500;
                        color: var(--r-neutral-title1);
                        margin: 0;
                    ">Select Account</h3>
                    <button id="account-selector-close" style="
                        background: none;
                        border: none;
                        cursor: pointer;
                        padding: 4px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: var(--r-neutral-foot);
                    ">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                            <path d="M5 5L15 15M15 5L5 15" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
                <div style="
                    flex: 1;
                    overflow-y: auto;
                    padding: 0;
                    background: var(--r-neutral-bg1);
                ">
                    ${accountsHtml || '<div style="padding: 40px; text-align: center; color: var(--r-neutral-foot);">No accounts found</div>'}
                </div>
            </div>
        </div>
    `;
}

