import { formatAddress, getDisplayName } from '../utils/account';

export function renderAccountSidebar(
    accounts: any[],
    selectedAccount: any,
    onSelectAccount: (account: any) => void,
    onAddWallet: () => void,
    onDeleteAccount?: (account: any) => void,
    onToggleCollapse?: () => void,
    isCollapsed?: boolean,
    onEditAccount?: (account: any) => void
): string {
    const accountsHtml = accounts.map(account => {
        const isSelected = selectedAccount?.address?.toLowerCase() === account.address?.toLowerCase();
        const displayName = getDisplayName(account);

        // Account type badges
        let typeBadge = '';
        if (account.isWatchOnly) {
            typeBadge = '<span class="account-type-badge watch-only">👁️ View-Only</span>';
        } else if (account.isChipAccount) {
            typeBadge = '<span class="account-type-badge chip">🔒 Chip</span>';
        } else if (account.multisig) {
            typeBadge = `<span class="account-type-badge multisig">🔐 Multisig (${account.multisig.threshold}/${account.multisig.chips.length})</span>`;
        } else if (account.haloLinked) {
            typeBadge = '<span class="account-type-badge halo">HaLo</span>';
        }

        const canDelete = accounts.length > 1; // Can't delete if it's the last account

        return `
            <div class="account-sidebar-item ${isSelected ? 'selected' : ''}"
                 data-address="${account.address}">
                ${isSelected ? `
                    <svg class="account-selected-indicator" width="20" height="20" viewBox="0 0 20 20" fill="none" style="flex-shrink: 0;">
                        <circle cx="10" cy="10" r="10" fill="var(--r-blue-default)"/>
                        <path d="M6 10L9 13L14 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                ` : `
                    <div class="account-icon-small">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <circle cx="10" cy="10" r="10" fill="rgba(76, 101, 255, 0.2)"/>
                            <circle cx="10" cy="10" r="6" fill="rgba(76, 101, 255, 0.5)"/>
                        </svg>
                    </div>
                `}
                <div class="account-sidebar-info">
                    <div class="account-sidebar-name">
                        <span class="account-name-text">${displayName}</span>
                        ${typeBadge}
                    </div>
                    <div class="account-sidebar-address">${formatAddress(account.address)}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 4px; margin-left: auto; opacity: 0;" 
                     class="account-sidebar-actions"
                     onmouseenter="this.style.opacity='1'"
                     onmouseleave="this.style.opacity='0'">
                    ${onEditAccount ? `
                        <button class="account-sidebar-edit-btn"
                                data-address="${account.address}"
                                onclick="event.stopPropagation();"
                                title="Edit account"
                                style="
                                    background: none;
                                    border: none;
                                    padding: 4px;
                                    cursor: pointer;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    color: var(--r-neutral-foot);
                                    transition: all 0.2s;
                                    border-radius: 4px;
                                "
                                onmouseenter="this.style.color='var(--r-blue-default)'; this.style.background='var(--r-blue-light1)'"
                                onmouseleave="this.style.color='var(--r-neutral-foot)'; this.style.background='transparent'">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor">
                                <path d="M9.91667 2.33333C10.0333 2.21667 10.175 2.12833 10.3333 2.075C10.4917 2.02167 10.6583 2.005 10.8233 2.02667C10.9883 2.04833 11.1475 2.10833 11.2883 2.20167C11.4292 2.295 11.5483 2.41917 11.6375 2.565C11.7267 2.71083 11.7833 2.87417 11.8033 3.04333C11.8233 3.2125 11.8067 3.38333 11.7542 3.545C11.7017 3.70667 11.6142 3.855 11.4975 3.98L5.3975 10.08L2.33333 11.14L3.39333 8.07583L9.49333 1.97583L9.91667 2.33333Z" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    ` : ''}
                    ${canDelete && onDeleteAccount ? `
                        <button class="account-sidebar-delete-btn"
                                data-address="${account.address}"
                                onclick="event.stopPropagation();"
                                title="Delete account"
                                style="
                                    background: none;
                                    border: none;
                                    padding: 4px;
                                    cursor: pointer;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    color: var(--r-neutral-foot);
                                    transition: all 0.2s;
                                    border-radius: 4px;
                                "
                                onmouseenter="this.style.color='var(--r-red-default)'; this.style.background='var(--r-red-light)'"
                                onmouseleave="this.style.color='var(--r-neutral-foot)'; this.style.background='transparent'">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor">
                                <path d="M10 4L4 10M4 4L10 10" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="account-sidebar ${isCollapsed ? 'collapsed' : ''}">
            <div class="account-sidebar-header">
                <h3 class="account-sidebar-title">Accounts</h3>
                <div class="account-sidebar-header-actions">
                    ${onToggleCollapse ? `
                        <button class="account-sidebar-collapse-btn" id="sidebar-collapse-btn" title="${isCollapsed ? 'Expand' : 'Collapse'}">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                                ${isCollapsed ? `
                                    <path d="M6 4L10 8L6 12" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                ` : `
                                    <path d="M10 4L6 8L10 12" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                `}
                            </svg>
                        </button>
                    ` : ''}
                    <button class="account-sidebar-add-btn" id="sidebar-add-wallet-btn" title="Add Wallet">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                            <circle cx="8" cy="8" r="7" stroke-width="1.5"/>
                            <path d="M8 4V12M4 8H12" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
            </div>
            ${!isCollapsed ? `
                <div class="account-sidebar-list">
                    ${accountsHtml || '<div class="account-sidebar-empty">No accounts found</div>'}
                </div>
            ` : ''}
        </div>
    `;
}

