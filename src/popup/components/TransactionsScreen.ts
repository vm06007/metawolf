import type { OctavTransaction } from '../services/transactions-service';
import { formatAddress } from '../utils/account';

interface TransactionsScreenProps {
    accountAddress?: string;
    accountName?: string;
    transactions: OctavTransaction[];
    loading: boolean;
    error?: string;
    hideSpam: boolean;
    hasMore: boolean;
}

export function renderTransactionsScreen(props: TransactionsScreenProps): string {
    const {
        accountAddress,
        accountName,
        transactions,
        loading,
        error,
        hideSpam,
        hasMore,
    } = props;

    const headerSubtitle = accountAddress ? formatAddress(accountAddress) : 'No account selected';

    return `
        <div class="transactions-screen">
            <div class="transactions-header">
                <button id="transactions-back-btn" class="transactions-back-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M15 18L9 12L15 6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <div>
                    <div class="transactions-title">Transactions</div>
                    <div class="transactions-subtitle">${accountName || 'Account'} · ${headerSubtitle}</div>
                </div>
            </div>

            <div class="transactions-controls">
                <button id="transactions-hide-spam" class="transactions-toggle ${hideSpam ? 'active' : ''}">
                    <span>Hide scam transactions</span>
                    <span class="toggle-indicator">${hideSpam ? 'On' : 'Off'}</span>
                </button>
                <button id="transactions-reload-btn" class="transactions-reload-btn" ${loading ? 'disabled' : ''}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M4 4V10H10" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M20 20V14H14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M5.63 18.37C6.56454 19.3044 7.72279 20.0004 9.00344 20.3864C10.2841 20.7725 11.6426 20.836 12.9519 20.571C14.2612 20.306 15.4743 19.7212 16.4804 18.8713C17.4865 18.0214 18.2511 16.9332 18.7047 15.707" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M18.37 5.63C17.4355 4.69559 16.2772 3.99959 14.9966 3.61354C13.716 3.2275 12.3574 3.164 11.0481 3.429C9.73882 3.69401 8.52568 4.27882 7.51962 5.12872C6.51356 5.97861 5.74889 7.0668 5.29533 8.293" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>

            ${error ? `<div class="transactions-error">${error}</div>` : ''}

            ${renderTransactionContent(transactions, loading)}

            ${hasMore ? `
                <button id="transactions-load-more" class="transactions-load-more" ${loading ? 'disabled' : ''}>
                    ${loading ? 'Loading...' : 'Load more'}
                </button>
            ` : ''}
        </div>
    `;
}

function renderTransactionContent(transactions: OctavTransaction[], loading: boolean): string {
    if (loading && transactions.length === 0) {
        return `
            <div class="transactions-list loading">
                ${Array.from({ length: 4 }).map(() => renderSkeletonRow()).join('')}
            </div>
        `;
    }

    if (!loading && transactions.length === 0) {
        return `
            <div class="transactions-empty">
                <div class="empty-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M8 8H16M8 12H16M8 16H12" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </div>
                <div class="empty-title">No transactions found</div>
                <div class="empty-desc">Start interacting with dapps to see activity here.</div>
            </div>
        `;
    }

    return `
        <div class="transactions-list">
            ${transactions.map(renderTransactionRow).join('')}
        </div>
    `;
}

function renderTransactionRow(tx: OctavTransaction): string {
    const timestamp = parseInt(tx.timestamp, 10) * 1000;
    const relativeTime = formatRelativeTime(timestamp);
    const networkLabel = tx.chain?.name || 'Unknown network';
    const explorerUrl = getExplorerUrl(tx.chain?.key, tx.hash);
    const amountLabel = tx.value
        ? `${formatValueAmount(tx.value)} ${getNetworkSymbol(tx.chain?.key)}`
        : renderAssetAmounts(tx);
    const fiatLabel = tx.valueFiat ? `$${Number(tx.valueFiat).toFixed(2)}` : '';
    const protocolLabel = tx.protocol?.name || tx.subProtocol?.name || tx.type;
    const directionIcon = tx.type === 'RECEIVE' ? '+' : tx.type === 'SEND' ? '−' : '';

    return `
        <div class="transactions-row">
            <div class="transaction-avatar">
                <div class="transaction-avatar-text">${protocolLabel.slice(0, 2).toUpperCase()}</div>
            </div>
            <div class="transaction-details">
                <div class="transaction-title-row">
                    <div class="transaction-title">${formatTitle(tx)}</div>
                    <div class="transaction-amount ${directionIcon === '+' ? 'positive' : directionIcon === '−' ? 'negative' : ''}">
                        ${directionIcon ? `<span>${directionIcon}</span>` : ''}${amountLabel}
                    </div>
                </div>
                <div class="transaction-subtitle">
                    <span>${protocolLabel}</span>
                    <span class="divider-dot"></span>
                    <span>${networkLabel}</span>
                    <span class="divider-dot"></span>
                    <span>${relativeTime}</span>
                </div>
                <div class="transaction-meta">
                    <a href="${explorerUrl}" target="_blank" rel="noopener noreferrer">
                        ${truncateHash(tx.hash)}
                    </a>
                    ${fiatLabel ? `<span class="transaction-fiat">${fiatLabel}</span>` : ''}
                </div>
            </div>
        </div>
    `;
}

