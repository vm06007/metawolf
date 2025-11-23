/**
 * Utility functions for managing extension icon and badge
 */

/**
 * Update the extension icon badge to show lock status
 * @param isLocked - Whether the wallet is locked
 */
export async function updateLockBadge(isLocked: boolean): Promise<void> {
    try {
        if (isLocked) {
            // Set badge with lock symbol when locked
            // Using a simple text indicator since Chrome badges are text-only
            await chrome.action.setBadgeText({ text: '🔒' });
            await chrome.action.setBadgeBackgroundColor({ color: '#FFFFFFFF' });
        } else {
            // Clear badge when unlocked
            await chrome.action.setBadgeText({ text: '' });
        }
    } catch (error: any) {
        console.error('[Wolfy] Error updating lock badge:', error);
    }
}

/**
 * Update the extension icon based on lock status
 * This changes the entire icon to a locked version (with lock overlay)
 * @param isLocked - Whether the wallet is locked
 */
export async function updateLockIcon(isLocked: boolean): Promise<void> {
    try {
        if (isLocked) {
            // Use lock icon files (these have a lock overlay on the base icon)
            // If lock icons don't exist, fall back to regular icons
            const lockIcons = {
                16: chrome.runtime.getURL('icons/icon-lock-16.png'),
                32: chrome.runtime.getURL('icons/icon-lock-32.png'),
                48: chrome.runtime.getURL('icons/icon-lock-48.png'),
                128: chrome.runtime.getURL('icons/icon-lock-128.png'),
            };

            try {
                await chrome.action.setIcon({ path: lockIcons });
            } catch (error) {
                // Fall back to regular icons if lock icons don't exist
                const regularIcons = {
                    16: chrome.runtime.getURL('icons/icon16.png'),
                    32: chrome.runtime.getURL('icons/icon32.png'),
                    48: chrome.runtime.getURL('icons/icon48.png'),
                    128: chrome.runtime.getURL('icons/icon128.png'),
                };
                await chrome.action.setIcon({ path: regularIcons });
            }
        } else {
            // Use regular icons when unlocked
            const regularIcons = {
                16: chrome.runtime.getURL('icons/icon16.png'),
                32: chrome.runtime.getURL('icons/icon32.png'),
                48: chrome.runtime.getURL('icons/icon48.png'),
                128: chrome.runtime.getURL('icons/icon128.png'),
            };
            await chrome.action.setIcon({ path: regularIcons });
        }
    } catch (error: any) {
        console.error('[Wolfy] Error updating lock icon:', error);
    }
}

/**
 * Update both icon and badge based on lock status
 * This is the main function to call when lock state changes
 * @param isLocked - Whether the wallet is locked
 */
export async function updateLockIndicator(isLocked: boolean): Promise<void> {
    await Promise.all([
        updateLockIcon(isLocked),
        updateLockBadge(isLocked),
    ]);
}

