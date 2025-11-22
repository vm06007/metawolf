import { formatAddress } from '../../popup/utils/account';

export interface BatchedCall {
    to?: string;
    value?: string;
    data?: string;
    dataSuffix?: string;
}

export interface BatchedCallsRequest {
    id: string;
    calls: BatchedCall[];
    address: string;
    origin: string;
    dappName: string;
    dappIcon: string;
    chainId?: number;
    capabilities?: any;
    forceAtomic?: boolean;
}

export interface CallSimulationResult {
    success: boolean;
    support: boolean;
    balanceChange?: {
        sendList?: Array<{ amount: string; token: { symbol: string; logo_url?: string } }>;
        receiveList?: Array<{ amount: string; token: { symbol: string; logo_url?: string } }>;
        usdValueDiff?: string;
    };
}

export interface BatchedCallsSimulation {
    calls: Array<{
        call: BatchedCall;
        simulation?: CallSimulationResult;
        description?: string;
    }>;
    totalBalanceChange?: {
        sendList?: Array<{ amount: string; token: { symbol: string; logo_url?: string } }>;
        receiveList?: Array<{ amount: string; token: { symbol: string; logo_url?: string } }>;
        usdValueDiff?: string;
    };
}

/**
 * Format wei value to ETH
 */
function formatValue(value: string | undefined): string {
    if (!value) return '0 ETH';
    try {
        const bigIntValue = typeof value === 'string' && value.startsWith('0x')
            ? BigInt(value)
            : BigInt(value);
        const ethValue = Number(bigIntValue) / 1e18;
        if (ethValue === 0) return '0 ETH';
        if (ethValue < 0.0001) return '<0.0001 ETH';
        return `${ethValue.toFixed(6).replace(/\.?0+$/, '')} ETH`;
    } catch {
        return value;
    }
}

/**
 * Format token amount
 */
function formatTokenAmount(amount: string, decimals: number = 18): string {
    try {
        const bigIntValue = BigInt(amount);
        const divisor = BigInt(10 ** decimals);
        const quotient = bigIntValue / divisor;
        const remainder = bigIntValue % divisor;
        const decimalValue = Number(remainder) / Number(divisor);
        const wholeValue = Number(quotient);
        if (decimalValue === 0) {
            return wholeValue.toLocaleString();
        }
        return `${wholeValue.toLocaleString()}.${decimalValue.toString().substring(2, 8).replace(/0+$/, '')}`;
    } catch {
        return amount;
    }
}

/**
 * Format USD value
 */
function formatUsdValue(value: string | undefined): string {
    if (!value) return '$0.00';
    try {
        const numValue = parseFloat(value);
        if (numValue === 0) return '$0.00';
        if (Math.abs(numValue) < 0.01) return `$${numValue.toFixed(4)}`;
        return `$${numValue.toFixed(2)}`;
    } catch {
        return value || '$0.00';
    }
}

/**
 * Get chain name from chainId
 */
function getChainName(chainId: number | undefined): string {
    const chains: Record<number, string> = {
        1: 'Ethereum',
        11155111: 'Sepolia',
        5: 'Goerli',
        137: 'Polygon',
        42161: 'Arbitrum',
        10: 'Optimism',
        56: 'BSC',
        43114: 'Avalanche',
    };
    return chains[chainId || 1] || `Chain ${chainId || 1}`;
}

/**
 * Check if call data is a contract interaction
 */
function isContractInteraction(data: string | undefined): boolean {
    if (!data || data === '0x' || data === '0x0') return false;
    return data.length > 10; // Has function selector (4 bytes = 8 hex chars + 0x)
}

/**
 * Get call description based on data
 */
function getCallDescription(call: BatchedCall, index: number): string {
    if (!call.to) return `Call ${index + 1}: Contract Creation`;
    
    const hasValue = call.value && call.value !== '0x0' && call.value !== '0';
    const isContract = isContractInteraction(call.data);
    
    if (hasValue && isContract) {
        return `Call ${index + 1}: Send ${formatValue(call.value)} & Interact Contract`;
    } else if (hasValue) {
        return `Call ${index + 1}: Send ${formatValue(call.value)}`;
    } else if (isContract) {
        return `Call ${index + 1}: Contract Interaction`;
    } else {
        return `Call ${index + 1}: Transfer`;
    }
}

/**
 * Render a single call item
 */