function renderSkeletonRow(): string {
    return `
        <div class="transactions-row skeleton">
            <div class="skeleton-line wide"></div>
            <div class="skeleton-line medium"></div>
            <div class="skeleton-line narrow"></div>
        </div>
    `;
}

function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

    return new Date(timestamp).toLocaleDateString();
}

function truncateHash(hash: string): string {
    if (!hash) return '';
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function formatTitle(tx: OctavTransaction): string {
    switch (tx.type) {
        case 'SEND':
            return 'Send';
        case 'RECEIVE':
            return 'Receive';
        case 'SWAP':
            return 'Swap';
        case 'APPROVE':
            return 'Approval';
        default:
            return tx.type?.toLowerCase()
                .split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ') || 'Transaction';
    }
}

function getExplorerUrl(chainKey: string | undefined, hash: string): string {
    const explorers: Record<string, string> = {
        ethereum: 'https://etherscan.io/tx',
        arbitrum: 'https://arbiscan.io/tx',
        optimism: 'https://optimistic.etherscan.io/tx',
        base: 'https://basescan.org/tx',
        polygon: 'https://polygonscan.com/tx',
        bsc: 'https://bscscan.com/tx',
    };

    const baseUrl = chainKey ? explorers[chainKey] : undefined;
    return baseUrl ? `${baseUrl}/${hash}` : `https://etherscan.io/tx/${hash}`;
}

function getNetworkSymbol(chainKey: string | undefined): string {
    const symbols: Record<string, string> = {
        ethereum: 'ETH',
        arbitrum: 'ETH',
        optimism: 'ETH',
        base: 'ETH',
        polygon: 'MATIC',
        bsc: 'BNB',
    };

    return (chainKey && symbols[chainKey]) || 'ETH';
}

function renderAssetAmounts(tx: OctavTransaction): string {
    if (tx.assetsOut && tx.assetsOut.length > 0) {
        const asset = tx.assetsOut[0];
        return formatTokenAmount(asset.amount, asset.symbol);
    }

    if (tx.assetsIn && tx.assetsIn.length > 0) {
        const asset = tx.assetsIn[0];
        return formatTokenAmount(asset.amount, asset.symbol);
    }

    return '0';
}

function formatValueAmount(value: string, decimals: number = 18): string {
    if (!value) return '0';
    if (value.includes('.')) {
        const parsed = Number(value);
        if (Number.isNaN(parsed)) return value;
        return trimTrailingZeros(parsed.toFixed(6));
    }

    try {
        const raw = BigInt(value);
        const divisor = BigInt(10) ** BigInt(decimals);
        const integerPart = raw / divisor;
        const fractionalPart = raw % divisor;
        if (fractionalPart === BigInt(0)) return integerPart.toString();

        const fracString = fractionalPart.toString().padStart(decimals, '0');
        const trimmedFrac = fracString.replace(/0+$/, '').slice(0, 6);
        return `${integerPart.toString()}.${trimmedFrac || '0'}`;
    } catch {
        return value;
    }
}

function formatTokenAmount(amount: string, symbol?: string): string {
    const parsed = Number(amount);
    if (Number.isNaN(parsed)) {
        return `${amount} ${symbol || ''}`.trim();
    }
    return `${trimTrailingZeros(parsed.toFixed(6))} ${symbol || ''}`.trim();
}

function trimTrailingZeros(value: string): string {
    if (!value.includes('.')) return value;
    const trimmed = value.replace(/\.?0+$/, '');
    return trimmed.length > 0 ? trimmed : '0';
}

