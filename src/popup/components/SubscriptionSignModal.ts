interface SubscriptionSignModalParams {
    visible: boolean;
    serviceName: string;
    paymentRequirements: any;
    status: 'signing' | 'processing' | 'success';
    error?: string;
}

export function renderSubscriptionSignModal(params: SubscriptionSignModalParams): string {
    const {
        visible,
        serviceName,
        paymentRequirements,
        status,
        error,
    } = params;

    if (!visible) {
        return '';
    }

    const getStatusContent = () => {
        if (status === 'signing') {
            return {
                title: 'Sign Subscription',
                message: `Please sign to subscribe to ${serviceName}`,
                icon: '✍️',
                showButtons: true,
            };
        }
        if (status === 'processing') {
            return {
                title: 'Processing...',
                message: 'Your subscription is being processed',
                icon: '⏳',
                showButtons: false,
            };
        }
        if (status === 'success') {
            return {
                title: 'Subscribed!',
                message: `You have successfully subscribed to ${serviceName}`,
                icon: '✅',
                showButtons: false,
            };
        }
        return {
            title: 'Subscribe',
            message: `Subscribe to ${serviceName}`,
            icon: '🎙️',
            showButtons: true,
        };
    };

    const statusContent = getStatusContent();
    const paymentInfo = paymentRequirements?.accepts?.[0] || paymentRequirements;

    return `
        <div id="subscription-sign-modal-root">
            <div id="subscription-sign-modal-overlay" style="
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.4);
                backdrop-filter: blur(4px);
                z-index: 1003;
                animation: fadeIn 0.2s;
            "></div>
            <div id="subscription-sign-modal-sheet" style="
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: var(--r-neutral-bg1);
                border-radius: 20px 20px 0 0;
                max-height: 85vh;
                overflow-y: auto;
                z-index: 1004;
                box-shadow: 0 -12px 30px rgba(0, 0, 0, 0.2);
                animation: slideUp 0.3s ease-out;
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
                        ">${statusContent.title}</h3>
                        <p style="
                            margin: 0;
                            font-size: 13px;
                            color: var(--r-neutral-foot);
                        ">${statusContent.message}</p>
                    </div>
                    ${status !== 'processing' && status !== 'success' && status !== 'signing' ? `
                        <button id="subscription-sign-modal-close" style="
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
                    ` : ''}
                </div>
                <div style="
                    padding: 24px;
                ">
                    <div style="
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 20px;
                        margin-bottom: 24px;
                    ">
                        <div style="
                            font-size: 48px;
                            margin-bottom: 8px;
                        ">${statusContent.icon}</div>
                        ${paymentInfo && status === 'signing' ? `
                            <div style="
                                width: 100%;
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
                                    <div style="margin-bottom: 12px; font-weight: 500; color: var(--r-neutral-title1);">
                                        Subscription Details
                                    </div>
                                    ${paymentInfo.description ? `
                                        <div style="margin-bottom: 8px;">
                                            <strong>Description:</strong> ${paymentInfo.description}
                                        </div>
                                    ` : ''}
                                    ${paymentInfo.maxAmountRequired ? `
                                        <div style="margin-bottom: 8px;">
                                            <strong>Amount:</strong> ${paymentInfo.maxAmountRequired}
                                        </div>
                                    ` : ''}
                                    ${paymentInfo.network ? `
                                        <div style="margin-bottom: 8px;">
                                            <strong>Network:</strong> ${paymentInfo.network}
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        ` : ''}
                        ${status === 'processing' ? `
                            <div style="
                                width: 40px;
                                height: 40px;
                                border: 3px solid var(--r-neutral-line);
                                border-top-color: var(--r-blue-default);
                                border-radius: 50%;
                                animation: spin 1s linear infinite;
                            "></div>
                        ` : ''}
                    </div>
                    ${statusContent.showButtons ? `
                        <div style="
                            display: flex;
                            gap: 12px;
                        ">
                            <button 
                                id="subscription-sign-modal-cancel"
                                style="
                                    flex: 1;
                                    padding: 14px;
                                    background: var(--r-neutral-card1);
                                    color: var(--r-neutral-title1);
                                    border: 1px solid var(--r-neutral-line);
                                    border-radius: 8px;
                                    font-size: 16px;
                                    font-weight: 500;
                                    cursor: pointer;
                                "
                            >Cancel</button>
                            <button 
                                id="subscription-sign-modal-sign"
                                style="
                                    flex: 1;
                                    padding: 14px;
                                    background: var(--r-blue-default);
                                    color: white;
                                    border: none;
                                    border-radius: 8px;
                                    font-size: 16px;
                                    font-weight: 500;
                                    cursor: pointer;
                                "
                            >Sign</button>
                        </div>
                    ` : status === 'success' ? `
                        <button 
                            id="subscription-sign-modal-done"
                            style="
                                width: 100%;
                                padding: 14px;
                                background: var(--r-green-default);
                                color: white;
                                border: none;
                                border-radius: 8px;
                                font-size: 16px;
                                font-weight: 500;
                                cursor: pointer;
                            "
                        >Done</button>
                    ` : ''}
                </div>
            </div>
        </div>
        <style>
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
            }
        </style>
    `;
}

