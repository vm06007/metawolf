interface RenderSubscriptionsModalParams {
    visible: boolean;
    isFirstRender: boolean;
}

export function renderSubscriptionsModal(params: RenderSubscriptionsModalParams): string {
    const {
        visible,
        isFirstRender,
    } = params;

    if (!visible) {
        return '';
    }

    const sheetAnimation = isFirstRender ? 'animation: slideUp 0.3s ease-out;' : '';
    const overlayAnimation = isFirstRender ? 'animation: fadeIn 0.2s;' : '';

    const subscriptionServices = [
        {
            id: 'spotify',
            name: 'Spotify',
            icon: '🎵',
            description: 'Music streaming subscription',
            price: '$9.99/month',
        },
        {
            id: 'netflix',
            name: 'Netflix',
            icon: '🎬',
            description: 'Video streaming service',
            price: '$15.99/month',
        },
        {
            id: 'youtube',
            name: 'YouTube Premium',
            icon: '📺',
            description: 'Ad-free video streaming',
            price: '$13.99/month',
        },
        {
            id: 'amazon',
            name: 'Amazon Prime',
            icon: '📦',
            description: 'Shopping and streaming',
            price: '$14.99/month',
        },
        {
            id: 'apple',
            name: 'Apple Music',
            icon: '🍎',
            description: 'Music streaming service',
            price: '$10.99/month',
        },
        {
            id: 'disney',
            name: 'Disney+',
            icon: '🏰',
            description: 'Family entertainment streaming',
            price: '$10.99/month',
        },
    ];

    return `
        <div id="subscriptions-modal-root">
            <div id="subscriptions-modal-overlay" style="
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.4);
                backdrop-filter: blur(4px);
                z-index: 1001;
                ${overlayAnimation}
            "></div>
            <div id="subscriptions-modal-sheet" style="
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: var(--r-neutral-bg1);
                border-radius: 20px 20px 0 0;
                max-height: 85vh;
                overflow-y: auto;
                z-index: 1002;
                box-shadow: 0 -12px 30px rgba(0, 0, 0, 0.2);
                ${sheetAnimation}
            ">
                <div style="
                    padding: 20px 24px;
                    border-bottom: 1px solid var(--r-neutral-line);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                ">
                    <div>
                        <h3 style="
                            margin: 0 0 4px 0;
                            font-size: 18px;
                            font-weight: 600;
                            color: var(--r-neutral-title1);
                        ">Subscriptions</h3>
                        <p style="
                            margin: 0;
                            font-size: 13px;
                            color: var(--r-neutral-foot);
                        ">Manage your recurring subscriptions</p>
                    </div>
                    <button id="subscriptions-modal-close" style="
                        background: none;
                        border: none;
                        cursor: pointer;
                        padding: 4px;
                        color: var(--r-neutral-foot);
                        transition: color 0.2s;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    " onmouseenter="this.style.color='var(--r-neutral-title1)'" onmouseleave="this.style.color='var(--r-neutral-foot)'">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                            <path d="M5 5L15 15M15 5L5 15" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
                <div style="
                    padding: 24px;
                ">
                    <div style="
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                        gap: 16px;
                        margin-bottom: 24px;
                    ">
                        ${subscriptionServices.map(service => `
                            <button 
                                id="subscription-${service.id}" 
                                class="subscription-service-card"
                                style="
                                    background: var(--r-neutral-card1);
                                    border: 1px solid var(--r-neutral-line);
                                    border-radius: 12px;
                                    padding: 20px;
                                    cursor: pointer;
                                    transition: all 0.2s;
                                    text-align: center;
                                    display: flex;
                                    flex-direction: column;
                                    align-items: center;
                                    gap: 12px;
                                "
                                onmouseenter="this.style.borderColor='var(--r-blue-default)'; this.style.background='var(--r-blue-light1)'"
                                onmouseleave="this.style.borderColor='var(--r-neutral-line)'; this.style.background='var(--r-neutral-card1)'"
                            >
                                <div style="
                                    font-size: 32px;
                                    margin-bottom: 4px;
                                ">${service.icon}</div>
                                <div style="
                                    font-size: 16px;
                                    font-weight: 600;
                                    color: var(--r-neutral-title1);
                                ">${service.name}</div>
                                <div style="
                                    font-size: 12px;
                                    color: var(--r-neutral-foot);
                                    line-height: 1.4;
                                ">${service.description}</div>
                                <div style="
                                    font-size: 14px;
                                    font-weight: 500;
                                    color: var(--r-blue-default);
                                    margin-top: 4px;
                                ">${service.price}</div>
                            </button>
                        `).join('')}
                    </div>
                    <div style="
                        background: var(--r-neutral-card1);
                        border-radius: 12px;
                        padding: 16px;
                        border: 1px solid var(--r-neutral-line);
                    ">
                        <div style="
                            font-size: 13px;
                            color: var(--r-neutral-body);
                            line-height: 1.6;
                        ">
                            <p style="margin: 0 0 12px 0;">
                                Select a subscription service to set up automatic payments using your wallet.
                            </p>
                            <p style="margin: 0; font-size: 12px; color: var(--r-neutral-foot);">
                                This feature allows you to manage recurring payments directly from your crypto wallet.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

