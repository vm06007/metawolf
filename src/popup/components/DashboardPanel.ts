export interface PanelItem {
    icon: string;
    label: string;
    id: string;
    badge?: number;
    badgeAlert?: boolean;
}

export const DEFAULT_PANEL_ITEMS: PanelItem[] = [
    { icon: 'send', label: 'Send', id: 'panel-send' },
    { icon: 'receive', label: 'Receive', id: 'panel-receive' },
    { icon: 'swap', label: 'Swap', id: 'panel-swap' },
    { icon: 'bridge', label: 'Bridge', id: 'panel-bridge' },
    { icon: 'transactions', label: 'Transactions', id: 'panel-transactions' },
    { icon: 'approvals', label: 'Approvals', id: 'panel-approvals', badge: 0 },
    { icon: 'settings', label: 'Settings', id: 'panel-settings' },
    { icon: 'nft', label: 'NFT', id: 'panel-nft' },
    { icon: 'eip7702', label: 'EIP-7702', id: 'panel-eip7702' },
];

export function renderDashboardPanel(items: PanelItem[] = DEFAULT_PANEL_ITEMS, isHorizontal: boolean = false): string {
    const itemsHtml = items.map(item => {
        const badgeHtml = item.badge !== undefined && item.badge > 0
            ? `<div class="panel-item-badge ${item.badgeAlert ? 'alert' : ''}">${item.badge}</div>`
            : '';

        const iconSvg = getIconSvg(item.icon);
        const viewBox = '0 0 24 24';

        return `
            <button class="panel-item ${isHorizontal ? 'horizontal' : ''}" id="${item.id}">
                ${badgeHtml}
                <svg class="panel-item-icon icon-${item.icon}" viewBox="${viewBox}" fill="none" stroke="currentColor">
                    ${iconSvg}
                </svg>
                <div class="panel-item-label">${item.label}</div>
            </button>
        `;
    }).join('');

    return `
        <div class="dashboard-panel ${isHorizontal ? 'horizontal' : ''}">
            ${itemsHtml}
        </div>
    `;
}

