export function renderSmartAccountUpgrade(
    account: any,
    delegationStatus: {
        isDelegated: boolean;
        delegateAddress: string | null;
        codeHash: string;
    } | null,
    isLoading: boolean,
    onUpgrade: () => void,
    onReset: () => void,
    transactionHash?: string | null,
    chainId?: number,
    context: string = 'account-detail'
): string {
    const isDelegated = delegationStatus?.isDelegated || false;
    const delegateAddress = delegationStatus?.delegateAddress;
    const SMART_ACCOUNT_CONTRACT = '0x63c0c19a282a1b52b07dd5a65b58948a07dae32b';
    
    // Get explorer URL
    const getExplorerUrl = (hash: string, chainId: number = 1) => {
        if (chainId === 1) {
            return `https://etherscan.io/tx/${hash}`;
        } else if (chainId === 11155111) {
            return `https://sepolia.etherscan.io/tx/${hash}`;
        }
        return `https://etherscan.io/tx/${hash}`;
    };

    const getAddressExplorerUrl = (address: string, chainId: number = 1) => {
        if (!address) return 'https://etherscan.io/';
        const chainMap: Record<number, string> = {
            1: 'etherscan.io',
            11155111: 'sepolia.etherscan.io',
            5: 'goerli.etherscan.io',
            10: 'optimistic.etherscan.io',
            42161: 'arbiscan.io',
            8453: 'basescan.org',
            137: 'polygonscan.com',
            56: 'bscscan.com',
        };
        const domain = chainMap[chainId] || 'etherscan.io';
        return `https://${domain}/address/${address}#code`;
    };

    const delegateExplorerUrl = isDelegated
        ? getAddressExplorerUrl(delegateAddress || SMART_ACCOUNT_CONTRACT, chainId)
        : null;

    return `
        <div style="
            background: var(--r-neutral-card1);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 16px;
        ">
            <div style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 16px;
            ">
                <div>
                    <h3 style="
                        font-size: 16px;
                        font-weight: 500;
                        color: var(--r-neutral-title1);
                        margin: 0 0 4px 0;
                    ">Smart Account</h3>
                    <p style="
                        font-size: 13px;
                        color: var(--r-neutral-foot);
                        margin: 0;
                    ">EIP-7702 Delegation</p>
                </div>
                <div style="
                    padding: 6px 12px;
                    border-radius: 6px;
                    background: ${isDelegated ? 'var(--r-green-light)' : 'var(--r-neutral-bg2)'};
                    color: ${isDelegated ? 'var(--r-green-default)' : 'var(--r-neutral-foot)'};
                    font-size: 12px;
                    font-weight: 500;
                ">
                    ${isDelegated ? '✓ Delegated' : 'Not Delegated'}
                </div>
            </div>

            ${isLoading ? `
                <div style="
                    text-align: center;
                    padding: 20px;
                    color: var(--r-neutral-foot);
                ">
                    Checking delegation status...
                </div>
            ` : `
                ${isDelegated ? `
                    <div style="
                        background: var(--r-neutral-bg2);
                        border-radius: 8px;
                        padding: 12px;
                        margin-bottom: 16px;
                    ">
                        <div style="
                            display: flex;
                            align-items: center;
                            gap: 6px;
                            font-size: 12px;
                            color: var(--r-neutral-foot);
                            margin-bottom: 4px;
                        ">
                            <span>Delegated to:</span>
                            ${delegateExplorerUrl ? `
                                <a href="${delegateExplorerUrl}" target="_blank" rel="noopener noreferrer" style="
                                    display: inline-flex;
                                    align-items: center;
                                    justify-content: center;
                                    color: var(--r-neutral-foot);
                                    transition: color 0.2s;
                                " onmouseenter="this.style.color='var(--r-blue-default)'" onmouseleave="this.style.color='var(--r-neutral-foot)'">
                                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                                        <path d="M9.33331 2.66675H13.3333V6.66675" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                                        <path d="M6.66669 9.33342L13.3334 2.66675" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                                        <path d="M12 9.33325V12.6666C12 13.0203 11.8595 13.3594 11.6095 13.6095C11.3594 13.8595 11.0203 14 10.6666 14H3.33331C2.97969 14 2.64053 13.8595 2.39048 13.6095C2.14043 13.3594 2 13.0203 2 12.6666V5.33325C2 4.97963 2.14043 4.64047 2.39048 4.39042C2.64053 4.14037 2.97969 3.99994 3.33331 3.99994H6.66665" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                </a>
                            ` : ''}
                        </div>
                        <div style="
                            font-family: monospace;
                            font-size: 13px;
                            color: var(--r-neutral-title1);
                            word-break: break-all;
                        ">${delegateAddress || SMART_ACCOUNT_CONTRACT}</div>
                    </div>
                ` : `
                    <div style="
                        background: var(--r-blue-light1);
                        border-radius: 8px;
                        padding: 12px;
                        margin-bottom: 16px;
                        font-size: 13px;
                        color: var(--r-neutral-body);
                        line-height: 1.5;
                    ">
                        Upgrade your account to a smart account by delegating to the EIP-7702 contract. This enables advanced features like batched transactions.
                    </div>
                `}

                ${transactionHash ? `
                    <div style="
                        background: var(--r-green-light);
                        border-radius: 8px;
                        padding: 12px;
                        margin-bottom: 16px;
                    ">
                        <div style="
                            font-size: 12px;
                            color: var(--r-green-default);
                            margin-bottom: 4px;
                        ">Transaction submitted:</div>
                        <a href="${getExplorerUrl(transactionHash, chainId)}" 
                           target="_blank"
                           style="
                               font-family: monospace;
                               font-size: 13px;
                               color: var(--r-green-default);
                               text-decoration: none;
                               word-break: break-all;
                           ">
                            ${transactionHash.slice(0, 10)}...${transactionHash.slice(-8)}
                        </a>
                    </div>
                ` : ''}

                <div style="
                    display: flex;
                    gap: 12px;
                ">
                    ${!isDelegated ? `
                        <button data-smart-account-action="upgrade" data-delegation-address="${account?.address || ''}" data-delegation-context="${context}" style="
                            flex: 1;
                            padding: 12px;
                            background: var(--r-blue-default);
                            color: white;
                            border: none;
                            border-radius: 8px;
                            font-size: 14px;
                            font-weight: 500;
                            cursor: pointer;
                            transition: background 0.2s;
                        ">Upgrade to Smart Account</button>
                    ` : `
                        <button data-smart-account-action="reset" data-delegation-address="${account?.address || ''}" data-delegation-context="${context}" style="
                            flex: 1;
                            padding: 12px;
                            background: var(--r-red-default);
                            color: white;
                            border: none;
                            border-radius: 8px;
                            font-size: 14px;
                            font-weight: 500;
                            cursor: pointer;
                            transition: background 0.2s;
                        " onmouseenter="this.style.background='var(--r-red-dark, #C62828)'" onmouseleave="this.style.background='var(--r-red-default)'">Reset Delegation</button>
                    `}
                </div>
            `}
        </div>
    `;
}

