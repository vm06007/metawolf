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
                const messageListener = (message: any) => {
                    if (message.type === 'FIREFLY_CONNECTION_RESULT' && message.requestId === requestId) {
                        chrome.runtime.onMessage.removeListener(messageListener);
                        
                        if (message.success) {
                            // Close the connection tab
                            chrome.tabs.remove(tab.id!).catch(() => {});
                            
                            // Create account from Firefly device
                            sendMessageWithRetry({
                                type: 'CREATE_ACCOUNT_FROM_FIREFLY',
                                fireflyAddress: message.address,
                                deviceInfo: message.deviceInfo,
                                name: name || undefined,
                            }, 5, 3000).then((response) => {
                                if (!response || !response.success) {
                                    reject(new Error(response?.error || 'Failed to create account from Firefly device'));
                                    return;
                                }

                                // Store Firefly device connection info
                                chrome.storage.local.set({
                                    [`firefly_device_${message.address.toLowerCase()}`]: message.deviceInfo,
                                }).then(() => {
                                    resolve({
                                        success: true,
                                        account: response.account,
                                        fireflyAddress: message.address,
                                        deviceInfo: message.deviceInfo,
                                    });
                                });
                            }).catch(reject);
                        } else {
                            // Close the connection tab
                            chrome.tabs.remove(tab.id!).catch(() => {});
                            reject(new Error(message.error || 'Failed to connect to Firefly device'));
                        }
                    }
                };

                chrome.runtime.onMessage.addListener(messageListener);

                // Timeout after 5 minutes
                setTimeout(() => {
                    chrome.runtime.onMessage.removeListener(messageListener);
                    chrome.tabs.remove(tab.id!).catch(() => {});
                    reject(new Error('Connection timeout. Please try again.'));
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

