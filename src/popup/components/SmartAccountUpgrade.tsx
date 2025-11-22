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
    chainId?: number
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
                            font-size: 12px;
                            color: var(--r-neutral-foot);
                            margin-bottom: 4px;
                        ">Delegated to:</div>
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
                        <button id="upgrade-smart-account-btn" style="
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
                        <button id="reset-delegation-btn" style="
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
                        ">Reset Delegation</button>
                    `}
                </div>
            `}
        </div>
    `;
}

