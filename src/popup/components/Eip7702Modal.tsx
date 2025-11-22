import { renderSmartAccountUpgrade } from './SmartAccountUpgrade';

interface DelegationStatus {
    isDelegated: boolean;
    delegateAddress: string | null;
    codeHash: string;
}

interface RenderEip7702ModalParams {
    visible: boolean;
    account?: any;
    delegationStatus: DelegationStatus | null;
    isLoading: boolean;
    isFirstRender: boolean;
    transactionHash?: string | null;
    chainId?: number;
    networks?: Array<{ chainId: number; name: string; }>;
}

export function renderEip7702Modal(params: RenderEip7702ModalParams): string {
    const {
        visible,
        account,
        delegationStatus,
        isLoading,
        isFirstRender,
        transactionHash,
        chainId,
        networks = [],
    } = params;

    if (!visible) {
        return '';
    }

    const accountName = account?.alianName || account?.name || 'Current Account';
    const address = account?.address || '';
    const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
    const canManageDelegation = !!account && !account.isWatchOnly;
    const showLoader = canManageDelegation && isLoading;
    const sheetAnimation = isFirstRender ? 'animation: slideUp 0.3s ease-out;' : '';
    const overlayAnimation = isFirstRender ? 'animation: fadeIn 0.2s;' : '';
    const contentMinHeight = 260;

    // Get Etherscan URL for address based on chainId
    const getAddressExplorerUrl = (address: string, chainId: number = 1) => {
        if (!address) return 'https://etherscan.io/';
        const chainMap: Record<number, string> = {
            1: 'etherscan.io',
            11155111: 'sepolia.etherscan.io',
            5: 'goerli.etherscan.io',
            10: 'optimistic.etherscan.io',
            42161: 'arbiscan.io',
            48900: 'explorer.zircuit.com',
            8453: 'basescan.org',
            137: 'polygonscan.com',
            56: 'bscscan.com',
        };
        const domain = chainMap[chainId] || 'etherscan.io';
        return `https://${domain}/address/${address}#code`;
    };

    const loadingBlock = `
        <div style="
            min-height: ${contentMinHeight}px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            align-items: center;
            justify-content: center;
            color: var(--r-neutral-foot);
        ">
            <svg width="32" height="32" viewBox="0 0 32 32" style="animation: spin 1s linear infinite;">
                <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="70" stroke-dashoffset="20" opacity="0.4"/>
                <path d="M30 16a14 14 0 0 0-14-14" stroke="#4C65FF" stroke-width="3" stroke-linecap="round" fill="none"/>
            </svg>
            <div style="font-size: 13px;">Loading delegation details...</div>
        </div>
    `;

    const delegationContent = showLoader
        ? loadingBlock
        : `
            <div style="min-height: ${contentMinHeight}px;">
                ${renderSmartAccountUpgrade(
            account,
            delegationStatus,
            false,
            () => { },
            () => { },
            transactionHash,
            chainId,
            'eip7702-modal'
        )}
            </div>
        `;

    return `
        <div id="eip7702-modal-root">
            <div id="eip7702-modal-overlay" style="
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.4);
                backdrop-filter: blur(4px);
                z-index: 1001;
                ${overlayAnimation}
            "></div>
            <div id="eip7702-modal-sheet" style="
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: var(--r-neutral-bg1);
                border-radius: 20px 20px 0 0;
                max-height: 85vh;
                overflow-y: auto;
                z-index: 1002;
                box-shadow: 0 -12px 30px rgba(0, 0, 0, 0.2);
                ${sheetAnimation}
            ">
                <div style="
                    padding: 20px 24px;
                    border-bottom: 1px solid var(--r-neutral-line);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                ">
                    <div>
                        <h3 style="
                            margin: 0 0 4px 0;
                            font-size: 18px;
                            font-weight: 600;
                            color: var(--r-neutral-title1);
                        ">EIP-7702 Smart Account</h3>
                        <p style="
                            margin: 0;
                            font-size: 13px;
                            color: var(--r-neutral-foot);
                        ">Upgrade or reset delegation status</p>
                    </div>
                    <button id="eip7702-modal-close" style="
                        background: none;
                        border: none;
                        cursor: pointer;
                        padding: 4px;
                        color: var(--r-neutral-foot);
                        transition: color 0.2s;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    " onmouseenter="this.style.color='var(--r-neutral-title1)'" onmouseleave="this.style.color='var(--r-neutral-foot)'">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                            <path d="M5 5L15 15M15 5L5 15" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
                <div style="
                    padding: 8px;
                ">
                    ${account ? `
                        <div style="
                            background: var(--r-neutral-card1);
                            border-radius: 12px;
                            padding: 16px;
                            margin-bottom: 16px;
                        ">
                            <div style="
                                display: flex;
                                align-items: center;
                                margin-bottom: 8px;
                                gap: 4px;
                            ">
                                <div style="
                                    font-size: 15px;
                                    font-weight: 500;
                                    color: var(--r-neutral-title1);
                                ">${accountName}</div>
                                <span style="
                                    font-size: 13px;
                                    color: var(--r-neutral-foot);
                                ">${shortAddress}</span>
                            </div>
                            ${account.isWatchOnly ? `
                                <div style="
                                    background: var(--r-yellow-light);
                                    border-radius: 8px;
                                    font-size: 13px;
                                    color: var(--r-neutral-body);
                                    line-height: 1.5;
                                ">
                                    <div style="margin-bottom: 8px;">
                                        This is a watch-only account. You can view the current delegation status but cannot submit upgrade or reset transactions from here.
                                    </div>
                                    ${networks.length > 0 ? `
                                        <div style="margin-top: 12px; margin-bottom: 12px;">
                                            <label style="
                                                display: block;
                                                font-size: 12px;
                                                color: var(--r-neutral-foot);
                                                margin-bottom: 6px;
                                            ">Network</label>
                                            <select id="eip7702-network-selector" style="
                                                width: 100%;
                                                padding: 10px 12px;
                                                background: var(--r-neutral-bg2);
                                                border: 1px solid var(--r-neutral-line);
                                                border-radius: 8px;
                                                font-size: 14px;
                                                color: var(--r-neutral-title1);
                                                cursor: pointer;
                                                outline: none;
                                                transition: all 0.2s;
                                            ">
                                                ${networks.map(network => `
                                                    <option value="${network.chainId}" ${network.chainId === chainId ? 'selected' : ''}>
                                                        ${network.name}
                                                    </option>
                                                `).join('')}
                                            </select>
                                        </div>
                                    ` : ''}
                                    ${isLoading ? `
                                        <div style="
                                            display: flex;
                                            align-items: center;
                                            gap: 8px;
                                            color: var(--r-neutral-foot);
                                            font-size: 12px;
                                        ">
                                            <svg width="16" height="16" viewBox="0 0 16 16" style="animation: spin 1s linear infinite;">
                                                <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="35" stroke-dashoffset="10" opacity="0.4"/>
                                                <path d="M15 8a7 7 0 0 0-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
                                            </svg>
                                            Checking delegation status...
                                        </div>
                                    ` : delegationStatus ? delegationStatus.isDelegated && delegationStatus.delegateAddress ? `
                                        <div style="
                                            margin-top: 12px;
                                            padding-top: 12px;
                                            border-top: 1px solid var(--r-neutral-line);
                                        ">
                                            <div style="
                                                font-size: 12px;
                                                color: var(--r-neutral-foot);
                                                margin-bottom: 4px;
                                            ">Delegated to:</div>
                                            <div style="
                                                display: flex;
                                                align-items: center;
                                                gap: 8px;
                                                background: var(--r-neutral-bg1);
                                                padding: 7px;
                                                border-radius: 6px;
                                                border: 1px solid var(--r-neutral-line);
                                            ">
                                                <div style="
                                                    font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace;
                                                    font-size: 12px;
                                                    color: var(--r-neutral-title1);
                                                    word-break: break-all;
                                                    flex: 1;
                                                ">${delegationStatus.delegateAddress}</div>
                                                <a
                                                    href="${getAddressExplorerUrl(delegationStatus.delegateAddress, chainId || 1)}"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style="
                                                        display: flex;
                                                        align-items: center;
                                                        justify-content: center;
                                                        padding: 4px;
                                                        color: var(--r-neutral-foot);
                                                        text-decoration: none;
                                                        transition: all 0.2s;
                                                        cursor: pointer;
                                                        flex-shrink: 0;
                                                        border-radius: 4px;
                                                    "
                                                    onmouseenter="this.style.background='var(--r-blue-light1)'; this.style.color='var(--r-blue-default)'"
                                                    onmouseleave="this.style.background='transparent'; this.style.color='var(--r-neutral-foot)'"
                                                    title="View on Etherscan"
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                                                        <path d="M6 2H3C2.44772 2 2 2.44772 2 3V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V10M10 2H14M14 2V6M14 2L6 10" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                                    </svg>
                                                </a>
                                            </div>
                                        </div>
                                    ` : `
                                        <div style="
                                            margin-top: 12px;
                                            padding-top: 12px;
                                            border-top: 1px solid var(--r-neutral-line);
                                            font-size: 12px;
                                            color: var(--r-neutral-foot);
                                        ">
                                            No delegation set. This account is a regular EOA.
                                        </div>
                                    ` : ''}
                                </div>
                            ` : `
                                <p style="
                                    margin: 0 0 12px 0;
                                    font-size: 13px;
                                    color: var(--r-neutral-body);
                                    line-height: 1.5;
                                ">
                                    Manage your smart account delegation directly from the main dashboard.
                                </p>
                                ${networks.length > 0 ? `
                                    <div style="margin-top: 12px;">
                                        <label style="
                                            display: block;
                                            font-size: 12px;
                                            color: var(--r-neutral-foot);
                                            margin-bottom: 6px;
                                        ">Network</label>
                                        <select id="eip7702-network-selector" style="
                                            width: 100%;
                                            padding: 10px 12px;
                                            background: var(--r-neutral-bg2);
                                            border: 1px solid var(--r-neutral-line);
                                            border-radius: 8px;
                                            font-size: 14px;
                                            color: var(--r-neutral-title1);
                                            cursor: pointer;
                                            outline: none;
                                            transition: all 0.2s;
                                        ">
                                            ${networks.map(network => `
                                                <option value="${network.chainId}" ${network.chainId === chainId ? 'selected' : ''}>
                                                    ${network.name}
                                                </option>
                                            `).join('')}
                                        </select>
                                    </div>
                                ` : ''}
                            `}
                        </div>
                    ` : `
                        <div style="
                            background: var(--r-yellow-light);
                            border-radius: 12px;
                            padding: 16px;
                            font-size: 13px;
                            color: var(--r-neutral-title1);
                            line-height: 1.5;
                            margin-bottom: 16px;
                        ">
                            Select an account to view its smart account status.
                        </div>
                    `}
                    ${canManageDelegation ? delegationContent : ''}
                </div>
            </div>
        </div>
    `;
}

