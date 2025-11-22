export function renderImportAccountForm(
    onConfirm: (privateKey: string, name?: string) => void,
    onCancel: () => void,
    visible: boolean
): string {
    if (!visible) return '';

    return `
        <div class="form-modal-overlay" id="import-account-overlay" style="
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
                ">Import Account</h3>
                <div>
                    <label style="
                        display: block;
                        font-size: 13px;
                        color: var(--r-neutral-body);
                        margin-bottom: 8px;
                    ">Private Key</label>
                    <textarea 
                        id="import-account-private-key"
                        placeholder="Enter private key"
                        rows="3"
                        style="
                            width: 100%;
                            padding: 12px 16px;
                            border: 1px solid var(--r-neutral-line);
                            border-radius: 8px;
                            font-size: 14px;
                            font-family: monospace;
                            background: var(--r-neutral-card1);
                            color: var(--r-neutral-title1);
                            resize: vertical;
                        "
                    ></textarea>
                </div>
                <div>
                    <label style="
                        display: block;
                        font-size: 13px;
                        color: var(--r-neutral-body);
                        margin-bottom: 8px;
                    ">Account Name (optional)</label>
                    <input 
                        type="text" 
                        id="import-account-name"
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
                    />
                </div>
                <div style="display: flex; gap: 12px;">
                    <button 
                        id="import-account-cancel"
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
                        id="import-account-confirm"
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
                    >Import</button>
                </div>
            </div>
        </div>
    `;
}

