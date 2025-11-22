export function renderLockScreen(
    hasAccounts: boolean,
    password: string,
    errorMessage?: string
): string {
    return `
        <div class="lock-screen" style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 24px;
            background: linear-gradient(180deg, #7084FF 0%, rgba(255, 255, 255, 0) 100%);
        ">
            <div style="
                text-align: center;
                max-width: 400px;
                width: 100%;
            ">
                <!-- Logo/Brand -->
                <div style="
                    margin-bottom: 32px;
                    display: flex;
                    justify-content: center;
                ">
                    <div style="
                        width: 80px;
                        height: 80px;
                        border-radius: 50%;
                        background: linear-gradient(135deg, var(--r-blue-default) 0%, var(--r-blue-light1) 100%);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 48px;
                    ">
                        🐺
                    </div>
                </div>

                <!-- Title -->
                <h1 style="
                    font-size: 24px;
                    font-weight: 600;
                    color: var(--r-neutral-title1);
                    margin: 0 0 8px 0;
                ">Wolfy Wallet</h1>
                
                <!-- Subtitle -->
                <p style="
                    font-size: 14px;
                    color: var(--r-neutral-foot);
                    margin: 0 0 32px 0;
                ">Your go-to wallet for Ethereum and EVM</p>

                ${hasAccounts ? `
                    <!-- Password Input -->
                    <div style="
                        margin-bottom: 24px;
                    ">
                        <input
                            type="password"
                            id="password-input"
                            placeholder="Enter the Password to Unlock"
                            value="${password}"
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
                        ${errorMessage ? `
                            <div style="
                                margin-top: 8px;
                                font-size: 13px;
                                color: var(--r-red-default);
                                text-align: left;
                            ">${errorMessage}</div>
                        ` : ''}
                    </div>

                    <!-- Unlock Button -->
                    <button 
                        id="unlock-btn"
                        style="
                            width: 100%;
                            padding: 14px;
                            border: none;
                            border-radius: 8px;
                            font-size: 15px;
                            font-weight: 500;
                            cursor: pointer;
                            transition: all 0.2s;
                            background: var(--r-blue-default);
                            color: white;
                        "
                        onmouseenter="this.style.background='var(--r-blue-light1)'"
                        onmouseleave="this.style.background='var(--r-blue-default)'"
                    >Unlock</button>

                    <!-- Forgot Password Link -->
                    <div style="
                        margin-top: 24px;
                        text-align: center;
                    ">
                        <a 
                            id="forgot-password-link"
                            href="#"
                            style="
                                font-size: 14px;
                                color: var(--r-neutral-foot);
                                text-decoration: none;
                            "
                            onmouseenter="this.style.color='var(--r-blue-default)'"
                            onmouseleave="this.style.color='var(--r-neutral-foot)'"
                        >Forgot Password?</a>
                    </div>
                ` : `
                    <!-- No Accounts - Welcome Screen -->
                    <div style="
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                    ">
                        <button 
                            id="create-first-btn"
                            class="button button-primary"
                            style="
                                width: 100%;
                                padding: 14px;
                                border: none;
                                border-radius: 8px;
                                font-size: 15px;
                                font-weight: 500;
                                cursor: pointer;
                                transition: all 0.2s;
                                background: var(--r-blue-default);
                                color: white;
                            "
                            onmouseenter="this.style.background='var(--r-blue-light1)'"
                            onmouseleave="this.style.background='var(--r-blue-default)'"
                        >Create New Wallet</button>
                        <button 
                            id="import-first-btn"
                            class="button button-secondary"
                            style="
                                width: 100%;
                                padding: 14px;
                                border: 1px solid var(--r-neutral-line);
                                border-radius: 8px;
                                font-size: 15px;
                                font-weight: 500;
                                cursor: pointer;
                                transition: all 0.2s;
                                background: var(--r-neutral-bg1);
                                color: var(--r-neutral-title1);
                            "
                            onmouseenter="this.style.background='var(--r-neutral-bg2)'"
                            onmouseleave="this.style.background='var(--r-neutral-bg1)'"
                        >Import Wallet</button>
                    </div>
                `}
            </div>
        </div>
    `;
}
