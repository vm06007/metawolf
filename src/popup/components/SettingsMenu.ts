export function renderSettingsMenu(
    visible: boolean,
    hasPassword: boolean = false
): string {
    if (!visible) return '';

    return `
        <div class="settings-menu-overlay" id="settings-menu-overlay" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.4);
            z-index: 1000;
            animation: fadeIn 0.2s;
        "></div>
        <div class="settings-menu" id="settings-menu" style="
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: var(--r-neutral-bg1);
            border-radius: 16px 16px 0 0;
            max-height: 80vh;
            overflow-y: auto;
            z-index: 1001;
            animation: slideUp 0.3s ease-out;
            box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
        ">
            <!-- Header -->
            <div style="
                padding: 20px;
                border-bottom: 1px solid var(--r-neutral-line);
                display: flex;
                align-items: center;
                justify-content: space-between;
            ">
                <h2 style="
                    font-size: 18px;
                    font-weight: 600;
                    color: var(--r-neutral-title1);
                    margin: 0;
                ">Settings</h2>
                <button id="settings-menu-close" style="
                    background: none;
                    border: none;
                    padding: 4px;
                    cursor: pointer;
                    color: var(--r-neutral-foot);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                        <path d="M5 5L15 15M15 5L5 15" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>

            <!-- Content -->
            <div style="padding: 20px;">
                <!-- Features Section -->
                <div style="margin-bottom: 16px;">
                    <div style="
                        font-size: 12px;
                        font-weight: 400;
                        color: var(--r-neutral-foot);
                        margin-bottom: 8px;
                        line-height: normal;
                    ">Features</div>
                    <div style="
                        background: var(--r-neutral-card2, rgba(255, 255, 255, 0.06));
                        border-radius: 6px;
                        display: flex;
                        flex-direction: column;
                    ">
                        <button class="settings-menu-item" id="settings-lock-wallet" style="
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            padding: 0 16px;
                            min-height: 52px;
                            background: transparent;
                            border: 1px solid transparent;
                            border-radius: 0;
                            cursor: pointer;
                            transition: all 0.2s;
                            text-align: left;
                            width: 100%;
                            font-size: 14px;
                            font-weight: 500;
                            line-height: 16px;
                            color: var(--r-neutral-title1);
                        " onmouseenter="this.style.background='rgba(134, 151, 255, 0.2)'; this.style.borderColor='#7084FF'; this.style.borderRadius='6px'" onmouseleave="this.style.background='transparent'; this.style.borderColor='transparent'; this.style.borderRadius='0'">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" style="color: var(--r-neutral-title1); flex-shrink: 0;">
                                <rect x="5" y="9" width="10" height="8" rx="1" stroke-width="1.5"/>
                                <path d="M7 9V6C7 4.34315 8.34315 3 10 3C11.6569 3 13 4.34315 13 6V9" stroke-width="1.5"/>
                            </svg>
                            <span style="
                                flex: 1;
                                font-size: 14px;
                                font-weight: 500;
                                line-height: 16px;
                                color: var(--r-neutral-title1);
                            ">Lock Wallet</span>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" style="color: var(--r-neutral-foot); flex-shrink: 0;">
                                <path d="M6 4L10 8L6 12" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="settings-menu-item" id="settings-signature-record" style="
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            padding: 0 16px;
                            min-height: 52px;
                            background: transparent;
                            border: 1px solid transparent;
                            border-radius: 0;
                            cursor: pointer;
                            transition: all 0.2s;
                            text-align: left;
                            width: 100%;
                            font-size: 14px;
                            font-weight: 500;
                            line-height: 16px;
                            color: var(--r-neutral-title1);
                        " onmouseenter="this.style.background='rgba(134, 151, 255, 0.2)'; this.style.borderColor='#7084FF'; this.style.borderRadius='6px'" onmouseleave="this.style.background='transparent'; this.style.borderColor='transparent'; this.style.borderRadius='0'">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" style="color: var(--r-neutral-title1); flex-shrink: 0;">
                                <path d="M14 2H6C4.89543 2 4 2.89543 4 4V16C4 17.1046 4.89543 18 6 18H14C15.1046 18 16 17.1046 16 16V4C16 2.89543 15.1046 2 14 2Z" stroke-width="1.5"/>
                                <path d="M8 6H12M8 10H12M8 14H10" stroke-width="1.5" stroke-linecap="round"/>
                            </svg>
                            <span style="
                                flex: 1;
                                font-size: 14px;
                                font-weight: 500;
                                line-height: 16px;
                                color: var(--r-neutral-title1);
                            ">Signature Record</span>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" style="color: var(--r-neutral-foot); flex-shrink: 0;">
                                <path d="M6 4L10 8L6 12" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="settings-menu-item" id="settings-manage-address" style="
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            padding: 0 16px;
                            min-height: 52px;
                            background: transparent;
                            border: 1px solid transparent;
                            border-radius: 0;
                            cursor: pointer;
                            transition: all 0.2s;
                            text-align: left;
                            width: 100%;
                            font-size: 14px;
                            font-weight: 500;
                            line-height: 16px;
                            color: var(--r-neutral-title1);
                        " onmouseenter="this.style.background='rgba(134, 151, 255, 0.2)'; this.style.borderColor='#7084FF'; this.style.borderRadius='6px'" onmouseleave="this.style.background='transparent'; this.style.borderColor='transparent'; this.style.borderRadius='0'">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" style="color: var(--r-neutral-title1); flex-shrink: 0;">
                                <path d="M10 10C11.3807 10 12.5 8.88071 12.5 7.5C12.5 6.11929 11.3807 5 10 5C8.61929 5 7.5 6.11929 7.5 7.5C7.5 8.88071 8.61929 10 10 10Z" stroke-width="1.5"/>
                                <path d="M10 2.5C7.23858 2.5 5 4.73858 5 7.5C5 11.5 10 17.5 10 17.5C10 17.5 15 11.5 15 7.5C15 4.73858 12.7614 2.5 10 2.5Z" stroke-width="1.5"/>
                            </svg>
                            <span style="
                                flex: 1;
                                font-size: 14px;
                                font-weight: 500;
                                line-height: 16px;
                                color: var(--r-neutral-title1);
                            ">Manage Address</span>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" style="color: var(--r-neutral-foot); flex-shrink: 0;">
                                <path d="M6 4L10 8L6 12" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="settings-menu-item" id="settings-ecosystem" style="
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            padding: 0 16px;
                            min-height: 52px;
                            background: transparent;
                            border: 1px solid transparent;
                            border-radius: 0;
                            cursor: pointer;
                            transition: all 0.2s;
                            text-align: left;
                            width: 100%;
                            font-size: 14px;
                            font-weight: 500;
                            line-height: 16px;
                            color: var(--r-neutral-title1);
                        " onmouseenter="this.style.background='rgba(134, 151, 255, 0.2)'; this.style.borderColor='#7084FF'; this.style.borderRadius='6px'" onmouseleave="this.style.background='transparent'; this.style.borderColor='transparent'; this.style.borderRadius='0'">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" style="color: var(--r-neutral-title1); flex-shrink: 0;">
                                <circle cx="10" cy="10" r="8" stroke-width="1.5"/>
                                <path d="M10 2L12 8L18 10L12 12L10 18L8 12L2 10L8 8L10 2Z" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <span style="
                                flex: 1;
                                font-size: 14px;
                                font-weight: 500;
                                line-height: 16px;
                                color: var(--r-neutral-title1);
                            ">Ecosystem</span>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" style="color: var(--r-neutral-foot); flex-shrink: 0;">
                                <path d="M6 4L10 8L6 12" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="settings-menu-item" id="settings-mobile-sync" style="
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            padding: 0 16px;
                            min-height: 52px;
                            background: transparent;
                            border: 1px solid transparent;
                            border-radius: 0;
                            cursor: pointer;
                            transition: all 0.2s;
                            text-align: left;
                            width: 100%;
                            font-size: 14px;
                            font-weight: 500;
                            line-height: 16px;
                            color: var(--r-neutral-title1);
                        " onmouseenter="this.style.background='rgba(134, 151, 255, 0.2)'; this.style.borderColor='#7084FF'; this.style.borderRadius='6px'" onmouseleave="this.style.background='transparent'; this.style.borderColor='transparent'; this.style.borderRadius='0'">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" style="color: var(--r-neutral-title1); flex-shrink: 0;">
                                <rect x="4" y="2" width="12" height="16" rx="2" stroke-width="1.5"/>
                                <path d="M8 6H12M8 10H12" stroke-width="1.5" stroke-linecap="round"/>
                                <path d="M10 14L8 16L10 18" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M10 14L12 16L10 18" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <span style="
                                flex: 1;
                                font-size: 14px;
                                font-weight: 500;
                                line-height: 16px;
                                color: var(--r-neutral-title1);
                            ">Mobile Sync</span>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" style="color: var(--r-neutral-foot); flex-shrink: 0;">
                                <path d="M6 4L10 8L6 12" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="settings-menu-item" id="settings-search-dapps" style="
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            padding: 0 16px;
                            min-height: 52px;
                            background: transparent;
                            border: 1px solid transparent;
                            border-radius: 0;
                            cursor: pointer;
                            transition: all 0.2s;
                            text-align: left;
                            width: 100%;
                            font-size: 14px;
                            font-weight: 500;
                            line-height: 16px;
                            color: var(--r-neutral-title1);
                        " onmouseenter="this.style.background='rgba(134, 151, 255, 0.2)'; this.style.borderColor='#7084FF'; this.style.borderRadius='6px'" onmouseleave="this.style.background='transparent'; this.style.borderColor='transparent'; this.style.borderRadius='0'">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" style="color: var(--r-neutral-title1); flex-shrink: 0;">
                                <circle cx="9" cy="9" r="6" stroke-width="1.5"/>
                                <path d="M13 13L17 17" stroke-width="1.5" stroke-linecap="round"/>
                            </svg>
                            <span style="
                                flex: 1;
                                font-size: 14px;
                                font-weight: 500;
                                line-height: 16px;
                                color: var(--r-neutral-title1);
                            ">Search Dapps</span>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" style="color: var(--r-neutral-foot); flex-shrink: 0;">
                                <path d="M6 4L10 8L6 12" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="settings-menu-item" id="settings-connected-dapps" style="
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            padding: 0 16px;
                            min-height: 52px;
                            background: transparent;
                            border: 1px solid transparent;
                            border-radius: 0;
                            cursor: pointer;
                            transition: all 0.2s;
                            text-align: left;
                            width: 100%;
                            font-size: 14px;
                            font-weight: 500;
                            line-height: 16px;
                            color: var(--r-neutral-title1);
                        " onmouseenter="this.style.background='rgba(134, 151, 255, 0.2)'; this.style.borderColor='#7084FF'; this.style.borderRadius='6px'" onmouseleave="this.style.background='transparent'; this.style.borderColor='transparent'; this.style.borderRadius='0'">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" style="color: var(--r-neutral-title1); flex-shrink: 0;">
                                <rect x="3" y="3" width="14" height="14" rx="2" stroke-width="1.5"/>
                                <path d="M3 7H17M7 3V17" stroke-width="1.5" stroke-linecap="round"/>
                            </svg>
                            <span style="
                                flex: 1;
                                font-size: 14px;
                                font-weight: 500;
                                line-height: 16px;
                                color: var(--r-neutral-title1);
                            ">Connected Dapps</span>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" style="color: var(--r-neutral-foot); flex-shrink: 0;">
                                <path d="M6 4L10 8L6 12" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Settings Section -->
                <div>
                    <div style="
                        font-size: 12px;
                        font-weight: 400;
                        color: var(--r-neutral-foot);
                        margin-bottom: 8px;
                        line-height: normal;
                    ">Settings</div>
                    <div style="
                        background: var(--r-neutral-card2, rgba(255, 255, 255, 0.06));
                        border-radius: 6px;
                        display: flex;
                        flex-direction: column;
                    ">
                        <button class="settings-menu-item" id="settings-dapp-address" style="
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            padding: 0 16px;
                            min-height: 52px;
                            background: transparent;
                            border: 1px solid transparent;
                            border-radius: 0;
                            cursor: pointer;
                            transition: all 0.2s;
                            text-align: left;
                            width: 100%;
                            font-size: 14px;
                            font-weight: 500;
                            line-height: 16px;
                            color: var(--r-neutral-title1);
                        " onmouseenter="this.style.background='rgba(134, 151, 255, 0.2)'; this.style.borderColor='#7084FF'; this.style.borderRadius='6px'" onmouseleave="this.style.background='transparent'; this.style.borderColor='transparent'; this.style.borderRadius='0'">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" style="color: var(--r-neutral-title1); flex-shrink: 0;">
                                <rect x="3" y="3" width="14" height="14" rx="2" stroke-width="1.5"/>
                                <path d="M7 7L13 13M13 7L7 13" stroke-width="1.5" stroke-linecap="round"/>
                            </svg>
                            <span style="
                                flex: 1;
                                font-size: 14px;
                                font-weight: 500;
                                line-height: 16px;
                                color: var(--r-neutral-title1);
                            ">Switch Dapp Address Independently</span>
                            <div style="
                                width: 44px;
                                height: 24px;
                                background: #27c193;
                                border-radius: 12px;
                                position: relative;
                                display: flex;
                                align-items: center;
                                padding: 2px;
                                flex-shrink: 0;
                            ">
                                <div style="
                                    width: 20px;
                                    height: 20px;
                                    background: white;
                                    border-radius: 50%;
                                    margin-left: auto;
                                "></div>
                            </div>
                        </button>
                        <button class="settings-menu-item" id="settings-custom-testnet" style="
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            padding: 0 16px;
                            min-height: 52px;
                            background: transparent;
                            border: 1px solid transparent;
                            border-radius: 0;
                            cursor: pointer;
                            transition: all 0.2s;
                            text-align: left;
                            width: 100%;
                            font-size: 14px;
                            font-weight: 500;
                            line-height: 16px;
                            color: var(--r-neutral-title1);
                        " onmouseenter="this.style.background='rgba(134, 151, 255, 0.2)'; this.style.borderColor='#7084FF'; this.style.borderRadius='6px'" onmouseleave="this.style.background='transparent'; this.style.borderColor='transparent'; this.style.borderRadius='0'">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" style="color: var(--r-neutral-title1); flex-shrink: 0;">
                                <circle cx="10" cy="10" r="8" stroke-width="1.5"/>
                                <path d="M10 2L12 8L18 10L12 12L10 18L8 12L2 10L8 8L10 2Z" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <span style="
                                flex: 1;
                                font-size: 14px;
                                font-weight: 500;
                                line-height: 16px;
                                color: var(--r-neutral-title1);
                            ">Add Custom Network</span>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" style="color: var(--r-neutral-foot); flex-shrink: 0;">
                                <path d="M6 4L10 8L6 12" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="settings-menu-item" id="settings-custom-rpc" style="
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            padding: 0 16px;
                            min-height: 52px;
                            background: transparent;
                            border: 1px solid transparent;
                            border-radius: 0;
                            cursor: pointer;
                            transition: all 0.2s;
                            text-align: left;
                            width: 100%;
                            font-size: 14px;
                            font-weight: 500;
                            line-height: 16px;
                            color: var(--r-neutral-title1);
                        " onmouseenter="this.style.background='rgba(134, 151, 255, 0.2)'; this.style.borderColor='#7084FF'; this.style.borderRadius='6px'" onmouseleave="this.style.background='transparent'; this.style.borderColor='transparent'; this.style.borderRadius='0'">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" style="color: var(--r-neutral-title1); flex-shrink: 0;">
                                <circle cx="10" cy="10" r="8" stroke-width="1.5"/>
                                <path d="M10 6V14M6 10H14" stroke-width="1.5" stroke-linecap="round"/>
                            </svg>
                            <span style="
                                flex: 1;
                                font-size: 14px;
                                font-weight: 500;
                                line-height: 16px;
                                color: var(--r-neutral-title1);
                            ">Modify RPC URL</span>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" style="color: var(--r-neutral-foot); flex-shrink: 0;">
                                <path d="M6 4L10 8L6 12" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="settings-menu-item" id="settings-language" style="
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            padding: 0 16px;
                            min-height: 52px;
                            background: transparent;
                            border: 1px solid transparent;
                            border-radius: 0;
                            cursor: pointer;
                            transition: all 0.2s;
                            text-align: left;
                            width: 100%;
                            font-size: 14px;
                            font-weight: 500;
                            line-height: 16px;
                            color: var(--r-neutral-title1);
                        " onmouseenter="this.style.background='rgba(134, 151, 255, 0.2)'; this.style.borderColor='#7084FF'; this.style.borderRadius='6px'" onmouseleave="this.style.background='transparent'; this.style.borderColor='transparent'; this.style.borderRadius='0'">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" style="color: var(--r-neutral-title1); flex-shrink: 0;">
                                <path d="M10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18C14.4183 18 18 14.4183 18 10" stroke-width="1.5"/>
                                <path d="M2 10H18" stroke-width="1.5"/>
                                <path d="M10 2C12.2091 2 14 5.58172 14 10C14 14.4183 12.2091 18 10 18" stroke-width="1.5"/>
                            </svg>
                            <span style="
                                flex: 1;
                                font-size: 14px;
                                font-weight: 500;
                                line-height: 16px;
                                color: var(--r-neutral-title1);
                            ">Current Language</span>
                            <span style="
                                font-size: 14px;
                                color: var(--r-neutral-title1);
                                margin-right: 8px;
                            ">English</span>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" style="color: var(--r-neutral-foot); flex-shrink: 0;">
                                <path d="M6 4L10 8L6 12" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="settings-menu-item" id="settings-theme-mode" style="
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            padding: 0 16px;
                            min-height: 52px;
                            background: transparent;
                            border: 1px solid transparent;
                            border-radius: 0;
                            cursor: pointer;
                            transition: all 0.2s;
                            text-align: left;
                            width: 100%;
                            font-size: 14px;
                            font-weight: 500;
                            line-height: 16px;
                            color: var(--r-neutral-title1);
                        " onmouseenter="this.style.background='rgba(134, 151, 255, 0.2)'; this.style.borderColor='#7084FF'; this.style.borderRadius='6px'" onmouseleave="this.style.background='transparent'; this.style.borderColor='transparent'; this.style.borderRadius='0'">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" style="color: var(--r-neutral-title1); flex-shrink: 0;">
                                <circle cx="10" cy="10" r="8" stroke-width="1.5"/>
                                <path d="M10 2V4M10 16V18M18 10H16M4 10H2M15.6569 4.34315L14.2426 5.75736M5.75736 14.2426L4.34315 15.6569M15.6569 15.6569L14.2426 14.2426M5.75736 5.75736L4.34315 4.34315" stroke-width="1.5" stroke-linecap="round"/>
                            </svg>
                            <span style="
                                flex: 1;
                                font-size: 14px;
                                font-weight: 500;
                                line-height: 16px;
                                color: var(--r-neutral-title1);
                            ">Theme Mode</span>
                            <span style="
                                font-size: 14px;
                                color: var(--r-neutral-title1);
                                margin-right: 8px;
                            ">Light</span>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" style="color: var(--r-neutral-foot); flex-shrink: 0;">
                                <path d="M6 4L10 8L6 12" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="settings-menu-item" id="settings-auto-lock" style="
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            padding: 0 16px;
                            min-height: 52px;
                            background: transparent;
                            border: 1px solid transparent;
                            border-radius: 0;
                            cursor: pointer;
                            transition: all 0.2s;
                            text-align: left;
                            width: 100%;
                            font-size: 14px;
                            font-weight: 500;
                            line-height: 16px;
                            color: var(--r-neutral-title1);
                        " onmouseenter="this.style.background='rgba(134, 151, 255, 0.2)'; this.style.borderColor='#7084FF'; this.style.borderRadius='6px'" onmouseleave="this.style.background='transparent'; this.style.borderColor='transparent'; this.style.borderRadius='0'">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" style="color: var(--r-neutral-title1); flex-shrink: 0;">
                                <rect x="5" y="9" width="10" height="8" rx="1" stroke-width="1.5"/>
                                <path d="M7 9V6C7 4.34315 8.34315 3 10 3C11.6569 3 13 4.34315 13 6V9" stroke-width="1.5"/>
                                <circle cx="10" cy="13" r="1" fill="currentColor"/>
                            </svg>
                            <span style="
                                flex: 1;
                                font-size: 14px;
                                font-weight: 500;
                                line-height: 16px;
                                color: var(--r-neutral-title1);
                            ">Auto lock time</span>
                            <span style="
                                font-size: 14px;
                                color: var(--r-neutral-title1);
                                margin-right: 8px;
                            ">Never</span>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" style="color: var(--r-neutral-foot); flex-shrink: 0;">
                                <path d="M6 4L10 8L6 12" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="settings-menu-item" id="settings-change-password" style="
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            padding: 0 16px;
                            min-height: 52px;
                            background: transparent;
                            border: 1px solid transparent;
                            border-radius: 0;
                            cursor: pointer;
                            transition: all 0.2s;
                            text-align: left;
                            width: 100%;
                            font-size: 14px;
                            font-weight: 500;
                            line-height: 16px;
                            color: var(--r-neutral-title1);
                        " onmouseenter="this.style.background='rgba(134, 151, 255, 0.2)'; this.style.borderColor='#7084FF'; this.style.borderRadius='6px'" onmouseleave="this.style.background='transparent'; this.style.borderColor='transparent'; this.style.borderRadius='0'">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" style="color: var(--r-neutral-title1); flex-shrink: 0;">
                                <rect x="5" y="9" width="10" height="8" rx="1" stroke-width="1.5"/>
                                <path d="M7 9V6C7 4.34315 8.34315 3 10 3C11.6569 3 13 4.34315 13 6V9" stroke-width="1.5"/>
                                ${hasPassword ? '<path d="M10 12V14" stroke-width="1.5" stroke-linecap="round"/>' : ''}
                            </svg>
                            <span style="
                                flex: 1;
                                font-size: 14px;
                                font-weight: 500;
                                line-height: 16px;
                                color: var(--r-neutral-title1);
                            ">${hasPassword ? 'Change Password' : 'Set Password'}</span>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" style="color: var(--r-neutral-foot); flex-shrink: 0;">
                                <path d="M6 4L10 8L6 12" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="settings-menu-item" id="settings-clear-pending" style="
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            padding: 0 16px;
                            min-height: 52px;
                            background: transparent;
                            border: 1px solid transparent;
                            border-radius: 0;
                            cursor: pointer;
                            transition: all 0.2s;
                            text-align: left;
                            width: 100%;
                            font-size: 14px;
                            font-weight: 500;
                            line-height: 16px;
                            color: var(--r-neutral-title1);
                        " onmouseenter="this.style.background='rgba(134, 151, 255, 0.2)'; this.style.borderColor='#7084FF'; this.style.borderRadius='6px'" onmouseleave="this.style.background='transparent'; this.style.borderColor='transparent'; this.style.borderRadius='0'">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" style="color: var(--r-neutral-title1); flex-shrink: 0;">
                                <path d="M3 3L17 17M17 3L3 17" stroke-width="1.5" stroke-linecap="round"/>
                                <circle cx="10" cy="10" r="8" stroke-width="1.5"/>
                            </svg>
                            <span style="
                                flex: 1;
                                font-size: 14px;
                                font-weight: 500;
                                line-height: 16px;
                                color: var(--r-neutral-title1);
                            ">Clear Pending</span>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" style="color: var(--r-neutral-foot); flex-shrink: 0;">
                                <path d="M6 4L10 8L6 12" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- About Section -->
                <div style="margin-top: 16px;">
                    <div style="
                        font-size: 12px;
                        font-weight: 400;
                        color: var(--r-neutral-foot);
                        margin-bottom: 8px;
                        line-height: normal;
                    ">About us</div>
                    <div style="
                        background: var(--r-neutral-card2, rgba(255, 255, 255, 0.06));
                        border-radius: 6px;
                        display: flex;
                        flex-direction: column;
                    ">
                        <button class="settings-menu-item" id="settings-feedback" style="
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            padding: 0 16px;
                            min-height: 52px;
                            background: transparent;
                            border: 1px solid transparent;
                            border-radius: 0;
                            cursor: pointer;
                            transition: all 0.2s;
                            text-align: left;
                            width: 100%;
                            font-size: 14px;
                            font-weight: 500;
                            line-height: 16px;
                            color: var(--r-neutral-title1);
                        " onmouseenter="this.style.background='rgba(134, 151, 255, 0.2)'; this.style.borderColor='#7084FF'; this.style.borderRadius='6px'" onmouseleave="this.style.background='transparent'; this.style.borderColor='transparent'; this.style.borderRadius='0'">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" style="color: var(--r-neutral-title1); flex-shrink: 0;">
                                <path d="M10 2C5.58172 2 2 5.58172 2 10C2 12.2091 2.89543 14.2091 4.34315 15.6569L2 18L4.34315 15.6569C5.79086 17.1046 7.79086 18 10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2Z" stroke-width="1.5"/>
                            </svg>
                            <span style="
                                flex: 1;
                                font-size: 14px;
                                font-weight: 500;
                                line-height: 16px;
                                color: var(--r-neutral-title1);
                            ">Feedback</span>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" style="color: var(--r-neutral-foot); flex-shrink: 0;">
                                <path d="M6 4L10 8L6 12" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="settings-menu-item" id="settings-version" style="
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            padding: 0 16px;
                            min-height: 52px;
                            background: transparent;
                            border: 1px solid transparent;
                            border-radius: 0;
                            cursor: pointer;
                            transition: all 0.2s;
                            text-align: left;
                            width: 100%;
                            font-size: 14px;
                            font-weight: 500;
                            line-height: 16px;
                            color: var(--r-neutral-title1);
                        " onmouseenter="this.style.background='rgba(134, 151, 255, 0.2)'; this.style.borderColor='#7084FF'; this.style.borderRadius='6px'" onmouseleave="this.style.background='transparent'; this.style.borderColor='transparent'; this.style.borderRadius='0'">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" style="color: var(--r-neutral-title1); flex-shrink: 0;">
                                <rect x="3" y="3" width="14" height="14" rx="2" stroke-width="1.5"/>
                                <path d="M7 7H13M7 11H13M7 15H10" stroke-width="1.5" stroke-linecap="round"/>
                            </svg>
                            <span style="
                                flex: 1;
                                font-size: 14px;
                                font-weight: 500;
                                line-height: 16px;
                                color: var(--r-neutral-title1);
                            ">Current Version</span>
                            <span style="
                                font-size: 14px;
                                color: var(--r-neutral-title1);
                                margin-right: 8px;
                            ">1.0.0</span>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" style="color: var(--r-neutral-foot); flex-shrink: 0;">
                                <path d="M6 4L10 8L6 12" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="settings-menu-item" id="settings-supported-chains" style="
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            padding: 0 16px;
                            min-height: 52px;
                            background: transparent;
                            border: 1px solid transparent;
                            border-radius: 0;
                            cursor: pointer;
                            transition: all 0.2s;
                            text-align: left;
                            width: 100%;
                            font-size: 14px;
                            font-weight: 500;
                            line-height: 16px;
                            color: var(--r-neutral-title1);
                        " onmouseenter="this.style.background='rgba(134, 151, 255, 0.2)'; this.style.borderColor='#7084FF'; this.style.borderRadius='6px'" onmouseleave="this.style.background='transparent'; this.style.borderColor='transparent'; this.style.borderRadius='0'">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" style="color: var(--r-neutral-title1); flex-shrink: 0;">
                                <circle cx="10" cy="10" r="8" stroke-width="1.5"/>
                                <path d="M10 2L12 8L18 10L12 12L10 18L8 12L2 10L8 8L10 2Z" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <span style="
                                flex: 1;
                                font-size: 14px;
                                font-weight: 500;
                                line-height: 16px;
                                color: var(--r-neutral-title1);
                            ">Integrated Chains</span>
                            <span style="
                                font-size: 14px;
                                color: var(--r-neutral-title1);
                                margin-right: 8px;
                            ">1</span>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" style="color: var(--r-neutral-foot); flex-shrink: 0;">
                                <path d="M6 4L10 8L6 12" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="settings-menu-item" id="settings-follow-us" style="
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            padding: 0 16px;
                            min-height: 52px;
                            background: transparent;
                            border: 1px solid transparent;
                            border-radius: 0;
                            cursor: pointer;
                            transition: all 0.2s;
                            text-align: left;
                            width: 100%;
                            font-size: 14px;
                            font-weight: 500;
                            line-height: 16px;
                            color: var(--r-neutral-title1);
                        " onmouseenter="this.style.background='rgba(134, 151, 255, 0.2)'; this.style.borderColor='#7084FF'; this.style.borderRadius='6px'" onmouseleave="this.style.background='transparent'; this.style.borderColor='transparent'; this.style.borderRadius='0'">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" style="color: var(--r-neutral-title1); flex-shrink: 0;">
                                <path d="M10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2Z" stroke-width="1.5"/>
                                <path d="M10 6V14M6 10H14" stroke-width="1.5" stroke-linecap="round"/>
                            </svg>
                            <span style="
                                flex: 1;
                                font-size: 14px;
                                font-weight: 500;
                                line-height: 16px;
                                color: var(--r-neutral-title1);
                            ">Follow Us</span>
                            <div style="display: flex; gap: 12px; align-items: center; flex-shrink: 0;">
                                <a href="https://twitter.com/rabby_io" target="_blank" rel="noreferrer" style="
                                    width: 20px;
                                    height: 20px;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    color: var(--r-neutral-foot);
                                    transition: color 0.2s;
                                " onmouseenter="this.style.color='#1DA1F2'" onmouseleave="this.style.color='var(--r-neutral-foot)'">
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                                    </svg>
                                </a>
                                <a href="https://discord.com/invite/seFBCWmUre" target="_blank" rel="noreferrer" style="
                                    width: 20px;
                                    height: 20px;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    color: var(--r-neutral-foot);
                                    transition: color 0.2s;
                                " onmouseenter="this.style.color='#5865F2'" onmouseleave="this.style.color='var(--r-neutral-foot)'">
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M16.5 4.5C15.3 3.9 14 3.5 12.6 3.2c-.1.2-.2.4-.3.6-1.1-.2-2.2-.2-3.3 0-.1-.2-.2-.4-.3-.6C7.1 3.5 5.8 3.9 4.6 4.5c-2.1 3-2.7 6-2.4 9 1.5 1.1 3 2 4.5 2.6.4-.5.7-1 1-1.5-.5-.2-1-.4-1.5-.7.1-.1.2-.2.3-.3.1-.1.2-.1.3-.2 0 0 .1 0 .1.1 0 0 .1 0 .1-.1.1-.1.1-.1.2-.1.5-.3 1-.5 1.5-.8.3-.2.5-.4.8-.6 1.3 1.1 2.8 1.7 4.3 1.8.2-1.4-.1-2.8-.8-4.1.7-.1 1.4-.3 2.1-.5.1.1.2.1.3.2.1.1.2.1.3.2 0 0 .1 0 .1.1 0 0 .1 0 .1-.1.1-.1.1-.1.2-.1.5-.3 1-.5 1.5-.8.3.2.5.4.8.6 1.3-1.1 2.8-1.7 4.3-1.8.2 1.4-.1 2.8-.8 4.1.7.1 1.4.3 2.1.5.1-.1.2-.1.3-.2.1-.1.2-.1.3-.2 0 0 .1 0 .1.1 0 0 .1 0 .1-.1.1-.1.1-.1.2-.1.5.3 1 .5 1.5.7-.3.5-.6 1-1.5 1.5.6 3 1.5 4.5 2.6.3-3 .3-6-2.4-9zM6.5 13.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5zm7 0c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5z"/>
                                    </svg>
                                </a>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}
