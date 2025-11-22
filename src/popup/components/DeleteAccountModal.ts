import { formatAddress, getDisplayName } from '../utils/account';

export function renderDeleteAccountModal(
    account: any,
    onConfirm: (password: string) => void,
    onCancel: () => void,
    visible: boolean
): string {
    if (!visible || !account) return '';

    const displayName = getDisplayName(account);
    const address = formatAddress(account.address);

    return `
        <div class="modal-overlay" id="delete-account-overlay" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.2s;
        ">
            <div class="modal-content" style="
                background: var(--r-neutral-bg1);
                border-radius: 16px;
                padding: 24px;
                width: 90%;
                max-width: 400px;
                box-shadow: var(--r-shadow-modal);
                animation: slideUp 0.3s;
            ">
                <!-- Title -->
                <h2 style="
                    font-size: 20px;
                    font-weight: 600;
                    color: var(--r-neutral-title1);
                    margin: 0 0 12px 0;
                ">Delete address</h2>

                <!-- Intro Text -->
                <p style="
                    font-size: 14px;
                    color: var(--r-neutral-body);
                    margin: 0 0 24px 0;
                    line-height: 1.5;
                ">Before you delete, keep the following points in mind to understand how to protect your assets.</p>

                <!-- Confirmation Checkboxes -->
                <div style="
                    margin-bottom: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                ">
                    <!-- Checkbox 1 -->
                    <label style="
                        display: flex;
                        align-items: flex-start;
                        gap: 12px;
                        padding: 16px;
                        background: var(--r-neutral-bg2);
                        border-radius: 8px;
                        cursor: pointer;
                        transition: all 0.2s;
                    " onmouseenter="this.style.background='var(--r-neutral-bg3)'" onmouseleave="this.style.background='var(--r-neutral-bg2)'">
                        <input 
                            type="checkbox" 
                            id="delete-confirm-1"
                            style="
                                width: 20px;
                                height: 20px;
                                margin-top: 2px;
                                cursor: pointer;
                                flex-shrink: 0;
                            "
                        />
                        <span style="
                            font-size: 14px;
                            color: var(--r-neutral-title1);
                            line-height: 1.5;
                        ">I understand that if I delete this address, the corresponding Private Key & Seed Phrase of this address will be deleted and Wolfy will NOT be able to recover it.</span>
                    </label>

                    <!-- Checkbox 2 -->
                    <label style="
                        display: flex;
                        align-items: flex-start;
                        gap: 12px;
                        padding: 16px;
                        background: var(--r-neutral-bg2);
                        border-radius: 8px;
                        cursor: pointer;
                        transition: all 0.2s;
                    " onmouseenter="this.style.background='var(--r-neutral-bg3)'" onmouseleave="this.style.background='var(--r-neutral-bg2)'">
                        <input 
                            type="checkbox" 
                            id="delete-confirm-2"
                            style="
                                width: 20px;
                                height: 20px;
                                margin-top: 2px;
                                cursor: pointer;
                                flex-shrink: 0;
                            "
                        />
                        <span style="
                            font-size: 14px;
                            color: var(--r-neutral-title1);
                            line-height: 1.5;
                        ">I confirm that I have backed up the private key or Seed Phrase and I'm ready to delete it now.</span>
                    </label>
                </div>

                <!-- Password Input -->
                <div style="
                    margin-bottom: 24px;
                ">
                    <input
                        type="password"
                        id="delete-account-password"
                        placeholder="Enter the Password to Confirm"
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
                    />
                    <div id="delete-account-password-error" style="
                        margin-top: 8px;
                        font-size: 13px;
                        color: var(--r-red-default);
                        display: none;
                    "></div>
                </div>

                <!-- Action Buttons -->
                <div class="modal-footer" style="
                    display: flex;
                    gap: 12px;
                ">
                    <button id="delete-account-cancel" style="
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
                    <button id="delete-account-confirm" style="
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
                        opacity: 0.5;
                    " disabled>
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    `;
}
