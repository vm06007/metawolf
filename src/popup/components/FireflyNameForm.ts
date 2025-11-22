export function renderFireflyNameForm(
    onConfirm: (name?: string) => void,
    onCancel: () => void,
    visible: boolean,
    title: string = 'Add Firefly Wallet'
): string {
    if (!visible) return '';

    return `
        <div class="form-modal-overlay" id="firefly-name-overlay" style="
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
                ">${title}</h3>
                <div>
                    <label style="
                        display: block;
                        font-size: 13px;
                        color: var(--r-neutral-body);
                        margin-bottom: 8px;
                    ">Account Name (optional)</label>
                    <input 
                        type="text" 
                        id="firefly-name"
                        placeholder="Enter account name"
                        style="
                            width: 100%;
                            padding: 12px 16px;
                            border: 1px solid var(--r-neutral-line);
                            border-radius: 8px;
                            font-size: 14px;
                            background: var(--r-neutral-card1);
                            color: var(--r-neutral-title1);
                        "
                        onkeypress="if(event.key === 'Enter') document.getElementById('firefly-confirm').click()"
                    />
                </div>
                <div style="display: flex; gap: 12px;">
                    <button 
                        id="firefly-cancel"
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
                    >Cancel</button>
                    <button 
                        id="firefly-confirm"
                        style="
                            flex: 1;
                            padding: 12px;
                            border: none;
                            border-radius: 8px;
                            background: var(--r-blue-default);
                            color: white;
                            font-size: 14px;
                            font-weight: 500;
                            cursor: pointer;
                        "
                    >Connect</button>
                </div>
            </div>
        </div>
    `;
}

