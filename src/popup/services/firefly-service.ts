import { sendMessageWithRetry } from '../utils/messaging';

export class FireflyService {
    async addFireflyAccount(name?: string): Promise<any> {
        try {
            // Web Bluetooth doesn't work in extension popups, so we need to open a dedicated page
            const requestId = `firefly_${Date.now()}_${Math.random()}`;
            
            // Open the Firefly connection page
            const url = chrome.runtime.getURL(`popup/firefly-connect.html?requestId=${requestId}`);
            const tab = await chrome.tabs.create({ url });

            // Wait for connection result
            return new Promise((resolve, reject) => {
                let resolved = false;
                
                // Listen for storage changes (background script stores the result)
                const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
                    if (areaName !== 'local') return;
                    
                    const storageKey = `firefly_result_${requestId}`;
                    if (changes[storageKey] && changes[storageKey].newValue && !resolved) {
                        resolved = true;
                        chrome.storage.onChanged.removeListener(storageListener);
                        
                        const result = changes[storageKey].newValue;
                        
                        // Clean up storage
                        chrome.storage.local.remove(storageKey).catch(() => {});

                        // Don't close the tab - let user see the result and close manually

                        if (result.success) {
                            // Create account from Firefly device
                            sendMessageWithRetry({
                                type: 'CREATE_ACCOUNT_FROM_FIREFLY',
                                fireflyAddress: result.address,
                                deviceInfo: result.deviceInfo,
                                name: name || undefined,
                            }, 5, 3000).then((response) => {
                                if (!response || !response.success) {
                                    reject(new Error(response?.error || 'Failed to create account from Firefly device'));
                                    return;
                                }

                                // Store Firefly device connection info
                                chrome.storage.local.set({
                                    [`firefly_device_${result.address.toLowerCase()}`]: result.deviceInfo,
                                }).then(() => {
                                    resolve({
                                        success: true,
                                        account: response.account,
                                        fireflyAddress: result.address,
                                        deviceInfo: result.deviceInfo,
                                    });
                                });
                            }).catch(reject);
                        } else {
                            reject(new Error(result.error || 'Failed to connect to Firefly device'));
                        }
                    }
                };

                chrome.storage.onChanged.addListener(storageListener);

                // Also poll storage as a fallback (in case storage event doesn't fire)
                const pollInterval = setInterval(async () => {
                    if (resolved) {
                        clearInterval(pollInterval);
                        return;
                    }
                    
                    try {
                        const storage = await chrome.storage.local.get(`firefly_result_${requestId}`);
                        const result = storage[`firefly_result_${requestId}`];
                        
                        if (result && !resolved) {
                            resolved = true;
                            clearInterval(pollInterval);
                            chrome.storage.onChanged.removeListener(storageListener);
                            
                            // Clean up storage
                            chrome.storage.local.remove(`firefly_result_${requestId}`).catch(() => {});

                            // Don't close the tab - let user see the result and close manually

                            if (result.success) {
                                // Create account from Firefly device
                                sendMessageWithRetry({
                                    type: 'CREATE_ACCOUNT_FROM_FIREFLY',
                                    fireflyAddress: result.address,
                                    deviceInfo: result.deviceInfo,
                                    name: name || undefined,
                                }, 5, 3000).then((response) => {
                                    if (!response || !response.success) {
                                        reject(new Error(response?.error || 'Failed to create account from Firefly device'));
                                        return;
                                    }

                                    // Store Firefly device connection info
                                    chrome.storage.local.set({
                                        [`firefly_device_${result.address.toLowerCase()}`]: result.deviceInfo,
                                    }).then(() => {
                                        resolve({
                                            success: true,
                                            account: response.account,
                                            fireflyAddress: result.address,
                                            deviceInfo: result.deviceInfo,
                                        });
                                    });
                                }).catch(reject);
                            } else {
                                reject(new Error(result.error || 'Failed to connect to Firefly device'));
                            }
                        }
                    } catch (error) {
                        // Ignore polling errors
                    }
                }, 500); // Poll every 500ms

                // Timeout after 5 minutes
                setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        clearInterval(pollInterval);
                        chrome.storage.onChanged.removeListener(storageListener);
                        // Don't close the tab on timeout - let user see the error
                        chrome.storage.local.remove(`firefly_result_${requestId}`).catch(() => {});
                        reject(new Error('Connection timeout. Please try again.'));
                    }
                }, 300000);
            });
        } catch (error: any) {
            console.error('Error adding Firefly account:', error);
            throw error;
        }
    }

    async connectFirefly(): Promise<{ address: string; deviceInfo: any }> {
        try {
            const { FireflyAdapter } = await import('../../firefly/firefly-adapter.js');
            
            // Load library if needed
            const loaded = await FireflyAdapter.loadLibrary();
            if (!loaded) {
                throw new Error('Failed to load Firefly library');
            }

            // Discover Firefly device
            const firefly = await FireflyAdapter.discover();
            if (!firefly) {
                throw new Error('Failed to discover Firefly device');
            }

            // Get address from device
            const address = await FireflyAdapter.getAddress(firefly);
            if (!address) {
                throw new Error('Failed to get address from Firefly device');
            }

            const deviceInfo = {
                model: firefly.model,
                serialNumber: firefly.serialNumber,
                address: address.toLowerCase(),
                connectedAt: Date.now(),
            };

            return {
                address: address.toLowerCase(),
                deviceInfo: deviceInfo,
            };
        } catch (error: any) {
            console.error('Error connecting to Firefly:', error);
            throw error;
        }
    }

    async getFireflyDeviceInfo(address: string): Promise<any> {
        const storage = await chrome.storage.local.get(`firefly_device_${address.toLowerCase()}`);
        return storage[`firefly_device_${address.toLowerCase()}`] || null;
    }
}

