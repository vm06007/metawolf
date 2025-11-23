export interface AddWalletOption {
    id: string;
    label: string;
    icon: string;
    description?: string;
}

export const ADD_WALLET_OPTIONS: AddWalletOption[] = [
    {
        id: 'create-account',
        label: 'Create New Account',
        icon: 'create',
        description: 'Generate a new wallet with seed phrase',
    },
    {
        id: 'import-private-key',
        label: 'Import Private Key',
        icon: 'key',
        description: 'Import an existing wallet using private key',
    },
    {
        id: 'add-halo-chip',
        label: 'Add HaLo Chip Account',
        icon: 'chip',
        description: 'Create account from HaLo chip (hardware wallet)',
    },
    {
        id: 'add-firefly-wallet',
        label: 'Add Firefly Wallet',
        icon: 'firefly',
        description: 'Connect and create account from Firefly hardware wallet',
    },
    {
        id: 'create-multisig',
        label: 'Create Multisig (2-3 Chips)',
        icon: 'multisig',
        description: 'Create multisig wallet requiring multiple chip signatures',
    },
    {
        id: 'add-contact',
        label: 'Add Contacts',
        icon: 'contact',
        description: 'Add a view-only address to watch portfolio (cannot sign)',
    },
];

export function renderAddWalletModal(
    options: AddWalletOption[] = ADD_WALLET_OPTIONS,
    onSelect: (optionId: string) => void,
    onClose: () => void,
    visible: boolean
): string {
    if (!visible) return '';

    const optionsHtml = options.map(option => {
        const iconSvg = getOptionIcon(option.icon);
        
        return `
            <div class="add-wallet-option" 
                 data-option-id="${option.id}"
                 style="
                     padding: 16px;
                     border-bottom: 1px solid var(--r-neutral-line);
                     cursor: pointer;
                     display: flex;
                     align-items: center;
                     gap: 16px;
                     transition: background 0.2s;
                 "
                 onmouseover="this.style.background='var(--r-blue-light1)'"
                 onmouseout="this.style.background='transparent'">
                <div style="
                    width: 40px;
                    height: 40px;
                    border-radius: 8px;
                    background: var(--r-blue-light1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                ">
                    ${iconSvg}
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="
                        font-size: 15px;
                        font-weight: 500;
                        color: var(--r-neutral-title1);
                        margin-bottom: 4px;
                    ">${option.label}</div>
                    ${option.description ? `
                        <div style="
                            font-size: 12px;
                            color: var(--r-neutral-foot);
                        ">${option.description}</div>
                    ` : ''}
                </div>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" style="flex-shrink: 0; color: var(--r-neutral-foot);">
                    <path d="M6 4L10 8L6 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
        `;
    }).join('');

    return `
        <div class="add-wallet-modal-overlay" id="add-wallet-overlay" style="
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
            <div class="add-wallet-modal" style="
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
                ">
                    <h3 style="
                        font-size: 20px;
                        font-weight: 500;
                        color: var(--r-neutral-title1);
                        margin: 0;
                    ">Add Wallet</h3>
                    <button id="add-wallet-close" style="
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
                    padding: 0;
                ">
                    ${optionsHtml}
                </div>
            </div>
        </div>
    `;
}

function getOptionIcon(iconType: string): string {
    const icons: Record<string, string> = {
        create: `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 2V22M2 12H22" stroke-width="2" stroke-linecap="round"/>
            </svg>
        `,
        key: `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M17 8L19 10M21 2L20 3L19 2L20 1L21 2Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="8" cy="16" r="3" stroke-width="2"/>
                <path d="M11 16L21 6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `,
        chip: `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2"/>
                <path d="M9 9H15V15H9V9Z" stroke-width="2"/>
                <path d="M3 12H9M15 12H21" stroke-width="2" stroke-linecap="round"/>
                <path d="M12 3V9M12 15V21" stroke-width="2" stroke-linecap="round"/>
            </svg>
        `,
        multisig: `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `,
        contact: `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="12" cy="7" r="4" stroke-width="2"/>
            </svg>
        `,
        firefly: `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="5" y="7" width="14" height="10" rx="1.5" stroke-width="2"/>
                <path d="M9 7V17M15 7V17" stroke-width="1.5" stroke-linecap="round"/>
                <circle cx="12" cy="12" r="2" stroke-width="2" fill="currentColor" fill-opacity="0.15"/>
                <path d="M12 3L9 4.5L12 6L15 4.5L12 3Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 18L9 19.5L12 21L15 19.5L12 18Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `,
    };

    return icons[iconType] || icons.create;
}

