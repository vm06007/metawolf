import { EthPriceData } from '../components/EthPricePanel';

export class EthPriceService {
    private cache: EthPriceData | null = null;
    private cacheTime: number = 0;
    private readonly CACHE_DURATION = 60000; // 1 minute

    async getEthPrice(): Promise<EthPriceData | null> {
        // Check cache first
        const now = Date.now();
        if (this.cache && (now - this.cacheTime) < this.CACHE_DURATION) {
            return this.cache;
        }

        try {
            // Fetch ETH price from CoinGecko
            const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true');
            const priceData = await priceResponse.json();

            if (!priceData.ethereum) {
                throw new Error('Failed to fetch ETH price');
            }

            // Fetch gas price from RPC
            const gasPrice = await this.getGasPrice();

            const data: EthPriceData = {
                price: priceData.ethereum.usd,
                change24h: priceData.ethereum.usd_24h_change || 0,
                gasPrice: gasPrice,
            };

            // Update cache
            this.cache = data;
            this.cacheTime = now;

            return data;
        } catch (error) {
            console.error('[EthPriceService] Error fetching ETH price:', error);
            return this.cache; // Return cached data if available, even if expired
        }
    }

    private async getGasPrice(): Promise<string> {
        try {
            // Use the RPC service to get gas price
            const { rpcService } = await import('../../core/rpc-service.js');
            const rpcUrl = rpcService.getRPCUrl(1); // Ethereum mainnet

            const response = await fetch(rpcUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_gasPrice',
                    params: [],
                    id: 1,
                }),
            });

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error.message);
            }

            // Convert from wei to gwei
            const gasPriceWei = BigInt(data.result);
            const gasPriceGwei = Number(gasPriceWei) / 1e9;
            return gasPriceGwei.toFixed(3);
        } catch (error) {
            console.error('[EthPriceService] Error fetching gas price:', error);
            return '--';
        }
    }

    clearCache(): void {
        this.cache = null;
        this.cacheTime = 0;
    }
}

export const ethPriceService = new EthPriceService();

