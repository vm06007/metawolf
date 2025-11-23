import type { AppState } from '../types/app-state';

export interface UIContext {
    state: AppState;
}

export function showSuccessMessage(
    message: string,
    transactionHash?: string,
    chainId?: number,
    context?: UIContext
): void {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--r-green-default);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;

    if (transactionHash) {
        const truncatedHash = transactionHash.length > 8
            ? `${transactionHash.slice(0, 4)}...${transactionHash.slice(-4)}`
            : transactionHash;

        const txChainId = chainId || context?.state.selectedAccount?.chainId || 1;
        const etherscanUrl = getEtherscanUrl(txChainId, transactionHash);

        const hashLink = document.createElement('a');
        hashLink.href = etherscanUrl;
        hashLink.target = '_blank';
        hashLink.rel = 'noopener noreferrer';
        hashLink.style.cssText = `
            color: white;
            text-decoration: underline;
            cursor: pointer;
        `;
        hashLink.textContent = truncatedHash;

        notification.textContent = `${message} `;
        notification.appendChild(hashLink);
    } else {
        notification.textContent = message;
    }

    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

export function showErrorMessage(message: string): void {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--r-red-default);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

export function getEtherscanUrl(chainId: number, txHash: string): string {
    const explorers: Record<number, string> = {
        1: 'https://etherscan.io/tx',
        11155111: 'https://sepolia.etherscan.io/tx',
        5: 'https://goerli.etherscan.io/tx',
        137: 'https://polygonscan.com/tx',
        42161: 'https://arbiscan.io/tx',
        48900: 'https://explorer.zircuit.com/tx',
        10: 'https://optimistic.etherscan.io/tx',
        8453: 'https://basescan.org/tx',
        56: 'https://bscscan.com/tx',
        43114: 'https://snowtrace.io/tx',
    };

    const baseUrl = explorers[chainId] || explorers[1];
    return `${baseUrl}/${txHash}`;
}

