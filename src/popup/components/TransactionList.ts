import { formatAddress } from '../utils/account';

export interface Transaction {
    id: string;
    type: 'send' | 'receive' | 'swap' | 'approval' | 'exec' | 'deposit' | 'repay';
    status: 'pending' | 'confirmed' | 'failed';
    amount: string;
    amountUsd: string;
    from?: string;
    to?: string;
    timestamp: number;
    chainId?: number;
    txHash?: string;
}

export function renderTransactionList(transactions: Transaction[] = [], selectedAccount?: any): string {
    if (transactions.length === 0) {
        return `
            <div class="transaction-list-empty">
                <div class="empty-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M8 8H16M8 12H16M8 16H12" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </div>
                <div class="empty-title">No transactions yet</div>
                <div class="empty-desc">Your transaction history will appear here</div>
            </div>
        `;
    }

    // Group transactions by date
    const grouped = groupByDate(transactions);
    const dates = Object.keys(grouped).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    return `
        <div class="transaction-list">
            ${dates.map(date => `
                <div class="transaction-group">
                    <div class="transaction-group-date">${formatDate(date)}</div>
                    ${grouped[date].map(tx => renderTransactionItem(tx)).join('')}
                </div>
            `).join('')}
        </div>
    `;
}

function groupByDate(transactions: Transaction[]): Record<string, Transaction[]> {
    const grouped: Record<string, Transaction[]> = {};
    transactions.forEach(tx => {
        const date = new Date(tx.timestamp).toDateString();
        if (!grouped[date]) {
            grouped[date] = [];
        }
        grouped[date].push(tx);
    });
    return grouped;
}

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
}

function renderTransactionItem(tx: Transaction): string {
    const typeConfig = getTransactionTypeConfig(tx.type);
    const statusClass = tx.status === 'confirmed' ? 'confirmed' : tx.status === 'pending' ? 'pending' : 'failed';
    
    return `
        <div class="transaction-item" data-tx-id="${tx.id}">
            <div class="transaction-icon ${typeConfig.iconClass}">
                ${typeConfig.iconSvg}
            </div>
            <div class="transaction-info">
                <div class="transaction-type-row">
                    <span class="transaction-type">${typeConfig.label}</span>
                    <span class="transaction-status ${statusClass}">${tx.status === 'confirmed' ? 'Confirmed' : tx.status === 'pending' ? 'Pending' : 'Failed'}</span>
                </div>
                <div class="transaction-time">${formatTime(tx.timestamp)}</div>
            </div>
            <div class="transaction-amount">
                <div class="transaction-amount-crypto">${tx.amount}</div>
                <div class="transaction-amount-usd">${tx.amountUsd}</div>
            </div>
        </div>
    `;
}

function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hr ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getTransactionTypeConfig(type: Transaction['type']): { label: string; iconSvg: string; iconClass: string } {
    const configs: Record<string, { label: string; iconSvg: string; iconClass: string }> = {
        send: {
            label: 'Sent',
            iconClass: 'icon-send',
            iconSvg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 12L21 12M16 7L21 12L16 17M21 12H3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        },
        receive: {
            label: 'Received',
            iconClass: 'icon-receive',
            iconSvg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 12L3 12M8 7L3 12L8 17M3 12H21" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        },
        swap: {
            label: 'Swap',
            iconClass: 'icon-swap',
            iconSvg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        },
        approval: {
            label: 'Approval',
            iconClass: 'icon-approval',
            iconSvg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        },
        exec: {
            label: 'Exec',
            iconClass: 'icon-exec',
            iconSvg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 6V4M6 12H4M20 12H18M12 18V20M7.5 7.5L6 6M18 18L16.5 16.5M18 6L16.5 7.5M7.5 16.5L6 18M12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        },
        deposit: {
            label: 'Deposit',
            iconClass: 'icon-deposit',
            iconSvg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2L2 7L12 12L22 7L12 2Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 17L12 22L22 17" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12L12 17L22 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        },
        repay: {
            label: 'Repay',
            iconClass: 'icon-repay',
            iconSvg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2L2 7L12 12L22 7L12 2Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 17L12 22L22 17" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        }
    };

    return configs[type] || configs.send;
}