function renderCallItem(
    call: BatchedCall,
    index: number,
    simulation?: CallSimulationResult,
    description?: string
): string {
    const callDescription = description || getCallDescription(call, index);
    const hasSimulation = simulation?.success && simulation?.balanceChange;
    const sendList = hasSimulation ? simulation.balanceChange?.sendList || [] : [];
    const receiveList = hasSimulation ? simulation.balanceChange?.receiveList || [] : [];
    const usdValueDiff = hasSimulation ? simulation.balanceChange?.usdValueDiff : undefined;

    return `
        <div style="
            background: var(--r-neutral-card1);
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
            border-left: 3px solid var(--r-blue-default);
        ">
            <div style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 12px;
            ">
                <div style="
                    display: flex;
                    align-items: center;
                    gap: 8px;
                ">
                    <div style="
                        width: 24px;
                        height: 24px;
                        border-radius: 50%;
                        background: var(--r-blue-light1);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 12px;
                        font-weight: 600;
                        color: var(--r-blue-default);
                    ">${index + 1}</div>
                    <div style="
                        font-size: 14px;
                        font-weight: 500;
                        color: var(--r-neutral-title1);
                    ">${callDescription}</div>
                </div>
            </div>

            ${call.to ? `
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                ">
                    <div style="
                        font-size: 13px;
                        color: var(--r-neutral-body);
                    ">To</div>
                    <div style="
                        font-size: 12px;
                        color: var(--r-neutral-title1);
                        font-family: monospace;
                    ">${formatAddress(call.to)}</div>
                </div>
            ` : ''}

            ${call.value && call.value !== '0x0' && call.value !== '0' ? `
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                ">
                    <div style="
                        font-size: 13px;
                        color: var(--r-neutral-body);
                    ">Value</div>
                    <div style="
                        font-size: 13px;
                        color: var(--r-neutral-title1);
                    ">${formatValue(call.value)}</div>
                </div>
            ` : ''}

            ${hasSimulation ? `
                <div style="
                    margin-top: 12px;
                    padding-top: 12px;
                    border-top: 1px solid var(--r-neutral-line);
                ">
                    ${usdValueDiff ? `
                        <div style="
                            font-size: 13px;
                            color: var(--r-neutral-body);
                            margin-bottom: 8px;
                        ">Estimated change: ${usdValueDiff.startsWith('-') ? '-' : '+'} ${formatUsdValue(usdValueDiff.replace(/^-/, ''))}</div>
                    ` : ''}
                    ${sendList.length > 0 ? sendList.map(item => `
                        <div style="
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            margin-bottom: 4px;
                            color: var(--r-red-default);
                            font-size: 12px;
                        ">
                            <span>-</span>
                            <span>${formatTokenAmount(item.amount)}</span>
                            <span>${item.token.symbol}</span>
                            ${item.token.logo_url ? `<img src="${item.token.logo_url}" style="width: 16px; height: 16px; border-radius: 50%;" />` : ''}
                        </div>
                    `).join('') : ''}
                    ${receiveList.length > 0 ? receiveList.map(item => `
                        <div style="
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            margin-bottom: 4px;
                            color: var(--r-green-default);
                            font-size: 12px;
                        ">
                            <span>+</span>
                            <span>${formatTokenAmount(item.amount)}</span>
                            <span>${item.token.symbol}</span>
                            ${item.token.logo_url ? `<img src="${item.token.logo_url}" style="width: 16px; height: 16px; border-radius: 50%;" />` : ''}
                        </div>
                    `).join('') : ''}
                </div>
            ` : ''}
        </div>
    `;
}

