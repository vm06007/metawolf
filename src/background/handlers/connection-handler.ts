import type { Wallet } from '../../core/wallet.js';

const notificationUrl = chrome.runtime.getURL('notification/index.html');
let isCreatingNotificationWindow = false;
const notificationWindowIds = new Set<number>();

export async function handleConnectDapp(
    message: any,
    sender: chrome.runtime.MessageSender,
    safeSendResponse: (response: any) => void
): Promise<void> {
    try {
        const origin = message.origin || sender.origin || 'unknown';
        const name = message.name || 'Unknown DApp';
        const icon = message.icon || '';
        const detectedProviders = message.providers || [];

        const storage = await chrome.storage.local.get(['pendingConnection', 'dapp_connections']);
        const pendingConnection = storage.pendingConnection;
        const dappConnections = storage.dapp_connections || {};

        if (dappConnections[origin]) {
            console.log('[CONNECT_DAPP] DApp already connected:', origin);
            safeSendResponse({
                success: true,
                pending: false,
                alreadyConnected: true,
            });
            return;
        }

        // Check if notification window is already open
        try {
            const windows = await chrome.windows.getAll({ populate: true });
            const existingNotificationWindow = windows.find(win => {
                if (!win.tabs || win.tabs.length === 0) return false;
                return win.tabs.some(tab => tab.url === notificationUrl);
            });

            if (existingNotificationWindow && existingNotificationWindow.id) {
                console.log('[CONNECT_DAPP] Notification window already open, focusing it');
                await chrome.storage.local.set({
                    pendingConnection: {
                        origin,
                        name,
                        icon,
                        providers: detectedProviders,
                        tabId: sender.tab?.id,
                    }
                });
                await chrome.windows.update(existingNotificationWindow.id, { focused: true });
                notificationWindowIds.add(existingNotificationWindow.id);
                safeSendResponse({
                    success: true,
                    pending: true,
                    windowFocused: true,
                });
                return;
            }
        } catch (error) {
            console.warn('[CONNECT_DAPP] Could not check existing windows:', error);
        }

        if (isCreatingNotificationWindow) {
            console.log('[CONNECT_DAPP] Window creation already in progress, waiting...');
            await new Promise(resolve => setTimeout(resolve, 100));
            const windows = await chrome.windows.getAll({ populate: true });
            const existingWindow = windows.find(win => {
                if (!win.tabs || win.tabs.length === 0) return false;
                return win.tabs.some(tab => tab.url === notificationUrl);
            });

            if (existingWindow && existingWindow.id) {
                await chrome.storage.local.set({
                    pendingConnection: {
                        origin,
                        name,
                        icon,
                        providers: detectedProviders,
                        tabId: sender.tab?.id,
                    }
                });
                await chrome.windows.update(existingWindow.id, { focused: true });
                notificationWindowIds.add(existingWindow.id);
                safeSendResponse({
                    success: true,
                    pending: true,
                    windowFocused: true,
                });
                return;
            }
        }

        isCreatingNotificationWindow = true;

        try {
            await chrome.storage.local.set({
                pendingConnection: {
                    origin,
                    name,
                    icon,
                    providers: detectedProviders,
                    tabId: sender.tab?.id,
                }
            });

            const windowWidth = 400;
            const windowHeight = 600;
            const margin = 20;
            const top = 100;

            let left: number;
            try {
                const displayInfo = await chrome.system.display.getInfo();
                const primaryDisplay = displayInfo[0];
                const screenWidth = primaryDisplay.workArea.width;
                left = screenWidth - windowWidth - margin;
            } catch (error) {
                left = 1920 - windowWidth - margin;
            }

            const window = await chrome.windows.create({
                url: notificationUrl,
                type: 'popup',
                width: windowWidth,
                height: windowHeight,
                left: left,
                top: top,
                focused: true,
            });

            if (window.id) {
                notificationWindowIds.add(window.id);
            }

            safeSendResponse({
                success: true,
                pending: true,
            });
        } finally {
            isCreatingNotificationWindow = false;
        }
    } catch (error: any) {
        isCreatingNotificationWindow = false;
        console.error('[CONNECT_DAPP] Error:', error);
        safeSendResponse({
            success: false,
            error: error.message || 'Failed to open connection window',
        });
    }
}

export async function handleApproveConnection(
    message: any,
    safeSendResponse: (response: any) => void
): Promise<void> {
    try {
        const origin = message.origin;
        const account = message.account;

        const connections = await chrome.storage.local.get('dapp_connections') || {};
        const dappConnections = connections.dapp_connections || {};
        const pending = await chrome.storage.local.get('pendingConnection');

        if (pending.pendingConnection) {
            dappConnections[origin] = {
                name: pending.pendingConnection.name,
                icon: pending.pendingConnection.icon,
                account: account,
                connectedAt: Date.now(),
            };
            await chrome.storage.local.set({
                dapp_connections: dappConnections,
                pendingConnection: null
            });

            const windows = await chrome.windows.getAll({ populate: true });
            const notificationWindow = windows.find(win => {
                if (!win.tabs || win.tabs.length === 0) return false;
                return win.tabs.some(tab => tab.url === notificationUrl);
            });
            if (notificationWindow?.id) {
                notificationWindowIds.delete(notificationWindow.id);
            }
        }

        safeSendResponse({ success: true });
    } catch (error: any) {
        console.error('[APPROVE_CONNECTION] Error:', error);
        safeSendResponse({ success: false, error: error.message });
    }
}

export async function handleRejectConnection(
    safeSendResponse: (response: any) => void
): Promise<void> {
    try {
        await chrome.storage.local.set({ pendingConnection: null });

        const windows = await chrome.windows.getAll({ populate: true });
        const notificationWindow = windows.find(win => {
            if (!win.tabs || win.tabs.length === 0) return false;
            return win.tabs.some(tab => tab.url === notificationUrl);
        });
        if (notificationWindow?.id) {
            notificationWindowIds.delete(notificationWindow.id);
        }

        safeSendResponse({ success: true });
    } catch (error: any) {
        safeSendResponse({ success: false, error: error.message });
    }
}

export function getNotificationWindowIds(): Set<number> {
    return notificationWindowIds;
}