function getIconSvg(iconName: string): string {
    const icons: Record<string, string> = {
        send: '<path d="M21.667 1.99707L10.575 13.0891" stroke="#4C65FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M21.6674 2.00586L14.6088 22.1732L10.5753 13.0979L1.5 9.06444L21.6674 2.00586Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
        receive: '<path d="M2.44214 8.83105V21.4349C2.44214 22.0219 2.91805 22.4978 3.50511 22.4978H20.6645C21.2516 22.4978 21.7275 22.0219 21.7275 21.4349V8.83105" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="bevel"/><path d="M16.7901 13.3125L12.0068 18.0959L7.22339 13.3125" stroke="#4C65FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.0093 1.99707L12.0093 17.4861" stroke="#4C65FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
        swap: '<path d="M2.4187 9.85352H21.5773" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.4187 14.8965H21.5773" stroke="#4C65FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M21.5787 9.85094L14.1282 2.40039" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.86925 22.347L2.4187 14.8965" stroke="#4C65FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
        bridge: '<path d="M12.592 2.414c5.535.28 9.937 4.859 9.937 10.464l-.014.539a10.471 10.471 0 01-.3 2.015h-2.078a8.478 8.478 0 10-16.17 0H1.89a10.465 10.465 0 01-.301-2.015l-.014-.54c0-5.785 4.691-10.476 10.478-10.477l.539.014z" fill="currentColor"/><circle cx="3.001" cy="16.497" r="2.5" fill="#4C65FF"/><circle cx="21.002" cy="16.497" r="2.5" fill="#4C65FF"/>',
        transactions: '<g clip-path="url(#clip0_135415_1240)"><path d="M12.6665 22.333C18.2821 22.333 22.8345 17.7807 22.8345 12.165C22.8345 6.54942 18.2821 1.99707 12.6665 1.99707C7.05089 1.99707 2.49854 6.54942 2.49854 12.165C2.49854 17.7807 7.05089 22.333 12.6665 22.333Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12.6661 6.06543L12.6655 12.1707L16.9764 16.4816" stroke="#4C65FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g><defs><clipPath id="clip0_135415_1240"><rect width="24" height="24" fill="white"/></clipPath></defs>',
        approvals: '<path d="M2.5 3.82007L12.0045 1L21.5 3.82007V9.60334C21.5 15.682 17.6737 21.0785 12.0014 23C6.3275 21.0785 2.5 15.6808 2.5 9.60066V3.82007Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8.46057 12.4969L7.09862 7.96987L11.6256 6.60792" stroke="#4C65FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.6353 15.2048C14.3753 11.8446 13.5352 9.74446 7.65479 8.48438" stroke="#4C65FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
        settings: '<path d="M9.1419 22C7.46635 21.481 5.9749 20.5175 4.79393 19.2408C5.2345 18.6976 5.5 17.9957 5.5 17.2293C5.5 15.5056 4.15685 14.1082 2.5 14.1082C2.39977 14.1082 2.3007 14.1134 2.203 14.1234C2.0699 13.4464 2 12.7455 2 12.0275C2 10.94 2.16039 9.89149 2.4579 8.90611C2.47191 8.90632 2.48594 8.90642 2.5 8.90642C4.15685 8.90642 5.5 7.50906 5.5 5.78534C5.5 5.29049 5.3893 4.82259 5.1923 4.40686C6.34875 3.28816 7.76025 2.45093 9.32605 2C9.8222 3.01178 10.8333 3.70463 12 3.70463C13.1667 3.70463 14.1778 3.01178 14.674 2C16.2398 2.45093 17.6512 3.28816 18.8077 4.40686C18.6107 4.82259 18.5 5.29049 18.5 5.78534C18.5 7.50906 19.8432 8.90642 21.5 8.90642C21.5141 8.90642 21.5281 8.90632 21.5421 8.90611C21.8396 9.89149 22 10.94 22 12.0275C22 12.7455 21.9301 13.4464 21.797 14.1234C21.6993 14.1134 21.6002 14.1082 21.5 14.1082C19.8432 14.1082 18.5 15.5056 18.5 17.2293C18.5 17.9957 18.7655 18.6976 19.2061 19.2408C18.0251 20.5175 16.5336 21.481 14.8581 22C14.4714 20.7415 13.338 19.8302 12 19.8302C10.662 19.8302 9.5286 20.7415 9.1419 22Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="#4C65FF" stroke-width="2" stroke-linejoin="round"/>',
        nft: '<path d="M21 19.2002L16.2146 14.9567L9.36014 15.8432L5.8321 13.2002L1.80005 15.8432" stroke="#4C65FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.0687 21.6004H3.93139C2.75915 21.6004 1.80005 20.6327 1.80005 19.45V4.55079C1.80005 3.36807 2.75915 2.40039 3.93139 2.40039H20.0687C21.2409 2.40039 22.2 3.36807 22.2 4.55079V19.45C22.2 20.6327 21.2409 21.6004 20.0687 21.6004Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16.8 6C16.3226 6 15.8648 6.18964 15.5272 6.52721C15.1896 6.86477 15 7.32261 15 7.8C15 8.27739 15.1896 8.73523 15.5272 9.07279C15.8648 9.41036 16.3226 9.6 16.8 9.6C17.2774 9.6 17.7352 9.41036 18.0728 9.07279C18.4104 8.73523 18.6 8.27739 18.6 7.8C18.6 7.32261 18.4104 6.86477 18.0728 6.52721C17.7352 6.18964 17.2774 6 16.8 6Z" fill="#4C65FF"/>',
        eip7702: '<path d="M11.336 10.887a3.743 3.743 0 100-7.487 3.743 3.743 0 000 7.487z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.253 13.538c-.103.58.018 1.272.185 1.998-.995 0-1.725.006-2.309.054-.65.053-1.033.153-1.326.303a3.278 3.278 0 00-1.432 1.432c-.15.293-.25.675-.303 1.326-.049.596-.052 1.344-.053 2.37h6.018c.12.87.379 1.54.935 2H3.013a1 1 0 01-1-1v-.641c0-1.181 0-2.127.062-2.89.063-.776.196-1.451.513-2.073a5.278 5.278 0 012.307-2.307c.622-.317 1.297-.45 2.072-.513.629-.052 1.381-.057 2.286-.059z" fill="currentColor"/><path d="M6.678 14.553h6.926M5.402 22.025h6.66" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.848 13.626l1.244-1.106a.58.58 0 01.384-.141c.144 0 .282.05.384.141l1.403 1.248c.101.09.159.213.159.34 0 .128-.058.251-.16.341l-1.244 1.107m-2.17-1.93l-5.267 4.682a.457.457 0 00-.16.341v1.248c0 .128.058.25.16.34.101.091.24.142.383.142h1.403a.58.58 0 00.384-.141l5.268-4.682m-2.171-1.93l2.17 1.93" stroke="#4C65FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    };

    return icons[iconName] || icons.settings;
}

