export function renderPasswordModal(
    title: string,
    message: string,
    onConfirm: (password: string) => void,
    onCancel: () => void,
    visible: boolean,
    isFirstRender: boolean = true
): string {
    if (!visible) return '';

    return `
        <div class="password-modal-overlay" id="password-modal-overlay" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            z-index: 1002;
            display: flex;
            align-items: center;
            justify-content: center;
            ${isFirstRender ? 'animation: fadeIn 0.2s;' : ''}
        ">
            <div class="password-modal-content" style="
                background: var(--r-neutral-bg1);
                border-radius: 16px;
                padding: 24px;
                width: 90%;
                max-width: 400px;
                box-shadow: var(--r-shadow-modal);
                ${isFirstRender ? 'animation: slideUp 0.3s;' : ''}
            ">
                <h3 style="
                    font-size: 20px;
                    font-weight: 600;
                    color: var(--r-neutral-title1);
                    margin: 0 0 12px 0;
                ">${title}</h3>
                <p style="
                    font-size: 14px;
                    color: var(--r-neutral-body);
                    margin: 0 0 24px 0;
                    line-height: 1.5;
                ">${message}</p>
                <div style="margin-bottom: 24px;">
                    <input
                        type="password"
                        id="password-modal-input"
                        placeholder="Enter your password"
                        style="
                            width: 100%;
                            padding: 14px 16px;
                            border: 1px solid var(--r-neutral-line);
                            border-radius: 8px;
                            font-size: 15px;
                            color: var(--r-neutral-title1);
                            background: var(--r-neutral-bg1);
                            transition: all 0.2s;
                            box-sizing: border-box;
                        "
                        onfocus="this.style.borderColor='var(--r-blue-default)'"
                        onblur="this.style.borderColor='var(--r-neutral-line)'"
                        autofocus
                    />
                    <div id="password-modal-error" style="
                        margin-top: 8px;
                        font-size: 13px;
                        color: var(--r-red-default);
                        display: none;
                    "></div>
                </div>
                <div style="
                    display: flex;
                    gap: 12px;
                ">
                    <button id="password-modal-cancel" style="
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
                        Cancel
                    </button>
                    <button id="password-modal-confirm" style="
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
                    " onmouseenter="this.style.opacity='0.9'" onmouseleave="this.style.opacity='1'">
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    `;
}

