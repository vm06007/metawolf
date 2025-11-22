export interface EIP6963ProviderInfo {
    uuid: string;
    name: string;
    icon: string;
    rdns: string;
}

export function renderWalletSelectorModal(
    providers: EIP6963ProviderInfo[],
    onSelect: (provider?: EIP6963ProviderInfo) => void,
    onClose: () => void,
    visible: boolean
): string {
    if (!visible) return '';

    return `
        <div class="wallet-selector-modal-overlay" id="wallet-selector-overlay" style="
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
            <div class="wallet-selector-modal" style="
                width: 100%;
                max-width: 480px;
                background: var(--r-neutral-bg1);
                border-radius: 16px;
                padding: 40px 20px 20px 20px;
                display: flex;
                flex-direction: column;
                animation: slideUp 0.3s;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24);
            ">
                <div style="
                    text-align: center;
                    margin-bottom: 32px;
                ">
                    <h1 style="
                        font-size: 24px;
                        font-weight: 500;
                        color: var(--r-neutral-title1);
                        margin: 0 0 8px 0;
                    ">Select a Wallet to Connect</h1>
                    <p style="
                        font-size: 15px;
                        color: var(--r-neutral-body);
                        margin: 0;
                    ">Select from the wallets you have installed</p>
                </div>
                
                <div class="wallet-selector-grid" style="
                    display: flex;
                    flex-wrap: wrap;
                    margin: -8px;
                    margin-bottom: 20px;
                ">
                    <!-- Wolfy Wallet Option -->
                    <div class="wallet-option" style="
                        padding: 8px;
                        width: 50%;
                        box-sizing: border-box;
                    " data-wallet-id="wolfy">
                        <div class="wallet-option-card" style="
                            padding: 20px;
                            height: 100px;
                            background: var(--r-neutral-card1);
                            border-radius: 8px;
                            border: 1px solid transparent;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            cursor: pointer;
                            transition: all 0.2s;
                            box-shadow: 0px 4px 16px 0px rgba(0, 0, 0, 0.04);
                        ">
                            <div style="
                                width: 32px;
                                height: 32px;
                                margin-bottom: 8px;
                                background: var(--r-blue-default);
                                border-radius: 50%;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                color: white;
                                font-weight: bold;
                                font-size: 18px;
                            ">W</div>
                            <div style="
                                font-size: 18px;
                                font-weight: 500;
                                color: var(--r-neutral-title1);
                                text-align: center;
                                overflow: hidden;
                                text-overflow: ellipsis;
                                white-space: nowrap;
                                width: 100%;
                            ">Wolfy Wallet</div>
                        </div>
                    </div>
                    
                    <!-- Other Wallet Options -->
                    ${providers.map(provider => `
                        <div class="wallet-option" style="
                            padding: 8px;
                            width: 50%;
                            box-sizing: border-box;
                        " data-wallet-id="${provider.uuid}" data-rdns="${provider.rdns}">
                            <div class="wallet-option-card" style="
                                padding: 20px;
                                height: 100px;
                                background: var(--r-neutral-card1);
                                border-radius: 8px;
                                border: 1px solid transparent;
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: center;
                                cursor: pointer;
                                transition: all 0.2s;
                                box-shadow: 0px 4px 16px 0px rgba(0, 0, 0, 0.04);
                            ">
                                <img src="${provider.icon}" alt="${provider.name}" style="
                                    width: 32px;
                                    height: 32px;
                                    margin-bottom: 8px;
                                    border-radius: 50%;
                                " onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                <div style="
                                    width: 32px;
                                    height: 32px;
                                    margin-bottom: 8px;
                                    background: var(--r-neutral-line);
                                    border-radius: 50%;
                                    display: none;
                                    align-items: center;
                                    justify-content: center;
                                    font-size: 14px;
                                    color: var(--r-neutral-foot);
                                ">${provider.name.charAt(0).toUpperCase()}</div>
                                <div style="
                                    font-size: 18px;
                                    font-weight: 500;
                                    color: var(--r-neutral-title1);
                                    text-align: center;
                                    overflow: hidden;
                                    text-overflow: ellipsis;
                                    white-space: nowrap;
                                    width: 100%;
                                ">${provider.name}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <button id="wallet-selector-close" style="
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 8px;
                    position: absolute;
                    top: 16px;
                    right: 16px;
                    color: var(--r-neutral-foot);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                        <path d="M5 5L15 15M15 5L5 15" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
        </div>
    `;
}

