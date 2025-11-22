export interface OctavAsset {
    symbol: string;
    amount: string;
    value?: string;
    contractAddress?: string;
}

export interface OctavTransaction {
    hash: string;
    timestamp: string;
    chain: {
        key: string;
        name: string;
    };
    from: string;
    to: string;
    type: string;
    protocol?: {
        key: string;
        name: string;
    };
    subProtocol?: {
        key: string;
        name: string;
    };
    value?: string;
    valueFiat?: string;
    fees?: string;
    feesFiat?: string;
    assetsIn?: OctavAsset[];
    assetsOut?: OctavAsset[];
    functionName?: string;
}

interface FetchTransactionsParams {
    address: string;
    limit?: number;
    offset?: number;
    hideSpam?: boolean;
    sort?: 'ASC' | 'DESC';
}

interface FetchTransactionsResult {
    transactions: OctavTransaction[];
}

const OCTAV_API_BASE = 'https://api.octav.fi/v1';
const OCTAV_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwczovL2hhc3VyYS5pby9qd3QvY2xhaW1zIjp7IngtaGFzdXJhLWRlZmF1bHQtcm9sZSI6InVzZXIiLCJ4LWhhc3VyYS1hbGxvd2VkLXJvbGVzIjpbInVzZXIiXSwieC1oYXN1cmEtdXNlci1pZCI6InRoZWRvbWUzOTg5MCJ9fQ.7ZWvFHKqb4xNPP7lhZldzI1HpFVhSvBgUuzMHvE9elM';
const DEFAULT_LIMIT = 20;

export async function fetchTransactionsFromOctav(params: FetchTransactionsParams): Promise<FetchTransactionsResult> {
    if (!params.address) {
        throw new Error('No address provided');
    }

    const limit = params.limit ?? DEFAULT_LIMIT;
    const offset = params.offset ?? 0;
    const sort = params.sort ?? 'DESC';

    const url = new URL(`${OCTAV_API_BASE}/transactions`);
    url.searchParams.set('addresses', params.address);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('sort', sort);

    if (params.hideSpam) {
        url.searchParams.set('hideSpam', 'true');
    }

    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${OCTAV_API_KEY}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to load transactions (${response.status}): ${errorText || response.statusText}`);
    }

    const data = await response.json();
    const transactions: OctavTransaction[] = Array.isArray(data) ? data : data?.transactions || [];

    return { transactions };
}

// Portfolio interfaces
export interface OctavPortfolioAsset {
    balance: string;
    symbol: string;
    price: string;
    value: string;
    contractAddress?: string;
    chain?: string;
}

export interface OctavPortfolioProtocol {
    key: string;
    name: string;
    value: string;
    assets: OctavPortfolioAsset[];
}

export interface OctavPortfolioChain {
    key: string;
    name: string;
    value: string;
    protocols: string[];
}

export interface OctavPortfolio {
    address: string;
    networth: string;
    cashBalance: string;
    dailyIncome: string;
    dailyExpense: string;
    fees: string;
    feesFiat: string;
    lastUpdated: string;
    openPnl: string;
    closedPnl: string;
    totalCostBasis: string;
    assetByProtocols: Record<string, OctavPortfolioProtocol>;
    chains: Record<string, OctavPortfolioChain>;
}

interface FetchPortfolioParams {
    addresses: string | string[];
    includeNFTs?: boolean;
    includeImages?: boolean;
    includeExplorerUrls?: boolean;
    waitForSync?: boolean;
}

export async function fetchPortfolioFromOctav(params: FetchPortfolioParams): Promise<OctavPortfolio | OctavPortfolio[]> {
    const addresses = Array.isArray(params.addresses) ? params.addresses.join(',') : params.addresses;
    
    if (!addresses) {
        throw new Error('No addresses provided');
    }

    const url = new URL(`${OCTAV_API_BASE}/portfolio`);
    url.searchParams.set('addresses', addresses);
    
    if (params.includeNFTs) {
        url.searchParams.set('includeNFTs', 'true');
    }
    if (params.includeImages) {
        url.searchParams.set('includeImages', 'true');
    }
    if (params.includeExplorerUrls) {
        url.searchParams.set('includeExplorerUrls', 'true');
    }
    if (params.waitForSync) {
        url.searchParams.set('waitForSync', 'true');
    }

    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${OCTAV_API_KEY}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to load portfolio (${response.status}): ${errorText || response.statusText}`);
    }

    const data = await response.json();
    // API may return array for multiple addresses or single object for one address
    return data as OctavPortfolio | OctavPortfolio[];
}

