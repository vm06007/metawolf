/**
 * Get Etherscan URL for a transaction hash
 */
function getEtherscanUrl(chainId: number, txHash: string): string {
    const explorers: Record<number, string> = {
        1: 'https://etherscan.io/tx',
        11155111: 'https://sepolia.etherscan.io/tx',
        5: 'https://goerli.etherscan.io/tx',
        137: 'https://polygonscan.com/tx',
        42161: 'https://arbiscan.io/tx',
        10: 'https://optimistic.etherscan.io/tx',
        56: 'https://bscscan.com/tx',
        43114: 'https://snowtrace.io/tx',
    };

    const baseUrl = explorers[chainId] || explorers[1];
    return `${baseUrl}/${txHash}`;
}

/**
 * Format transaction hash for display
 */
function formatHash(hash: string): string {
    if (hash.length > 10) {
        return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
    }
    return hash;
}

export function renderTransactionSuccess(
    transactionHash: string,
    chainId: number,
    onClose: () => void
): string {
    const etherscanUrl = getEtherscanUrl(chainId, transactionHash);
    const formattedHash = formatHash(transactionHash);

    return `
        <div class="transaction-success-container" style="
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
                ">Transaction Submitted</h2>
            </div>

            <div style="
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 40px 24px;
            ">
                <div style="
                    width: 80px;
                    height: 80px;
                    border-radius: 50%;
                    background: var(--r-green-light1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 24px;
                ">
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                        <circle cx="20" cy="20" r="20" fill="var(--r-green-default)"/>
                        <path d="M12 20L18 26L28 14" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>

                <h3 style="
                    font-size: 20px;
                    font-weight: 500;
                    color: var(--r-neutral-title1);
                    margin: 0 0 12px 0;
                    text-align: center;
                ">Transaction Broadcasted</h3>

                <p style="
                    font-size: 14px;
                    color: var(--r-neutral-body);
                    margin: 0 0 12px 0;
                    text-align: center;
                    line-height: 1.5;
                ">Your transaction has been successfully submitted to the network.</p>

                <div id="tx-status" style="
                    font-size: 14px;
                    color: var(--r-neutral-body);
                    margin: 0 0 24px 0;
                    text-align: center;
                    line-height: 1.5;
                ">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <div class="spinner" style="
                            width: 16px;
                            height: 16px;
                            border: 2px solid var(--r-neutral-line);
                            border-top-color: var(--r-blue-default);
                            border-radius: 50%;
                            animation: spin 1s linear infinite;
                        "></div>
                        <span>Pending...</span>
                    </div>
                    <style>
                        @keyframes spin {
                            to { transform: rotate(360deg); }
                        }
                    </style>
                </div>

                <div style="
                    background: var(--r-neutral-card1);
                    border-radius: 8px;
                    padding: 16px;
                    width: 100%;
                    max-width: 320px;
                    margin-bottom: 24px;
                ">
                    <div style="
                        font-size: 12px;
                        color: var(--r-neutral-foot);
                        margin-bottom: 8px;
                    ">Transaction Hash</div>
                    <div style="
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 12px;
                    ">
                        <div style="
                            font-size: 14px;
                            color: var(--r-neutral-title1);
                            font-family: monospace;
                            word-break: break-all;
                            flex: 1;
                        ">${formattedHash}</div>
                        <a href="${etherscanUrl}" 
                           target="_blank" 
                           rel="noopener noreferrer"
                           style="
                               display: flex;
                               align-items: center;
                               gap: 4px;
                               color: var(--r-blue-default);
                               text-decoration: none;
                               font-size: 13px;
                               font-weight: 500;
                               flex-shrink: 0;
                           ">
                            <span>View</span>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path d="M11 3L3 11M3 3H11V11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </a>
                    </div>
                </div>

                <button id="close-success-btn" style="
                    width: 100%;
                    max-width: 320px;
                    padding: 14px;
                    background: var(--r-blue-default);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.2s;
                ">Close</button>
            </div>
        </div>
    `;
}

