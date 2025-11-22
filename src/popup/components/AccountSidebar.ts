import { formatAddress, getDisplayName } from '../utils/account';

export function renderAccountSidebar(
    accounts: any[],
    selectedAccount: any,
    onSelectAccount: (account: any) => void,
    onAddWallet: () => void,
    onDeleteAccount?: (account: any) => void,
    onToggleCollapse?: () => void,
    isCollapsed?: boolean
): string {
    const accountsHtml = accounts.map(account => {
        const isSelected = selectedAccount?.address?.toLowerCase() === account.address?.toLowerCase();
        const displayName = getDisplayName(account);

        // Account type badges
        let typeBadge = '';
        if (account.isChipAccount) {
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
                                opacity: 0;
                                margin-left: auto;
                            "
                            onmouseenter="this.style.color='var(--r-red-default)'; this.style.background='var(--r-red-light)'; this.style.opacity='1'"
                            onmouseleave="this.style.color='var(--r-neutral-foot)'; this.style.background='transparent'; this.style.opacity='0'">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor">
                            <path d="M10 4L4 10M4 4L10 10" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                ` : ''}
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

