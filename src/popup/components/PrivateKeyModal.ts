export function renderPrivateKeyModal(
    privateKey: string,
    onClose: () => void,
    visible: boolean,
    showKey: boolean = false,
    isFirstRender: boolean = true
): string {
    if (!visible) return '';

    return `
        <div class="modal-overlay" id="private-key-modal-overlay" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            z-index: 1003;
            display: flex;
            align-items: center;
            justify-content: center;
            ${isFirstRender ? 'animation: fadeIn 0.2s;' : ''}
        ">
            <div class="modal-content" id="private-key-modal-content" style="
                background: var(--r-neutral-bg1);
                border-radius: 16px;
                padding: 24px;
                width: 90%;
                max-width: 500px;
                box-shadow: var(--r-shadow-modal);
                ${isFirstRender ? 'animation: slideUp 0.3s;' : ''}
            ">
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                ">
                    <h3 style="
                        font-size: 20px;
                        font-weight: 600;
                        color: var(--r-neutral-title1);
                        margin: 0;
                    ">Private Key</h3>
                    <button id="private-key-modal-close" style="
                        background: transparent;
                        border: none;
                        cursor: pointer;
                        padding: 4px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: var(--r-neutral-foot);
                    " title="Close">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="15" y1="5" x2="5" y2="15"></line>
                            <line x1="5" y1="5" x2="15" y2="15"></line>
                        </svg>
                    </button>
                </div>
                <p style="
                    font-size: 14px;
                    color: var(--r-neutral-body);
                    margin: 0 0 16px 0;
                    line-height: 1.5;
                ">⚠️ Keep this private key secure and never share it with anyone. Anyone with this key can access your funds.</p>
                <div style="
                    padding: 24px;
                    background: var(--r-neutral-bg2);
                    border-radius: 8px;
                    margin-bottom: 16px;
                    text-align: center;
                    cursor: pointer;
                    transition: background 0.2s;
                    ${showKey ? 'display: none;' : ''}
                " id="show-private-key-btn" onclick="event.stopPropagation();" onmouseenter="this.style.background='var(--r-neutral-bg3)'" onmouseleave="this.style.background='var(--r-neutral-bg2)'">
                    <div style="
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 12px;
                    ">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--r-neutral-foot);">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span style="
                            font-size: 14px;
                            color: var(--r-neutral-title1);
                            font-weight: 500;
                        ">Click to show private key</span>
                    </div>
                </div>
                <div style="
                    padding: 16px;
                    background: var(--r-neutral-bg2);
                    border-radius: 8px;
                    margin-bottom: 16px;
                    word-break: break-all;
                    font-family: monospace;
                    font-size: 13px;
                    color: var(--r-neutral-title1);
                    position: relative;
                    ${!showKey ? 'display: none;' : ''}
                " id="private-key-container">
                    <div id="private-key-text" style="user-select: all;">${showKey ? privateKey : ''}</div>
                </div>
                <div style="display: flex; gap: 12px;">
                    <button id="private-key-close-btn" style="
                        flex: 1;
                        padding: 12px 20px;
                        border-radius: 8px;
                        font-size: 15px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.2s;
                        background: white;
                        color: var(--r-blue-default);
                        border: 1px solid var(--r-neutral-line);
                    " onmouseenter="this.style.background='var(--r-neutral-bg2)'" onmouseleave="this.style.background='white'">
                        Close
                    </button>
                    <button id="private-key-copy-btn" style="
                        flex: 1;
                        padding: 12px 20px;
                        border-radius: 8px;
                        font-size: 15px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.2s;
                        background: var(--r-blue-default);
                        color: white;
                        border: 1px solid var(--r-blue-default);
                        ${!showKey ? 'display: none;' : ''}
                    " onmouseenter="this.style.opacity='0.9'" onmouseleave="this.style.opacity='1'">
                        Copy
                    </button>
                </div>
            </div>
        </div>
    `;
}

