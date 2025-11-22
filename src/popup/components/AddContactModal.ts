export function renderAddContactModal(
    onConfirm: (address: string, name?: string) => void,
    onClose: () => void,
    visible: boolean
): string {
    if (!visible) return '';

    return `
        <div class="add-contact-modal-overlay" id="add-contact-overlay" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.4);
            z-index: 1000;
            display: flex;
            align-items: flex-end;
            animation: fadeIn 0.2s;
        ">
            <div class="add-contact-modal" style="
                width: 100%;
                max-height: 80%;
                background: var(--r-neutral-bg1);
                border-radius: 16px 16px 0 0;
                padding: 0;
                display: flex;
                flex-direction: column;
                animation: slideUp 0.3s;
            ">
                <div style="
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    border-bottom: 1px solid var(--r-neutral-line);
                ">
                    <div>
                        <h3 style="
                            font-size: 20px;
                            font-weight: 500;
                            color: var(--r-neutral-title1);
                            margin: 0 0 4px 0;
                        ">Add Contacts</h3>
                        <p style="
                            font-size: 12px;
                            color: var(--r-neutral-foot);
                            margin: 0;
                        ">You can also use it as a watch-only address</p>
                    </div>
                    <button id="add-contact-close" style="
                        background: none;
                        border: none;
                        cursor: pointer;
                        padding: 4px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                            <path d="M5 5L15 15M15 5L5 15" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
                <div style="
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                ">
                    <div style="margin-bottom: 16px;">
                        <label style="
                            display: block;
                            font-size: 14px;
                            font-weight: 500;
                            color: var(--r-neutral-title1);
                            margin-bottom: 8px;
                        ">Name (Optional)</label>
                        <input
                            type="text"
                            id="contact-name-input"
                            placeholder="Enter a nickname (e.g., Vitalik, Whale)"
                            style="
                                width: 100%;
                                padding: 12px;
                                border: 1px solid var(--r-neutral-line);
                                border-radius: 8px;
                                font-size: 14px;
                                background: var(--r-neutral-bg1);
                                color: var(--r-neutral-title1);
                                box-sizing: border-box;
                            "
                        />
                    </div>
                    <div style="margin-bottom: 16px;">
                        <label style="
                            display: block;
                            font-size: 14px;
                            font-weight: 500;
                            color: var(--r-neutral-title1);
                            margin-bottom: 8px;
                        ">Address / ENS</label>
                        <textarea
                            id="contact-address-input"
                            placeholder="Enter address or ENS name (e.g., vitalik.eth)"
                            style="
                                width: 100%;
                                min-height: 80px;
                                padding: 12px;
                                border: 1px solid var(--r-neutral-line);
                                border-radius: 8px;
                                font-size: 14px;
                                font-family: monospace;
                                resize: vertical;
                                background: var(--r-neutral-bg1);
                                color: var(--r-neutral-title1);
                                box-sizing: border-box;
                            "
                        ></textarea>
                        <div id="contact-ens-result" style="
                            margin-top: 8px;
                            padding: 8px 12px;
                            background: var(--r-blue-light1);
                            border-radius: 6px;
                            font-size: 12px;
                            color: var(--r-blue-default);
                            display: none;
                            cursor: pointer;
                        "></div>
                    </div>
                    <div id="contact-error" style="
                        padding: 12px;
                        background: rgba(255, 77, 79, 0.1);
                        border-radius: 8px;
                        color: #ff4d4f;
                        font-size: 12px;
                        display: none;
                        margin-bottom: 16px;
                    "></div>
                </div>
                <div style="
                    padding: 20px;
                    border-top: 1px solid var(--r-neutral-line);
                ">
                    <button id="add-contact-confirm-btn" style="
                        width: 100%;
                        padding: 14px;
                        background: var(--r-blue-default);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        font-size: 15px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: opacity 0.2s;
                    " onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    `;
}