export function renderBatchedCallsModal(
    request: BatchedCallsRequest,
    onApprove: () => void,
    onReject: () => void,
    simulation?: BatchedCallsSimulation
): string {
    const chainId = request.chainId || 1;
    const chainName = getChainName(chainId);
    const calls = request.calls || [];
    const totalBalanceChange = simulation?.totalBalanceChange;

    return `
        <div class="batched-calls-modal-container" style="
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
                <h2 style="
                    font-size: 18px;
                    font-weight: 500;
                    color: var(--r-neutral-title1);
                    margin: 0;
                ">Transaction request</h2>
                <div style="
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    margin-top: 8px;
                ">
                    <div style="
                        background: var(--r-neutral-bg2);
                        border-radius: 12px;
                        padding: 4px 8px;
                        font-size: 12px;
                        color: var(--r-neutral-body);
                        display: flex;
                        align-items: center;
                        gap: 4px;
                    ">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5" fill="none"/>
                            <path d="M7 4V7L9 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                        Includes ${calls.length} transaction${calls.length !== 1 ? 's' : ''}
                    </div>
                </div>
            </div>

            <div style="
                flex: 1;
                overflow-y: auto;
                padding: 20px 24px;
            ">
                <!-- DApp Info -->
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
                            <img src="${request.dappIcon}" 
                                 alt="${request.dappName}"
                                 style="width: 100%; height: 100%; object-fit: cover;"
                                 onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--r-blue-light1);color:var(--r-blue-default);font-weight:500;\\'>${request.dappName.charAt(0).toUpperCase()}</div>'">
                        </div>
                        <p style="
                            font-size: 16px;
                            font-weight: 500;
                            color: var(--r-neutral-title1);
                            margin: 8px 0 0 0;
                            text-align: center;
                            word-wrap: break-word;
                            max-width: 100%;
                        ">${request.dappName}</p>
                        <p style="
                            font-size: 13px;
                            color: var(--r-neutral-foot);
                            margin: 4px 0 0 0;
                            text-align: center;
                            word-wrap: break-word;
                            max-width: 100%;
                        ">${request.origin}</p>
                    </div>
                </div>

                <!-- Total Estimated Changes -->
                ${totalBalanceChange ? `
                    <div style="
                        background: var(--r-neutral-card1);
                        border-radius: 8px;
                        padding: 16px;
                        margin-bottom: 20px;
                    ">
                        <div style="
                            font-size: 14px;
                            font-weight: 500;
                            color: var(--r-neutral-title1);
                            margin-bottom: 12px;
                        ">Estimated changes</div>
                        ${totalBalanceChange.usdValueDiff ? `
                            <div style="
                                font-size: 16px;
                                color: var(--r-neutral-body);
                                margin-bottom: 12px;
                            ">${totalBalanceChange.usdValueDiff.startsWith('-') ? '-' : '+'} ${formatUsdValue(totalBalanceChange.usdValueDiff.replace(/^-/, ''))}</div>
                        ` : ''}
                        ${totalBalanceChange.sendList && totalBalanceChange.sendList.length > 0 ? totalBalanceChange.sendList.map(item => `
                            <div style="
                                display: flex;
                                align-items: center;
                                gap: 8px;
                                margin-bottom: 8px;
                                color: var(--r-red-default);
                            ">
                                <span>You send</span>
                                <span>-</span>
                                <span>${formatTokenAmount(item.amount)}</span>
                                <span>${item.token.symbol}</span>
                                ${item.token.logo_url ? `<img src="${item.token.logo_url}" style="width: 16px; height: 16px; border-radius: 50%;" />` : ''}
                            </div>
                        `).join('') : ''}
                        ${totalBalanceChange.receiveList && totalBalanceChange.receiveList.length > 0 ? totalBalanceChange.receiveList.map(item => `
                            <div style="
                                display: flex;
                                align-items: center;
                                gap: 8px;
                                margin-bottom: 8px;
                                color: var(--r-green-default);
                            ">
                                <span>You receive</span>
                                <span>+</span>
                                <span>${formatTokenAmount(item.amount)}</span>
                                <span>${item.token.symbol}</span>
                                ${item.token.logo_url ? `<img src="${item.token.logo_url}" style="width: 16px; height: 16px; border-radius: 50%;" />` : ''}
                            </div>
                        `).join('') : ''}
                    </div>
                ` : ''}

                <!-- Actions List -->
                <div style="
                    background: var(--r-neutral-card1);
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 20px;
                ">
                    <div style="
                        font-size: 14px;
                        font-weight: 500;
                        color: var(--r-neutral-title1);
                        margin-bottom: 16px;
                    ">Actions</div>
                    ${calls.map((call, index) => {
                        const callSimulation = simulation?.calls?.[index]?.simulation;
                        const callDescription = simulation?.calls?.[index]?.description;
                        return renderCallItem(call, index, callSimulation, callDescription);
                    }).join('')}
                </div>

                <!-- Transaction Details -->
                <div style="
                    background: var(--r-neutral-card1);
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 20px;
                ">
                    <div style="
                        font-size: 14px;
                        font-weight: 500;
                        color: var(--r-neutral-title1);
                        margin-bottom: 12px;
                    ">Transaction Details</div>
                    <div style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 12px;
                    ">
                        <div style="
                            font-size: 13px;
                            color: var(--r-neutral-body);
                        ">Network</div>
                        <div style="
                            font-size: 13px;
                            color: var(--r-neutral-title1);
                        ">${chainName}</div>
                    </div>
                    <div style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 12px;
                    ">
                        <div style="
                            font-size: 13px;
                            color: var(--r-neutral-body);
                        ">Request from</div>
                        <div style="
                            font-size: 13px;
                            color: var(--r-neutral-title1);
                        ">${request.origin}</div>
                    </div>
                    <div style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    ">
                        <div style="
                            font-size: 13px;
                            color: var(--r-neutral-body);
                        ">Method</div>
                        <div style="
                            font-size: 13px;
                            color: var(--r-neutral-title1);
                        ">Execute</div>
                    </div>
                </div>

                <!-- Warning -->
                <div style="
                    background: var(--r-yellow-light1);
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
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink: 0; margin-top: 2px;">
                            <path d="M8 1L15 14H1L8 1Z" fill="var(--r-yellow-default)"/>
                            <path d="M8 6V10M8 12V12.01" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                        <div>
                            <strong>Warning:</strong> This batch includes ${calls.length} transaction${calls.length !== 1 ? 's' : ''}. Review all details carefully before confirming.
                        </div>
                    </div>
                </div>
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
                    <button id="approve-batched-calls-btn" style="
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
                    ">Confirm</button>
                    <button id="reject-batched-calls-btn" style="
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

