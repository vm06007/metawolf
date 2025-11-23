import { getChainColoredLogo } from '../utils/chain-icons';

export interface NetworkOption {
    chainId: number;
    name: string;
    logo?: string;
}

export function renderNetworkSelectorModal(
    networks: NetworkOption[],
    currentChainId: number,
    onSelect: (chainId: number) => void,
    onClose: () => void,
    visible: boolean
): string {
    if (!visible) return '';

    return `
        <div class="network-selector-modal-overlay" id="network-selector-overlay" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.2s;
        ">
            <div class="network-selector-modal" style="
                width: 100%;
                max-width: 400px;
                background: var(--r-neutral-bg1);
                border-radius: 16px;
                padding: 24px;
                display: flex;
                flex-direction: column;
                animation: slideUp 0.3s;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24);
                margin: 20px;
            ">
                <div style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 24px;
                ">
                    <h2 style="
                        font-size: 20px;
                        font-weight: 500;
                        color: var(--r-neutral-title1);
                        margin: 0;
                    ">Select Network</h2>
                    <button id="network-selector-close" style="
                        background: none;
                        border: none;
                        cursor: pointer;
                        padding: 4px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: var(--r-neutral-foot);
                        transition: color 0.2s;
                    " onmouseover="this.style.color='var(--r-neutral-title1)'" onmouseout="this.style.color='var(--r-neutral-foot)'">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                            <path d="M5 5L15 15M15 5L5 15" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
                
                <div class="network-selector-list" style="
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                ">
                    ${networks.map(network => {
                        const isSelected = network.chainId === currentChainId;
                        const networkLogo = network.logo || getChainColoredLogo(network.chainId);
                        return `
                            <div class="network-option" 
                                 data-chain-id="${network.chainId}"
                                 style="
                                    padding: 16px;
                                    background: ${isSelected ? 'var(--r-blue-light-1)' : 'var(--r-neutral-card1)'};
                                    border: 1px solid ${isSelected ? 'var(--r-blue-default)' : 'transparent'};
                                    border-radius: 8px;
                                    cursor: pointer;
                                    display: flex;
                                    align-items: center;
                                    gap: 12px;
                                    transition: all 0.2s;
                                 "
                                 onmouseover="this.style.background='var(--r-blue-light-1)'"
                                 onmouseout="this.style.background='${isSelected ? 'var(--r-blue-light-1)' : 'var(--r-neutral-card1)'}'">
                                <div style="
                                    width: 32px;
                                    height: 32px;
                                    border-radius: 50%;
                                    background: ${networkLogo ? 'transparent' : 'var(--r-blue-default)'};
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    flex-shrink: 0;
                                ">
                                    ${networkLogo ? `
                                        <img src="${networkLogo}" 
                                             alt="${network.name}" 
                                             style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;"
                                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                        <div style="display: none; width: 32px; height: 32px; border-radius: 50%; background: var(--r-blue-default); color: white; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">
                                            ${network.name.charAt(0)}
                                        </div>
                                    ` : `
                                        <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--r-blue-default); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">
                                            ${network.name.charAt(0)}
                                        </div>
                                    `}
                                </div>
                                <div style="
                                    flex: 1;
                                    display: flex;
                                    flex-direction: column;
                                    gap: 2px;
                                ">
                                    <div style="
                                        font-size: 15px;
                                        font-weight: 500;
                                        color: var(--r-neutral-title1);
                                    ">${network.name}</div>
                                    <div style="
                                        font-size: 12px;
                                        color: var(--r-neutral-foot);
                                    ">Chain ID: ${network.chainId}</div>
                                </div>
                                ${isSelected ? `
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style="flex-shrink: 0;">
                                        <circle cx="10" cy="10" r="9" fill="var(--r-blue-default)"/>
                                        <path d="M6 10L9 13L14 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
}

