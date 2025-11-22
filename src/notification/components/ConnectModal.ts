import { formatAddress, getDisplayName } from '../../popup/utils/account';

export interface Account {
    address: string;
    name?: string;
    isChipAccount?: boolean;
    multisig?: any;
    haloLinked?: boolean;
}

export function renderConnectModal(
    dappName: string,
    dappOrigin: string,
    dappIcon: string,
    accounts: Account[],
    selectedAccount: Account | null,
    onSelectAccount: (account: Account) => void,
    onConnect: () => void,
    onCancel: () => void,
    showAccountSelector: boolean = false
): string {
    // Mock data for DApp stats (in real implementation, fetch from API)
    const sitePopularity = 'High'; // Could be 'High', 'Medium', 'Low'
    const listedBy = [
        { name: 'MetaMask', icon: 'https://metamask.io/images/metamask-icon.svg' },
        { name: 'Binance', icon: 'https://binance.com/favicon.ico' },
        { name: 'CoinMarketCap', icon: 'https://coinmarketcap.com/favicon.ico' },
        { name: 'TokenPocket', icon: 'https://tokenpocket.pro/favicon.ico' },
    ];

    const accountsHtml = accounts.map(account => {
        const isSelected = selectedAccount?.address?.toLowerCase() === account.address?.toLowerCase();
        const displayName = getDisplayName(account);
        
        return `
            <div class="connect-account-option ${isSelected ? 'selected' : ''}" 
                 data-address="${account.address}"
                 style="
                     padding: 12px 16px;
                     cursor: pointer;
                     border-radius: 6px;
                     transition: background 0.2s;
                     ${isSelected ? 'background: var(--r-blue-light1);' : ''}
                 ">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="
                        width: 32px;
                        height: 32px;
                        border-radius: 50%;
                        background: var(--r-blue-light1);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                    ">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <circle cx="10" cy="10" r="10" fill="rgba(76, 101, 255, 0.2)"/>
                            <circle cx="10" cy="10" r="6" fill="rgba(76, 101, 255, 0.5)"/>
                        </svg>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="
                            font-size: 15px;
                            font-weight: 500;
                            color: var(--r-neutral-title1);
                            margin-bottom: 2px;
                        ">${displayName}</div>
                        <div style="
                            font-size: 13px;
                            color: var(--r-neutral-foot);
                        ">${formatAddress(account.address)}</div>
                    </div>
                    ${isSelected ? `
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <circle cx="10" cy="10" r="10" fill="var(--r-blue-default)"/>
                            <path d="M6 10L9 13L14 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="connect-modal-container" style="
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
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <h2 style="
                        font-size: 18px;
                        font-weight: 500;
                        color: var(--r-neutral-title1);
                        margin: 0;
                    ">Connect to Dapp</h2>
                    <div style="
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        padding: 6px 12px;
                        background: var(--r-neutral-bg2);
                        border: 1px solid var(--r-neutral-line);
                        border-radius: 8px;
                        cursor: pointer;
                    ">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="8" r="7" fill="#627EEA"/>
                            <path d="M8 2V8L11 10" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span style="
                            font-size: 13px;
                            font-weight: 500;
                            color: var(--r-neutral-title1);
                        ">Ethereum</span>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                </div>
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
                            <img src="${dappIcon}" 
                                 alt="${dappName}"
                                 style="width: 100%; height: 100%; object-fit: cover;"
                                 onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--r-blue-light1);color:var(--r-blue-default);font-weight:500;\\'>${dappName.charAt(0).toUpperCase()}</div>'">
                        </div>
                        <p style="
                            font-size: 22px;
                            font-weight: 500;
                            color: var(--r-neutral-title1);
                            margin: 8px 0 0 0;
                            text-align: center;
                            word-wrap: break-word;
                            max-width: 100%;
                        ">${dappOrigin}</p>
                    </div>

                    <div style="
                        padding-top: 16px;
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                    ">
                        <div style="
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                        ">
                            <span style="
                                font-size: 14px;
                                color: var(--r-neutral-body);
                            ">Listed by</span>
                            <div style="
                                display: flex;
                                gap: 8px;
                                align-items: center;
                            ">
                                ${listedBy.map(listing => `
                                    <div style="
                                        width: 24px;
                                        height: 24px;
                                        border-radius: 50%;
                                        background: var(--r-neutral-bg2);
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        overflow: hidden;
                                    ">
                                        <img src="${listing.icon}" 
                                             alt="${listing.name}"
                                             style="width: 100%; height: 100%; object-fit: cover;"
                                             onerror="this.style.display='none'">
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <div style="
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                        ">
                            <span style="
                                font-size: 14px;
                                color: var(--r-neutral-body);
                            ">Site popularity</span>
                            <span style="
                                font-size: 14px;
                                font-weight: 500;
                                color: var(--r-neutral-title1);
                            ">${sitePopularity}</span>
                        </div>

                        <div style="
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                        ">
                            <span style="
                                font-size: 14px;
                                color: var(--r-neutral-body);
                            ">My mark</span>
                            <div style="
                                display: flex;
                                align-items: center;
                                gap: 4px;
                                cursor: pointer;
                            ">
                                <span style="
                                    font-size: 14px;
                                    color: var(--r-neutral-foot);
                                ">No mark</span>
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <path d="M3.5 10.5L7 7L10.5 10.5M7 3.5V7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                ${showAccountSelector ? `
                    <div style="
                        margin-bottom: 20px;
                    ">
                        <div style="
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            margin-bottom: 12px;
                        ">
                            <span style="
                                font-size: 14px;
                                color: var(--r-neutral-body);
                            ">Connect Address</span>
                        </div>
                        <div id="connect-account-selector" style="
                            background: var(--r-neutral-card1);
                            border: 1px solid var(--r-neutral-line);
                            border-radius: 8px;
                            padding: 8px;
                            max-height: 200px;
                            overflow-y: auto;
                        ">
                            ${accountsHtml || '<div style="padding: 20px; text-align: center; color: var(--r-neutral-foot);">No accounts found</div>'}
                        </div>
                    </div>
                ` : ''}
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
                    <button id="connect-btn" style="
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
                    ">Connect</button>
                    <button id="cancel-btn" style="
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
                    ">Cancel</button>
                </div>
            </div>
        </div>
    `;
}

