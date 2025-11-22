export interface EthPriceData {
    price: number;
    change24h: number;
    gasPrice: string; // in Gwei
}

export function renderEthPricePanel(data: EthPriceData | null, loading: boolean = false): string {
    if (loading || !data) {
        return `
            <div class="eth-price-panel">
                <div class="eth-price-content">
                    <div class="eth-price-left">
                        <div class="eth-logo">
                            <div class="eth-logo-skeleton" style="width: 20px; height: 20px; border-radius: 50%; background: var(--r-neutral-line);"></div>
                        </div>
                        <div class="eth-price-info">
                            <div class="eth-price-amount" style="width: 60px; height: 14px; background: var(--r-neutral-line); border-radius: 2px;"></div>
                        </div>
                    </div>
                    <div class="eth-gas-info">
                        <svg class="gas-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M9.1349 13.5775V7.62273H9.53874C9.75822 7.62273 9.94258 7.8073 9.94258 8.03072V11.8193C9.94258 12.7907 10.7151 13.5775 11.6721 13.5775C12.629 13.5775 13.4016 12.7907 13.4016 11.8193V4.53362C13.4016 4.15476 13.2435 3.80505 12.9977 3.5622L11.5843 2.13421C11.3297 1.87193 10.9171 1.87193 10.6625 2.13421C10.4079 2.3965 10.4079 2.81421 10.6625 3.07649L11.5755 4.00905C11.9123 4.53362 12.0671 4.70956 12.0671 5.73817V11.829C12.0671 12.0524 11.8915 12.237 11.6633 12.237C11.4438 12.237 11.2594 12.0524 11.2594 11.829V8.04044C11.2594 7.06902 10.4869 6.28217 9.52996 6.28217H9.1349V3.03763C9.1349 2.43535 8.66082 1.95936 8.06384 1.95936H2.47152C1.88332 1.95936 1.40047 2.44507 1.40047 3.03763V13.5775H1.26878C0.900054 13.5775 0.601562 13.8787 0.601562 14.2575C0.601562 14.6364 0.900054 14.9375 1.26878 14.9375H9.26658C9.63531 14.9375 9.9338 14.6364 9.9338 14.2575C9.9338 13.8787 9.63531 13.5775 9.26658 13.5775H9.1349ZM3.3231 3.29991H7.21226C7.53709 3.29991 7.80047 3.5622 7.80047 3.89248V6.75816C7.80047 7.08845 7.53709 7.35073 7.21226 7.35073H3.3231C2.99827 7.35073 2.7349 7.08845 2.7349 6.75816V3.89248C2.7349 3.5622 2.99827 3.29991 3.3231 3.29991Z" fill="var(--r-neutral-foot, #6A7587)"/>
                        </svg>
                        <div class="gas-price-value" style="width: 40px; height: 14px; background: var(--r-neutral-line); border-radius: 2px;"></div>
                    </div>
                </div>
            </div>
        `;
    }

    // Format price like clone: $X.XX with number splitting
    const formatPrice = (price: number): string => {
        if (price < 0.01) return '<$0.01';
        return `$${price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
    };

    const formattedPrice = formatPrice(data.price);
    const changeColor = data.change24h > 0 
        ? 'var(--r-green-default)' 
        : data.change24h === 0 
        ? 'var(--r-neutral-body)' 
        : 'var(--r-red-default)';
    const changeSign = data.change24h >= 0 ? '+' : '';
    const changeText = `${changeSign}${data.change24h.toFixed(2)}%`;

    // Format gas price (remove trailing zeros)
    const gasPriceFormatted = parseFloat(data.gasPrice).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    return `
        <div class="eth-price-panel">
            <div class="eth-price-content">
                <div class="eth-price-left">
                    <div class="eth-logo">
                        <img src="https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png" 
                             alt="ETH" 
                             class="eth-logo-img"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <svg class="eth-logo-fallback" width="20" height="20" viewBox="0 0 24 24" fill="none" style="display: none;">
                            <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#627EEA"/>
                            <path d="M2 17L12 22L22 17" fill="#627EEA"/>
                            <path d="M2 12L12 17L22 12" fill="#627EEA"/>
                        </svg>
                    </div>
                    <div class="eth-price-info">
                        <div class="eth-price-amount">${formattedPrice}</div>
                        ${data.change24h !== null ? `
                            <div class="eth-price-change" style="color: ${changeColor}">${changeText}</div>
                        ` : ''}
                    </div>
                </div>
                <div class="eth-gas-info">
                    <svg class="gas-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M9.1349 13.5775V7.62273H9.53874C9.75822 7.62273 9.94258 7.8073 9.94258 8.03072V11.8193C9.94258 12.7907 10.7151 13.5775 11.6721 13.5775C12.629 13.5775 13.4016 12.7907 13.4016 11.8193V4.53362C13.4016 4.15476 13.2435 3.80505 12.9977 3.5622L11.5843 2.13421C11.3297 1.87193 10.9171 1.87193 10.6625 2.13421C10.4079 2.3965 10.4079 2.81421 10.6625 3.07649L11.5755 4.00905C11.9123 4.53362 12.0671 4.70956 12.0671 5.73817V11.829C12.0671 12.0524 11.8915 12.237 11.6633 12.237C11.4438 12.237 11.2594 12.0524 11.2594 11.829V8.04044C11.2594 7.06902 10.4869 6.28217 9.52996 6.28217H9.1349V3.03763C9.1349 2.43535 8.66082 1.95936 8.06384 1.95936H2.47152C1.88332 1.95936 1.40047 2.44507 1.40047 3.03763V13.5775H1.26878C0.900054 13.5775 0.601562 13.8787 0.601562 14.2575C0.601562 14.6364 0.900054 14.9375 1.26878 14.9375H9.26658C9.63531 14.9375 9.9338 14.6364 9.9338 14.2575C9.9338 13.8787 9.63531 13.5775 9.26658 13.5775H9.1349ZM3.3231 3.29991H7.21226C7.53709 3.29991 7.80047 3.5622 7.80047 3.89248V6.75816C7.80047 7.08845 7.53709 7.35073 7.21226 7.35073H3.3231C2.99827 7.35073 2.7349 7.08845 2.7349 6.75816V3.89248C2.7349 3.5622 2.99827 3.29991 3.3231 3.29991Z" fill="var(--r-neutral-foot, #6A7587)"/>
                    </svg>
                    <div class="gas-price-value">${gasPriceFormatted}</div>
                    <div class="gas-price-unit">Gwei</div>
                </div>
            </div>
        </div>
    `;
}

