import { formatAddress } from '../../popup/utils/account';

export interface TransactionRequest {
    id: string;
    transaction: {
        from?: string;
        to?: string;
        value?: string;
        data?: string;
        gasLimit?: string | number;
        gasPrice?: string | number;
        maxFeePerGas?: string | number;
        maxPriorityFeePerGas?: string | number;
        nonce?: number;
        chainId?: number;
        type?: number;
    };
    address: string;
    origin: string;
    dappName: string;
    dappIcon: string;
}

export interface SimulationResult {
    success: boolean;
    support: boolean;
    balanceChange?: {
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
 * Format gas value
 */
function formatGas(gas: string | number | undefined): string {
    if (!gas) return '0';
    try {
        const gasValue = typeof gas === 'string' && gas.startsWith('0x')
            ? parseInt(gas, 16)
            : typeof gas === 'string'
            ? parseInt(gas, 10)
            : gas;
        return gasValue.toLocaleString();
    } catch {
        return String(gas);
    }
}

/**
 * Format gas price in Gwei
 */
function formatGasPrice(gasPrice: string | number | undefined): string {
    if (!gasPrice) return '0 Gwei';
    try {
        const priceValue = typeof gasPrice === 'string' && gasPrice.startsWith('0x')
            ? BigInt(gasPrice)
            : BigInt(gasPrice);
        const gweiValue = Number(priceValue) / 1e9;
        return `${gweiValue.toFixed(2)} Gwei`;
    } catch {
        return String(gasPrice);
    }
}

/**
 * Estimate gas cost in ETH
 */
function estimateGasCost(
    gasLimit: string | number | undefined,
    gasPrice?: string | number | undefined,
    maxFeePerGas?: string | number | undefined
): string {
    if (!gasLimit) return '0 ETH';
    try {
        const limit = typeof gasLimit === 'string' && gasLimit.startsWith('0x')
            ? BigInt(gasLimit)
            : BigInt(gasLimit);
        
        let price: bigint;
        if (maxFeePerGas) {
            price = typeof maxFeePerGas === 'string' && maxFeePerGas.startsWith('0x')
                ? BigInt(maxFeePerGas)
                : BigInt(maxFeePerGas);
        } else if (gasPrice) {
            price = typeof gasPrice === 'string' && gasPrice.startsWith('0x')
                ? BigInt(gasPrice)
                : BigInt(gasPrice);
        } else {
            return 'Unknown';
        }
        
        const totalCost = limit * price;
        const ethCost = Number(totalCost) / 1e18;
        if (ethCost === 0) return '0 ETH';
        if (ethCost < 0.0001) return '<0.0001 ETH';
        return `${ethCost.toFixed(6).replace(/\.?0+$/, '')} ETH`;
    } catch {
        return 'Unknown';
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
        48900: 'Zircuit',
    };
    return chains[chainId || 1] || `Chain ${chainId || 1}`;
}

/**
 * Check if transaction data is a contract interaction
 */
function isContractInteraction(data: string | undefined): boolean {
    if (!data || data === '0x' || data === '0x0') return false;
    return data.length > 10; // Has function selector (4 bytes = 8 hex chars + 0x)
}

export function renderTransactionModal(
    request: TransactionRequest,
    onApprove: () => void,
    onReject: () => void,
    simulationResult?: SimulationResult,
    showAdvanced: boolean = false,
    onToggleAdvanced?: () => void,
    onGasLimitChange?: (value: string) => void,
    onNonceChange?: (value: string) => void
): string {
    const tx = request.transaction;
    const value = formatValue(tx.value);
    const gasLimit = formatGas(tx.gasLimit);
    const gasPrice = tx.maxFeePerGas ? formatGasPrice(tx.maxFeePerGas) : formatGasPrice(tx.gasPrice);
    const estimatedCost = estimateGasCost(tx.gasLimit, tx.gasPrice, tx.maxFeePerGas);
    const isContract = isContractInteraction(tx.data);
    const toAddress = tx.to || 'Contract Creation';
    const chainId = tx.chainId || 1;
    const chainName = getChainName(chainId);
    
    const hasSimulation = simulationResult?.success && simulationResult?.balanceChange;
    const sendList = hasSimulation ? simulationResult.balanceChange?.sendList || [] : [];
    const receiveList = hasSimulation ? simulationResult.balanceChange?.receiveList || [] : [];
    const usdValueDiff = hasSimulation ? simulationResult.balanceChange?.usdValueDiff : undefined;

    return `
        <div class="transaction-modal-container" style="
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
                ">Confirm Transaction</h2>
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

                <!-- Simulation Results -->
                ${hasSimulation ? `
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
                        ">Simulation Results</div>
                        ${usdValueDiff ? `
                            <div style="
                                font-size: 16px;
                                color: var(--r-neutral-body);
                                margin-bottom: 12px;
                            ">${usdValueDiff.startsWith('-') ? '-' : '+'} ${formatUsdValue(usdValueDiff.replace(/^-/, ''))}</div>
                        ` : ''}
                        ${sendList.length > 0 ? sendList.map(item => `
                            <div style="
                                display: flex;
                                align-items: center;
                                gap: 8px;
                                margin-bottom: 8px;
                                color: var(--r-red-default);
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
                                margin-bottom: 8px;
                                color: var(--r-green-default);
                            ">
                                <span>+</span>
                                <span>${formatTokenAmount(item.amount)}</span>
                                <span>${item.token.symbol}</span>
                                ${item.token.logo_url ? `<img src="${item.token.logo_url}" style="width: 16px; height: 16px; border-radius: 50%;" />` : ''}
                            </div>
                        `).join('') : ''}
                    </div>
                ` : ''}

                <!-- Transaction Details -->
                <div style="
                    background: var(--r-neutral-card1);
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 20px;
                ">
                    <div style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 16px;
                    ">
                        <div style="
                            font-size: 14px;
                            font-weight: 500;
                            color: var(--r-neutral-title1);
                        ">Swap Token</div>
                        <a href="#" id="view-raw-link" style="
                            font-size: 13px;
                            color: var(--r-blue-default);
                            text-decoration: none;
                        ">View Raw ></a>
                    </div>

                    <div style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 12px;
                    ">
                        <div style="
                            font-size: 14px;
                            color: var(--r-neutral-body);
                        ">Chain</div>
                        <div style="
                            font-size: 14px;
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
                            font-size: 14px;
                            color: var(--r-neutral-body);
                        ">Pay</div>
                        <div style="
                            font-size: 14px;
                            color: var(--r-neutral-title1);
                        ">${value}</div>
                    </div>

                    ${tx.to ? `
                        <div style="
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            margin-bottom: 12px;
                        ">
                            <div style="
                                font-size: 14px;
                                color: var(--r-neutral-body);
                            ">Interact contract</div>
                            <div style="
                                font-size: 13px;
                                color: var(--r-neutral-title1);
                                font-family: monospace;
                            ">${formatAddress(tx.to)}</div>
                        </div>
                    ` : ''}

                    <div style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 12px;
                    ">
                        <div style="
                            font-size: 14px;
                            color: var(--r-neutral-body);
                        ">From</div>
                        <div style="
                            font-size: 13px;
                            color: var(--r-neutral-title1);
                            font-family: monospace;
                        ">${formatAddress(request.address)}</div>
                    </div>
                </div>

                <!-- Advanced Settings -->
                ${showAdvanced ? `
                    <div style="
                        background: var(--r-neutral-card1);
                        border-radius: 8px;
                        padding: 16px;
                        margin-bottom: 20px;
                    ">
                        <div style="
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            margin-bottom: 16px;
                        ">
                            <div style="
                                font-size: 14px;
                                font-weight: 500;
                                color: var(--r-neutral-title1);
                            ">Advanced Settings</div>
                            <button id="close-advanced-btn" style="
                                background: none;
                                border: none;
                                color: var(--r-neutral-body);
                                cursor: pointer;
                                font-size: 18px;
                                padding: 0;
                                width: 24px;
                                height: 24px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            ">×</button>
                        </div>
                        <div style="margin-bottom: 16px;">
                            <label style="
                                display: block;
                                font-size: 13px;
                                color: var(--r-neutral-body);
                                margin-bottom: 8px;
                            ">Gas limit</label>
                            <input type="text" 
                                   id="gas-limit-input" 
                                   value="${gasLimit}"
                                   style="
                                       width: 100%;
                                       padding: 10px;
                                       background: var(--r-neutral-bg2);
                                       border: 1px solid var(--r-neutral-line);
                                       border-radius: 6px;
                                       color: var(--r-neutral-title1);
                                       font-size: 14px;
                                       font-family: monospace;
                                   ">
                            <div style="
                                font-size: 12px;
                                color: var(--r-neutral-foot);
                                margin-top: 4px;
                            ">${isContract ? 'Minimum 1,000,000 for contract interactions. ' : ''}Est. ${gasLimit}. Current 1.5x, recommend 1.5x.</div>
                        </div>
                        <div>
                            <label style="
                                display: block;
                                font-size: 13px;
                                color: var(--r-neutral-body);
                                margin-bottom: 8px;
                            ">Nonce</label>
                            <input type="text" 
                                   id="nonce-input" 
                                   value="${tx.nonce || ''}"
                                   style="
                                       width: 100%;
                                       padding: 10px;
                                       background: var(--r-neutral-bg2);
                                       border: 1px solid var(--r-neutral-line);
                                       border-radius: 6px;
                                       color: var(--r-neutral-title1);
                                       font-size: 14px;
                                       font-family: monospace;
                                   ">
                            <div style="
                                font-size: 12px;
                                color: var(--r-neutral-foot);
                                margin-top: 4px;
                            ">Modify only when necessary</div>
                        </div>
                    </div>
                ` : ''}

                <!-- Gas Fee -->
                <div style="
                    background: var(--r-neutral-card1);
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 20px;
                ">
                    <div style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 8px;
                    ">
                        <div style="
                            font-size: 14px;
                            color: var(--r-neutral-body);
                        ">Gas Fee</div>
                        <div style="
                            font-size: 14px;
                            color: var(--r-neutral-title1);
                        ">${estimatedCost}</div>
                    </div>
                    <div style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    ">
                        <div style="
                            font-size: 13px;
                            color: var(--r-neutral-foot);
                        ">${gasPrice}</div>
                        <select id="gas-speed-select" style="
                            padding: 4px 8px;
                            background: var(--r-neutral-bg2);
                            border: 1px solid var(--r-neutral-line);
                            border-radius: 4px;
                            color: var(--r-neutral-title1);
                            font-size: 13px;
                            cursor: pointer;
                        ">
                            <option>Fast</option>
                            <option>Standard</option>
                            <option>Slow</option>
                        </select>
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
                            <strong>Warning:</strong> Review all transaction details carefully. Once confirmed, this transaction cannot be cancelled.
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
                    ${!showAdvanced ? `
                        <button id="advanced-settings-btn" style="
                            width: 100%;
                            padding: 12px;
                            background: transparent;
                            color: var(--r-neutral-body);
                            border: none;
                            font-size: 14px;
                            cursor: pointer;
                            text-align: left;
                        ">Advanced Settings ></button>
                    ` : ''}
                    <button id="approve-transaction-btn" style="
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
                    ">Sign</button>
                    <button id="reject-transaction-btn" style="
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
