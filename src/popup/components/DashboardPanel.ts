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
    { icon: 'ecology', label: 'Ecology', id: 'panel-ecology' },
];

export function renderDashboardPanel(items: PanelItem[] = DEFAULT_PANEL_ITEMS, isHorizontal: boolean = false): string {
    const itemsHtml = items.map(item => {
        const badgeHtml = item.badge !== undefined && item.badge > 0
            ? `<div class="panel-item-badge ${item.badgeAlert ? 'alert' : ''}">${item.badge}</div>`
            : '';

        const iconSvg = getIconSvg(item.icon);
        const viewBox = item.icon === 'ecology' ? '0 0 28 28' : '0 0 24 24';

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
        bridge: '<path d="M12.5916 2.41406C18.1271 2.69487 22.5291 7.27256 22.5291 12.8779L22.5154 13.417C22.4803 14.1084 22.3783 14.782 22.2156 15.4316H20.1375C20.3918 14.6257 20.529 13.7679 20.5291 12.8779C20.5291 8.19634 16.734 4.40065 12.0525 4.40039C7.37093 4.40062 3.57495 8.19632 3.57495 12.8779C3.57501 13.7679 3.71313 14.6257 3.96753 15.4316H1.89038C1.72759 14.7819 1.62371 14.1085 1.58862 13.417L1.57495 12.8779C1.57495 7.09175 6.26637 2.40062 12.0525 2.40039L12.5916 2.41406Z" fill="currentColor"/><circle cx="3.00146" cy="16.4971" r="2.5" fill="#4C65FF"/><circle cx="21.0015" cy="16.4971" r="2.5" fill="#4C65FF"/>',
        transactions: '<g clip-path="url(#clip0_135415_1240)"><path d="M12.6665 22.333C18.2821 22.333 22.8345 17.7807 22.8345 12.165C22.8345 6.54942 18.2821 1.99707 12.6665 1.99707C7.05089 1.99707 2.49854 6.54942 2.49854 12.165C2.49854 17.7807 7.05089 22.333 12.6665 22.333Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12.6661 6.06543L12.6655 12.1707L16.9764 16.4816" stroke="#4C65FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g><defs><clipPath id="clip0_135415_1240"><rect width="24" height="24" fill="white"/></clipPath></defs>',
        approvals: '<path d="M2.5 3.82007L12.0045 1L21.5 3.82007V9.60334C21.5 15.682 17.6737 21.0785 12.0014 23C6.3275 21.0785 2.5 15.6808 2.5 9.60066V3.82007Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8.46057 12.4969L7.09862 7.96987L11.6256 6.60792" stroke="#4C65FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.6353 15.2048C14.3753 11.8446 13.5352 9.74446 7.65479 8.48438" stroke="#4C65FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
        settings: '<path d="M9.1419 22C7.46635 21.481 5.9749 20.5175 4.79393 19.2408C5.2345 18.6976 5.5 17.9957 5.5 17.2293C5.5 15.5056 4.15685 14.1082 2.5 14.1082C2.39977 14.1082 2.3007 14.1134 2.203 14.1234C2.0699 13.4464 2 12.7455 2 12.0275C2 10.94 2.16039 9.89149 2.4579 8.90611C2.47191 8.90632 2.48594 8.90642 2.5 8.90642C4.15685 8.90642 5.5 7.50906 5.5 5.78534C5.5 5.29049 5.3893 4.82259 5.1923 4.40686C6.34875 3.28816 7.76025 2.45093 9.32605 2C9.8222 3.01178 10.8333 3.70463 12 3.70463C13.1667 3.70463 14.1778 3.01178 14.674 2C16.2398 2.45093 17.6512 3.28816 18.8077 4.40686C18.6107 4.82259 18.5 5.29049 18.5 5.78534C18.5 7.50906 19.8432 8.90642 21.5 8.90642C21.5141 8.90642 21.5281 8.90632 21.5421 8.90611C21.8396 9.89149 22 10.94 22 12.0275C22 12.7455 21.9301 13.4464 21.797 14.1234C21.6993 14.1134 21.6002 14.1082 21.5 14.1082C19.8432 14.1082 18.5 15.5056 18.5 17.2293C18.5 17.9957 18.7655 18.6976 19.2061 19.2408C18.0251 20.5175 16.5336 21.481 14.8581 22C14.4714 20.7415 13.338 19.8302 12 19.8302C10.662 19.8302 9.5286 20.7415 9.1419 22Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="#4C65FF" stroke-width="2" stroke-linejoin="round"/>',
        nft: '<path d="M21 19.2002L16.2146 14.9567L9.36014 15.8432L5.8321 13.2002L1.80005 15.8432" stroke="#4C65FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.0687 21.6004H3.93139C2.75915 21.6004 1.80005 20.6327 1.80005 19.45V4.55079C1.80005 3.36807 2.75915 2.40039 3.93139 2.40039H20.0687C21.2409 2.40039 22.2 3.36807 22.2 4.55079V19.45C22.2 20.6327 21.2409 21.6004 20.0687 21.6004Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16.8 6C16.3226 6 15.8648 6.18964 15.5272 6.52721C15.1896 6.86477 15 7.32261 15 7.8C15 8.27739 15.1896 8.73523 15.5272 9.07279C15.8648 9.41036 16.3226 9.6 16.8 9.6C17.2774 9.6 17.7352 9.41036 18.0728 9.07279C18.4104 8.73523 18.6 8.27739 18.6 7.8C18.6 7.32261 18.4104 6.86477 18.0728 6.52721C17.7352 6.18964 17.2774 6 16.8 6Z" fill="#4C65FF"/>',
        ecology: '<g clip-path="url(#clip0_102521_117004)"><path d="M22.8605 16.0096C25.8402 18.767 27.4704 21.1684 26.8802 22.3292C25.9117 24.2122 19.3621 21.9951 12.2483 17.3793C5.13713 12.7634 0.152804 7.49493 1.12003 5.61324C1.72325 4.43961 4.92393 5.04061 8.66413 6.65146" stroke="url(#paint0_linear_102521_117004)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 14C5 15.1819 5.23279 16.3522 5.68508 17.4442C6.13738 18.5361 6.80031 19.5282 7.63604 20.364C8.47177 21.1997 9.46392 21.8626 10.5558 22.3149C11.6478 22.7672 12.8181 23 14 23C15.1819 23 16.3522 22.7672 17.4442 22.3149C18.5361 21.8626 19.5282 21.1997 20.364 20.364C21.1997 19.5282 21.8626 18.5361 22.3149 17.4442C22.7672 16.3522 23 15.1819 23 14C23 12.8181 22.7672 11.6478 22.3149 10.5558C21.8626 9.46392 21.1997 8.47177 20.364 7.63604C19.5282 6.80031 18.5361 6.13738 17.4442 5.68508C16.3522 5.23279 15.1819 5 14 5C12.8181 5 11.6478 5.23279 10.5558 5.68508C9.46392 6.13738 8.47177 6.80031 7.63604 7.63604C6.80031 8.47177 6.13738 9.46392 5.68508 10.5558C5.23279 11.6478 5 12.8181 5 14Z" stroke="var(--r-neutral-title1, #192945)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><mask id="mask0_102521_117004" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="4" y="4" width="20" height="20"><path d="M5 14C5 15.1819 5.23279 16.3522 5.68508 17.4442C6.13738 18.5361 6.80031 19.5282 7.63604 20.364C8.47177 21.1997 9.46392 21.8626 10.5558 22.3149C11.6478 22.7672 12.8181 23 14 23C15.1819 23 16.3522 22.7672 17.4442 22.3149C18.5361 21.8626 19.5282 21.1997 20.364 20.364C21.1997 19.5282 21.8626 18.5361 22.3149 17.4442C22.7672 16.3522 23 15.1819 23 14C23 12.8181 22.7672 11.6478 22.3149 10.5558C21.8626 9.46392 21.1997 8.47177 20.364 7.63604C19.5282 6.80031 18.5361 6.13738 17.4442 5.68508C16.3522 5.23279 15.1819 5 14 5C12.8181 5 11.6478 5.23279 10.5558 5.68508C9.46392 6.13738 8.47177 6.80031 7.63604 7.63604C6.80031 8.47177 6.13738 9.46392 5.68508 10.5558C5.23279 11.6478 5 12.8181 5 14Z" stroke="var(--r-neutral-title1, #192945)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></mask><g mask="url(#mask0_102521_117004)"><path d="M26.8802 14.4984C29.8599 17.2558 27.4704 21.1669 26.8802 22.3276C25.9117 24.2106 19.3621 21.9936 12.2483 17.3777C5.13714 12.7618 0.152804 7.49338 1.12003 5.61169C1.72325 4.43805 4.2598 0.387598 8 1.99845" stroke="url(#paint1_linear_102521_117004)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></g><path d="M3.40667 21.2427C3.43954 21.1572 3.56046 21.1572 3.59334 21.2427L4.2042 22.8309C4.3029 23.0875 4.35225 23.2158 4.42897 23.3238C4.49701 23.4194 4.58059 23.503 4.67624 23.571C4.78418 23.6478 4.91249 23.6971 5.16912 23.7958L6.75733 24.4067C6.8428 24.4395 6.8428 24.5605 6.75733 24.5933L5.16912 25.2042C4.91249 25.3029 4.78418 25.3522 4.67624 25.429C4.58059 25.497 4.49701 25.5806 4.42897 25.6762C4.35225 25.7842 4.3029 25.9125 4.2042 26.1691L3.59334 27.7573C3.56046 27.8428 3.43954 27.8428 3.40667 27.7573L2.79581 26.1691C2.69711 25.9125 2.64776 25.7842 2.57101 25.6762C2.50299 25.5806 2.41942 25.497 2.32376 25.429C2.21583 25.3522 2.08751 25.3029 1.83088 25.2042L0.242666 24.5933C0.157197 24.5605 0.157198 24.4395 0.242667 24.4067L1.83088 23.7958C2.08751 23.6971 2.21583 23.6478 2.32376 23.571C2.41942 23.503 2.50299 23.4194 2.57101 23.3238C2.64776 23.2158 2.69711 23.0875 2.79581 22.8309L3.40667 21.2427Z" fill="url(#paint2_linear_102521_117004)"/><path d="M23.9067 0.242667C23.9395 0.157198 24.0605 0.157197 24.0933 0.242666L24.8048 2.09244C24.9176 2.38573 24.974 2.53237 25.0617 2.65572C25.1394 2.76505 25.235 2.86056 25.3443 2.9383C25.4676 3.02601 25.6143 3.08241 25.9076 3.19522L27.7573 3.90667C27.8428 3.93954 27.8428 4.06046 27.7573 4.09334L25.9076 4.8048C25.6143 4.9176 25.4676 4.974 25.3443 5.06168C25.235 5.13944 25.1394 5.23496 25.0617 5.34428C24.974 5.46764 24.9176 5.61428 24.8048 5.90756L24.0933 7.75733C24.0605 7.8428 23.9395 7.8428 23.9067 7.75733L23.1952 5.90756C23.0824 5.61428 23.026 5.46764 22.9383 5.34428C22.8606 5.23496 22.765 5.13944 22.6557 5.06168C22.5324 4.974 22.3857 4.9176 22.0924 4.8048L20.2427 4.09334C20.1572 4.06046 20.1572 3.93954 20.2427 3.90667L22.0924 3.19522C22.3857 3.08241 22.5324 3.02601 22.6557 2.9383C22.765 2.86056 22.8606 2.76505 22.9383 2.65572C23.026 2.53237 23.0824 2.38572 23.1952 2.09243L23.9067 0.242667Z" fill="url(#paint3_linear_102521_117004)"/></g><defs><linearGradient id="paint0_linear_102521_117004" x1="1.48878" y1="4.94269" x2="28.0683" y2="24.8944" gradientUnits="userSpaceOnUse"><stop stop-color="#4EAE77"/><stop offset="1" stop-color="#DE7652"/></linearGradient><linearGradient id="paint1_linear_102521_117004" x1="1.48878" y1="4.94114" x2="28.0683" y2="24.8929" gradientUnits="userSpaceOnUse"><stop stop-color="#4EAE77"/><stop offset="1" stop-color="#DE7652"/></linearGradient><linearGradient id="paint2_linear_102521_117004" x1="0.875" y1="21.875" x2="5.25" y2="26.25" gradientUnits="userSpaceOnUse"><stop stop-color="#4FAE78"/><stop offset="1" stop-color="#D47B56"/></linearGradient><linearGradient id="paint3_linear_102521_117004" x1="21" y1="1" x2="26" y2="6" gradientUnits="userSpaceOnUse"><stop stop-color="#4FAE78"/><stop offset="1" stop-color="#D47B56"/></linearGradient><clipPath id="clip0_102521_117004"><rect width="28" height="28" fill="white"/></clipPath></defs>',
    };

    return icons[iconName] || icons.settings;
}

