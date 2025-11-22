import type { UserAsset } from '@avail-project/nexus-core';
import { CHAIN_METADATA } from '@avail-project/nexus-core';
import { getChainWhiteLogo } from '../utils/chain-icons';

export interface SendScreenProps {
    accountName: string;
    balance: string; // Total USD balance (for backward compatibility)
    ethBalance?: string; // ETH balance to display in send screen
    assets: UserAsset[];
    onBack: () => void;
    onSend: (params: {
        token: string;
        amount: string;
        recipient: string;
        chainId: number;
        sourceChains?: number[];
    }) => Promise<void>;
    hideBalance?: boolean;
    onToggleVisibility?: () => void;
}

export function renderSendScreen(props: SendScreenProps): string {
    const { accountName, balance, ethBalance, assets, onBack, onSend, hideBalance = false, onToggleVisibility } = props;
    // In send mode, display ETH balance (like Halo tag does) instead of total USD balance
    const displayBalance = hideBalance 
        ? '***' 
        : (ethBalance !== undefined ? `${ethBalance} ETH` : `$${balance}`);

    // Get available tokens from assets
    const availableTokens = assets.map(asset => ({
        symbol: asset.symbol,
        balance: asset.balance,
        balanceInFiat: asset.balanceInFiat || 0,
        icon: asset.icon,
    }));

    // Always include ETH as an option if not already present
    const hasETH = availableTokens.some(t => t.symbol === 'ETH' || t.symbol === 'WETH');
    if (!hasETH) {
        availableTokens.unshift({
            symbol: 'ETH',
            balance: '0',
            balanceInFiat: 0,
            icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
        });
    }

    // Get default token (ETH)
    const defaultToken = availableTokens.find(t => t.symbol === 'ETH') || availableTokens[0];
    const defaultTokenIcon = defaultToken?.icon || (defaultToken?.symbol === 'ETH' ? 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png' : null);
    const defaultTokenBalance = defaultToken ? parseFloat(defaultToken.balance) : 0;

    // Get available chains from CHAIN_METADATA
    const chainsFromMetadata = Object.entries(CHAIN_METADATA).map(([chainId, metadata]) => ({
        id: parseInt(chainId),
        name: metadata.name,
        logo: metadata.logo,
    }));
    
    // Add Zircuit if not already in CHAIN_METADATA (use colored logo, not white)
    const zircuitChainId = 48900;
    const zircuitLogo = 'https://static.debank.com/image/chain/logo_url/zircuit/0571a12255432950da5112437058fa5b.png';
    const hasZircuit = chainsFromMetadata.some(c => c.id === zircuitChainId);
    
    let availableChains = hasZircuit 
        ? chainsFromMetadata.map(chain => 
            chain.id === zircuitChainId 
                ? { ...chain, logo: zircuitLogo } // Use colored logo
                : chain
          )
        : [
            ...chainsFromMetadata,
            {
                id: zircuitChainId,
                name: 'Zircuit Mainnet',
                logo: zircuitLogo,
            }
        ];
    
    // Sort chains: Ethereum (1) first, then second chain, then Zircuit (48900) 3rd, then rest
    const ethereum = availableChains.find(c => c.id === 1);
    const zircuit = availableChains.find(c => c.id === zircuitChainId);
    const others = availableChains.filter(c => c.id !== 1 && c.id !== zircuitChainId).sort((a, b) => a.id - b.id);
    
    if (ethereum && zircuit) {
        availableChains = [
            ethereum, // 1st: Ethereum
            ...others.slice(0, 1), // 2nd: First other chain
            zircuit, // 3rd: Zircuit
            ...others.slice(1) // Rest: Remaining chains
        ];
    } else if (ethereum) {
        // If no Zircuit, just put Ethereum first
        availableChains = [ethereum, ...others];
    } else {
        // No Ethereum, just sort by id
        availableChains.sort((a, b) => a.id - b.id);
    }

    // Get default chain (Ethereum mainnet - chainId 1)
    const defaultChain = availableChains.find(c => c.id === 1) || availableChains[0];
    const defaultChainLogo = defaultChain ? (getChainWhiteLogo(defaultChain.id) || defaultChain.logo) : null;

    return `
        <div class="send-screen">
            <div class="send-nav">
                <div class="send-nav-left" id="send-back-btn">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12.5 15L7.5 10L12.5 5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="send-nav-content">
                    <div class="send-account">
                        <div class="send-account-icon">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <circle cx="10" cy="10" r="10" fill="rgba(255,255,255,0.2)"/>
                                <circle cx="10" cy="10" r="6" fill="rgba(255,255,255,0.5)"/>
                            </svg>
                        </div>
                        <div class="send-account-content">
                            <div class="send-account-row">
                                <div class="send-account-name" title="${accountName}">${accountName}</div>
                                <div class="send-account-balance" title="${hideBalance ? 'Balance hidden' : (ethBalance !== undefined ? `${ethBalance} ETH` : `$${balance}`)}">${displayBalance}</div>
                            </div>
                        </div>
                    </div>
                </div>
                ${onToggleVisibility ? `
                <div class="send-nav-right" id="send-toggle-visibility-btn">
                    ${hideBalance ? `
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.5 10C2.5 10 5.5 4.5 10 4.5C14.5 4.5 17.5 10 17.5 10C17.5 10 14.5 15.5 10 15.5C5.5 15.5 2.5 10 2.5 10Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M12.5 10C12.5 11.3807 11.3807 12.5 10 12.5C8.61929 12.5 7.5 11.3807 7.5 10C7.5 8.61929 8.61929 7.5 10 7.5C11.3807 7.5 12.5 8.61929 12.5 10Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M3.75 3.75L16.25 16.25" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    ` : `
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 3C6 3 2.73 5.11 1 8.5C2.73 11.89 6 14 10 14C14 14 17.27 11.89 19 8.5C17.27 5.11 14 3 10 3ZM10 12.5C7.52 12.5 5.5 10.48 5.5 8C5.5 5.52 7.52 3.5 10 3.5C12.48 3.5 14.5 5.52 14.5 8C14.5 10.48 12.48 12.5 10 12.5ZM10 5.5C8.62 5.5 7.5 6.62 7.5 8C7.5 9.38 8.62 10.5 10 10.5C11.38 10.5 12.5 9.38 12.5 8C12.5 6.62 11.38 5.5 10 5.5Z" fill="white" fill-opacity="0.9"/>
                    </svg>
                    `}
                </div>
                ` : ''}
            </div>

            <div class="send-form-card">
                <div class="send-form-header">Send assets</div>
                
                <!-- Token Selection -->
                <div class="send-form-section">
                    <label class="send-form-label">Token</label>
                    <div class="send-token-selector" id="send-token-selector">
                        <div class="send-token-display" id="send-token-display">
                            ${defaultToken ? `
                                ${defaultTokenIcon ? `
                                    <img src="${defaultTokenIcon}" alt="${defaultToken.symbol}" class="send-token-display-icon">
                                ` : `
                                    <div class="send-token-display-icon-fallback">${defaultToken.symbol.charAt(0)}</div>
                                `}
                                <span class="send-token-display-symbol">${defaultToken.symbol}</span>
                            ` : `
                                <div class="send-token-placeholder">Select token</div>
                            `}
                        </div>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                            <path d="M4 6L8 10L12 6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <!-- Token dropdown will be rendered as modal -->
                </div>

                <!-- Amount Input -->
                <div class="send-form-section">
                    <label class="send-form-label">Amount</label>
                    <div class="send-amount-input-wrapper">
                        <input 
                            type="text" 
                            class="send-amount-input" 
                            id="send-amount-input"
                            placeholder="0.00"
                            inputmode="decimal"
                        />
                        <button class="send-amount-max" id="send-amount-max">MAX</button>
                    </div>
                    <div class="send-amount-balance" id="send-amount-balance">${defaultToken ? `Balance: ${defaultTokenBalance.toFixed(6)} ${defaultToken.symbol}` : ''}</div>
                </div>

                <!-- Recipient Address -->
                <div class="send-form-section">
                    <label class="send-form-label">Recipient Address</label>
                    <input 
                        type="text" 
                        class="send-recipient-input" 
                        id="send-recipient-input"
                        placeholder="0x... or ENS name"
                    />
                    <div class="send-recipient-error" id="send-recipient-error" style="display: none;"></div>
                </div>

                <!-- Destination Chain -->
                <div class="send-form-section">
                    <label class="send-form-label">Destination Chain</label>
                    <div class="send-chain-selector" id="send-chain-selector">
                        <div class="send-chain-display" id="send-chain-display">
                            ${defaultChain ? `
                                ${defaultChain.logo ? `
                                    <img src="${defaultChain.logo}" alt="${defaultChain.name}" class="send-chain-display-icon">
                                ` : defaultChainLogo ? `
                                    <img src="${defaultChainLogo}" alt="${defaultChain.name}" class="send-chain-display-icon">
                                ` : `
                                    <div class="send-chain-display-icon-fallback">${defaultChain.name.charAt(0)}</div>
                                `}
                                <span class="send-chain-display-name">${defaultChain.name}</span>
                            ` : `
                                <div class="send-chain-placeholder">Select chain</div>
                            `}
                        </div>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                            <path d="M4 6L8 10L12 6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <!-- Chain dropdown will be rendered as modal -->
                </div>

                <!-- Send Button -->
                <button class="send-submit-btn" id="send-submit-btn" disabled>
                    Send
                </button>

                <!-- Error Message -->
                <div class="send-error-message" id="send-error-message" style="display: none;"></div>
            </div>
            
            <!-- Token Selector Modal -->
            <div class="send-token-modal-overlay" id="send-token-modal-overlay" style="display: none;">
                <div class="send-token-modal">
                    <div class="send-token-modal-header">
                        <h3>Select Token</h3>
                        <button id="send-token-modal-close" class="send-token-modal-close-btn">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                                <path d="M5 5L15 15M15 5L5 15" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </button>
                    </div>
                    <div class="send-token-modal-content">
                        ${availableTokens.length > 0 ? availableTokens.map(token => `
                            <div class="send-token-option" data-token="${token.symbol}">
                                ${token.icon ? `
                                    <img src="${token.icon}" alt="${token.symbol}" class="send-token-option-icon">
                                ` : `
                                    <div class="send-token-option-icon-fallback">${token.symbol.charAt(0)}</div>
                                `}
                                <div class="send-token-option-info">
                                    <div class="send-token-option-symbol">${token.symbol}</div>
                                    <div class="send-token-option-balance">${parseFloat(token.balance).toFixed(6)} ($${token.balanceInFiat.toFixed(2)})</div>
                                </div>
                            </div>
                        `).join('') : `
                            <div class="send-token-option-empty">No tokens available</div>
                        `}
                    </div>
                </div>
            </div>
            
            <!-- Chain Selector Modal -->
            <div class="send-chain-modal-overlay" id="send-chain-modal-overlay" style="display: none;">
                <div class="send-chain-modal">
                    <div class="send-chain-modal-header">
                        <h3>Select Chain</h3>
                        <button id="send-chain-modal-close" class="send-chain-modal-close-btn">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                                <path d="M5 5L15 15M15 5L5 15" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </button>
                    </div>
                    <div class="send-chain-modal-content">
                        ${availableChains.map(chain => {
                            // Use colorful logo for modal (white background), not white logo
                            const logo = chain.logo || getChainWhiteLogo(chain.id);
                            return `
                                <div class="send-chain-option" data-chain-id="${chain.id}">
                                    ${logo ? `
                                        <img src="${logo}" alt="${chain.name}" class="send-chain-option-icon">
                                    ` : `
                                        <div class="send-chain-option-icon-fallback">${chain.name.charAt(0)}</div>
                                    `}
                                    <span class="send-chain-option-name">${chain.name}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
}

