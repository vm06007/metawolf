export function renderSecurityConfirmModal(
    onConfirm: (deleteKey: boolean) => void,
    onCancel: () => void,
    visible: boolean
): string {
    if (!visible) return '';

    return `
        <div class="form-modal-overlay" id="security-confirm-overlay" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.4);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.2s;
        ">
            <div class="form-modal" style="
                width: 360px;
                background: var(--r-neutral-bg1);
                border-radius: 16px;
                padding: 24px;
                display: flex;
                flex-direction: column;
                gap: 20px;
                animation: slideUp 0.3s;
            ">
                <h3 style="
                    font-size: 20px;
                    font-weight: 500;
                    color: var(--r-neutral-title1);
                    margin: 0;
                ">🔒 Security Option</h3>
                <div style="
                    padding: 16px;
                    background: var(--r-neutral-bg2);
                    border-radius: 8px;
                    font-size: 13px;
                    color: var(--r-neutral-body);
                    line-height: 1.6;
                ">
                    <div style="margin-bottom: 12px; font-weight: 500; color: var(--r-neutral-title1);">
                        Delete private key from storage?
                    </div>
                    <div style="margin-bottom: 8px;">
                        <strong>✅ YES (Recommended):</strong> Private key will be permanently deleted.
                        <ul style="margin: 8px 0 0 20px; padding: 0;">
                            <li>Funds can ONLY be accessed with your HaLo chip</li>
                            <li>Even if storage is compromised, attacker cannot steal funds</li>
                            <li>You MUST have your HaLo chip to sign transactions</li>
                        </ul>
                    </div>
                    <div>
                        <strong>❌ NO:</strong> Private key remains stored.
                        <ul style="margin: 8px 0 0 20px; padding: 0;">
                            <li>If storage is compromised, attacker can steal funds</li>
                            <li>Less secure but allows backup access</li>
                        </ul>
                    </div>
                </div>
                <div style="display: flex; gap: 12px;">
                    <button 
                        id="security-confirm-no"
                        style="
                            flex: 1;
                            padding: 12px;
                            border: 1px solid var(--r-neutral-line);
                            border-radius: 8px;
                            background: var(--r-neutral-card1);
                            color: var(--r-neutral-title1);
                            font-size: 14px;
                            font-weight: 500;
                            cursor: pointer;
                        "
                    >Keep Private Key</button>
                    <button 
                        id="security-confirm-yes"
                        style="
                            flex: 1;
                            padding: 12px;
                            border: none;
                            border-radius: 8px;
                            background: var(--r-green-default);
                            color: white;
                            font-size: 14px;
                            font-weight: 500;
                            cursor: pointer;
                        "
                    >Delete Private Key</button>
                </div>
                <button 
                    id="security-confirm-cancel"
                    style="
                        padding: 8px;
                        border: none;
                        background: transparent;
                        color: var(--r-neutral-foot);
                        font-size: 13px;
                        cursor: pointer;
                        text-align: center;
                    "
                >Cancel</button>
            </div>
        </div>
    `;
}

