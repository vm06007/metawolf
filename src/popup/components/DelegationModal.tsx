// Predefined EIP-7702 delegator contracts
const PREDEFINED_DELEGATORS = [
    {
        name: 'MetaMask: EIP-7702 Delegator',
        address: '0x63c0c19a282a1b52b07dd5a65b58948a07dae32b'
    },
    {
        name: 'Ambire: EIP-7702 Delegator',
        address: '0x5A7FC11397E9a8AD41BF10bf13F22B0a63f96f6d'
    }
];

export function renderDelegationModal(
    isUpgrade: boolean,
    targetAddress: string,
    onApprove: () => void,
    onReject: () => void,
    visible: boolean,
    isFirstRender: boolean = true,
    chainId: number = 1,
    buttonToConfirm: boolean = false,
    onButtonCancel?: () => void
): string {
    if (!visible) return '';

    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
    const defaultAddress = isUpgrade ? PREDEFINED_DELEGATORS[0].address : ZERO_ADDRESS;
    const action = isUpgrade ? 'Upgrade' : 'Reset';
    const actionDescription = isUpgrade
        ? 'This will delegate your account to the smart account, enabling advanced features.'
        : 'This will clear the delegation, removing the smart account functionality from your account.';

    // Get the name for the current address if it's a predefined one
    const currentDelegator = PREDEFINED_DELEGATORS.find(d =>
        d.address.toLowerCase() === (targetAddress || defaultAddress).toLowerCase()
    );
    const contractAddress = targetAddress || defaultAddress;
    const contractName = currentDelegator?.name || 'Custom Address';
    const isCustomAddress = !currentDelegator;

    // Etherscan URL based on chainId (with #code hash)
    const getEtherscanUrl = (address: string) => {
        const chainMap: Record<number, string> = {
            1: 'etherscan.io',
            11155111: 'sepolia.etherscan.io',
            5: 'goerli.etherscan.io',
            10: 'optimistic.etherscan.io',
            42161: 'arbiscan.io',
            8453: 'basescan.org',
            137: 'polygonscan.com',
            56: 'bscscan.com'
        };
        const domain = chainMap[chainId] || 'etherscan.io';
        return `https://${domain}/address/${address}#code`;
    };

    return `
        <div class="delegation-modal-overlay" id="delegation-modal-overlay" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            z-index: 1002;
            display: flex;
            align-items: center;
            justify-content: center;
            ${isFirstRender ? 'animation: fadeIn 0.2s;' : ''}
        ">
            <div class="delegation-modal" style="
                background: var(--r-neutral-bg1);
                border-radius: 16px;
                padding: 0;
                width: 90%;
                max-width: 450px;
                max-height: 85vh;
                box-shadow: var(--r-shadow-modal);
                display: flex;
                flex-direction: column;
                ${isFirstRender ? 'animation: fadeIn 0.2s;' : ''}
            ">
                <div style="
                    padding: 24px 24px 20px 24px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    border-bottom: 1px solid var(--r-neutral-line);
                ">
                    <h3 style="
                        font-size: 20px;
                        font-weight: 600;
                        color: var(--r-neutral-title1);
                        margin: 0;
                    ">${action} to Smart Account</h3>
                    <button id="delegation-modal-close" style="
                        background: none;
                        border: none;
                        cursor: pointer;
                        padding: 4px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: var(--r-neutral-foot);
                        transition: color 0.2s;
                    " onmouseenter="this.style.color='var(--r-neutral-title1)'" onmouseleave="this.style.color='var(--r-neutral-foot)'">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                            <path d="M5 5L15 15M15 5L5 15" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
                <div style="
                    flex: 1;
                    overflow-y: auto;
                    padding: 24px;
                ">
                    <div style="
                        background: var(--r-neutral-card1);
                        border-radius: 12px;
                        margin-bottom: 20px;
                        padding-top: 0px;
                    ">
                        <div style="
                            font-size: 14px;
                            color: var(--r-neutral-body);
                            line-height: 1.6;
                            margin-bottom: 16px;
                        ">
                            ${actionDescription}
                        </div>
                        <div style="
                            font-size: 12px;
                            color: var(--r-neutral-foot);
                            margin-bottom: 8px;
                            font-weight: 500;
                        ">Contract Address:</div>
                        ${isUpgrade ? `
                            <div style="margin-bottom: 12px;">
                                <select id="delegator-select" style="
                                    width: 100%;
                                    padding: 10px 12px;
                                    border: 1px solid var(--r-neutral-line);
                                    border-radius: 8px;
                                    font-size: 14px;
                                    color: var(--r-neutral-title1);
                                    background: var(--r-neutral-bg1);
                                    cursor: pointer;
                                    transition: all 0.2s;
                                    box-sizing: border-box;
                                " onfocus="this.style.borderColor='var(--r-blue-default)'" onblur="this.style.borderColor='var(--r-neutral-line)'">
                                    <option value="custom" ${isCustomAddress ? 'selected' : ''}>Custom Address</option>
                                    ${PREDEFINED_DELEGATORS.map(delegator => `
                                        <option value="${delegator.address}" ${delegator.address.toLowerCase() === contractAddress.toLowerCase() ? 'selected' : ''}>
                                            ${delegator.name}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                        ` : ''}
                        <div style="
                            display: flex;
                            align-items: center;
                            gap: 8px;
                        ">
                            <input
                                type="text"
                                id="delegator-address-input"
                                value="${contractAddress}"
                                placeholder="0x..."
                                ${!isCustomAddress ? 'readonly' : ''}
                                style="
                                    flex: 1;
                                    font-family: monospace;
                                    font-size: 13px;
                                    color: var(--r-neutral-title1);
                                    background: ${isCustomAddress ? 'var(--r-neutral-bg2)' : 'var(--r-neutral-bg1)'};
                                    padding: 10px 12px;
                                    border: 1px solid var(--r-neutral-line);
                                    border-radius: 8px;
                                    transition: all 0.2s;
                                    box-sizing: border-box;
                                    cursor: ${isCustomAddress ? 'text' : 'not-allowed'};
                                "
                                onfocus="if (!this.readOnly) { this.style.borderColor='var(--r-blue-default)'; this.style.background='var(--r-neutral-bg1)'; }"
                                onblur="if (!this.readOnly) { this.style.borderColor='var(--r-neutral-line)'; this.style.background='var(--r-neutral-bg2)'; }"
                            />
                            <a
                                id="delegator-etherscan-link"
                                href="${getEtherscanUrl(contractAddress)}"
                                target="_blank"
                                rel="noopener noreferrer"
                                style="
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    padding: 10px;
                                    background: var(--r-neutral-bg2);
                                    border: 1px solid var(--r-neutral-line);
                                    border-radius: 8px;
                                    color: var(--r-neutral-foot);
                                    text-decoration: none;
                                    transition: all 0.2s;
                                    cursor: pointer;
                                    flex-shrink: 0;
                                "
                                onmouseenter="this.style.background='var(--r-blue-light1)'; this.style.borderColor='var(--r-blue-default)'; this.style.color='var(--r-blue-default)'"
                                onmouseleave="this.style.background='var(--r-neutral-bg2)'; this.style.borderColor='var(--r-neutral-line)'; this.style.color='var(--r-neutral-foot)'"
                                title="View on Etherscan"
                            >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                                    <path d="M6 2H3C2.44772 2 2 2.44772 2 3V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V10M10 2H14M14 2V6M14 2L6 10" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </a>
                        </div>
                    </div>

                    <div style="
                        background: #eeeeee;
                        border: 1px solid var(--r-yellow-default);
                        border-radius: 8px;
                        padding: 12px;
                        font-size: 13px;
                        color: var(--r-neutral-title1);
                        line-height: 1.5;
                    ">
                        <div style="
                            display: flex;
                            align-items: flex-start;
                            gap: 8px;
                        ">
                            <span style="flex-shrink: 0; margin-top: 2px; font-size: 16px;">⚠️</span>
                            <div>
                                <strong>Warning:</strong> This will broadcast a type-4 transaction to ${isUpgrade ? 'set' : 'clear'} the delegation.
                                Review the contract address carefully before confirming.
                            </div>
                        </div>
                    </div>
                </div>
                <div style="
                    padding: 20px 24px 24px 24px;
                    background: var(--r-neutral-bg1);
                    border-top: 1px solid var(--r-neutral-line);
                    border-bottom-right-radius: 20px;
                    border-bottom-left-radius: 20px;
                ">
                    <div style="
                        display: flex;
                        gap: 12px;
                    ">
                        ${buttonToConfirm && isUpgrade ? `
                            <div style="
                                width: 100%;
                                display: flex;
                                height: 48px;
                                border-radius: 8px;
                                overflow: hidden;
                                background: var(--r-blue-default);
                            ">
                                <button id="delegation-confirm-btn" style="
                                    flex: 1;
                                    padding: 12px 20px;
                                    background: transparent;
                                    color: white;
                                    border: none;
                                    border-radius: 0;
                                    font-size: 15px;
                                    font-weight: 500;
                                    cursor: pointer;
                                    transition: background 0.2s;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                " onmouseenter="this.style.background='rgba(0,0,0,0.25)'" onmouseleave="this.style.background='transparent'">Confirm</button>
                                <div style="
                                    width: 1px;
                                    height: 28px;
                                    background: rgba(255,255,255,0.1);
                                    align-self: center;
                                "></div>
                                <button id="delegation-cancel-confirm-btn" style="
                                    width: 56px;
                                    padding: 12px;
                                    background: transparent;
                                    color: white;
                                    border: none;
                                    border-radius: 0;
                                    cursor: pointer;
                                    transition: background 0.2s;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                " onmouseenter="this.style.background='rgba(0,0,0,0.25)'" onmouseleave="this.style.background='transparent'">
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                                        <path d="M4 4L12 12M12 4L4 12" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                </button>
                            </div>
                        ` : `
                            <button id="delegation-reject-btn" style="
                                flex: 1;
                                padding: 12px 20px;
                                background: white;
                                color: var(--r-blue-default);
                                border: 1px solid var(--r-neutral-line);
                                border-radius: 8px;
                                font-size: 15px;
                                font-weight: 500;
                                cursor: pointer;
                                transition: all 0.2s;
                            " onmouseenter="this.style.background='var(--r-neutral-bg2)'" onmouseleave="this.style.background='white'">Cancel</button>
                            <button id="delegation-approve-btn" style="
                                flex: 1;
                                padding: 12px 20px;
                                background: ${isUpgrade ? 'var(--r-blue-default)' : 'var(--r-red-default)'};
                                color: white;
                                border: none;
                                border-radius: 8px;
                                font-size: 15px;
                                font-weight: 500;
                                cursor: pointer;
                                transition: opacity 0.2s;
                            " onmouseenter="this.style.opacity='0.9'" onmouseleave="this.style.opacity='1'">${action}</button>
                        `}
                    </div>
                </div>
            </div>
        </div>
    `;
}

