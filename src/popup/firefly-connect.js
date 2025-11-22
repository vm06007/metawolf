console.log('=== FIREFLY CONNECT SCRIPT LOADED ===');

// Load Firefly library directly as a module
const fireflyUrl = chrome.runtime.getURL('popup/lib/firefly.js');
console.log('Loading Firefly from:', fireflyUrl);

let Firefly, FireflySigner;
try {
    const module = await import(fireflyUrl);
    Firefly = module.Firefly;
    FireflySigner = module.FireflySigner;
    console.log('Firefly loaded:', { Firefly, FireflySigner });
} catch (error) {
    console.error('Failed to load Firefly module:', error);
}

const connectBtn = document.getElementById('connect-btn');
const statusDiv = document.getElementById('status');
let firefly = null;
let signer = null;

function showStatus(message, type = 'info') {
    statusDiv.className = type;
    statusDiv.style.display = 'block';
    statusDiv.innerHTML = message;
}

function sendResultToExtension(success, address, deviceInfo, error) {
    const urlParams = new URLSearchParams(window.location.search);
    const requestId = urlParams.get('requestId');
    
    if (requestId && chrome.runtime) {
        console.log('Sending result to extension:', { requestId, success, address, error });
        chrome.runtime.sendMessage({
            type: 'FIREFLY_CONNECTION_RESULT',
            requestId: requestId,
            success: success,
            address: address,
            deviceInfo: deviceInfo,
            error: error
        }).then((response) => {
            console.log('Message sent, response:', response);
        }).catch((err) => {
            console.error('Error sending message:', err);
            // Also try storing in chrome.storage as fallback
            if (requestId) {
                chrome.storage.local.set({
                    [`firefly_result_${requestId}`]: {
                        success: success,
                        address: address,
                        deviceInfo: deviceInfo,
                        error: error,
                        timestamp: Date.now(),
                    },
                }).then(() => {
                    console.log('Stored result in chrome.storage as fallback');
                });
            }
        });
    } else {
        console.error('No requestId or chrome.runtime not available');
    }
}

showStatus('Ready to connect. Click the button to connect your Firefly wallet.', 'info');

// Attach click handler
console.log('=== Attaching click handler ===');
connectBtn.onclick = async function(e) {
    console.log('=== BUTTON CLICKED ===');
    e.preventDefault();
    e.stopPropagation();
    connectBtn.disabled = true;
    showStatus('Connecting to Firefly...', 'info');
    console.log('=== Starting Firefly discovery... ===');

    try {
        if (!Firefly || !FireflySigner) {
            throw new Error('Firefly library not loaded. Please refresh the page.');
        }

        // Discover Firefly device (this uses Web Bluetooth)
        showStatus('Discovering Firefly device... Please select your device in the Bluetooth dialog.', 'info');
        
        // Add timeout wrapper for discovery
        const discoveryPromise = Firefly.discover();
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Discovery timeout: Device did not respond in time. Please ensure your Firefly device is powered on and try again.')), 30000);
        });
        
        firefly = await Promise.race([discoveryPromise, timeoutPromise]);
        console.log('Firefly device discovered:', firefly);
        
        if (!firefly) {
            throw new Error('Failed to discover Firefly device. Please ensure your device is powered on and Bluetooth is enabled.');
        }
        
        showStatus('Device connected! Getting address...', 'info');
        
        // Create signer and get address with retry logic
        signer = new FireflySigner(firefly);
        console.log('FireflySigner created, getting address...');
        
        // Add timeout and retry for getAddress
        let address;
        let retries = 3;
        let lastError;
        
        while (retries > 0) {
            try {
                const addressPromise = signer.getAddress();
                const addressTimeout = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Address query timeout: Device did not respond. Please ensure the Firefly wallet app is running on your device.')), 15000);
                });
                
                address = await Promise.race([addressPromise, addressTimeout]);
                console.log('Address received:', address);
                break; // Success, exit retry loop
            } catch (error) {
                lastError = error;
                retries--;
                console.warn(`getAddress attempt failed, ${retries} retries left:`, error);
                
                if (retries > 0) {
                    showStatus(`Getting address... (retrying, ${retries} attempts left)`, 'info');
                    // Wait a bit before retrying
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
        
        if (!address) {
            throw lastError || new Error('Failed to get address from Firefly device after multiple attempts.');
        }

        const deviceInfo = {
            model: firefly.model,
            serialNumber: firefly.serialNumber,
            address: address.toLowerCase(),
            connectedAt: Date.now(),
        };

        // Send result back to extension
        sendResultToExtension(true, address, deviceInfo, null);

        // Display success message
        showStatus(`
            <strong>✅ Connected Successfully!</strong><br>
            <div style="margin-top: 15px; padding: 10px; background: #f0f9ff; border-radius: 6px;">
                <div style="margin-bottom: 10px;">
                    <strong>Address:</strong><br>
                    <span style="font-family: monospace; font-size: 13px; word-break: break-all;">${address}</span>
                </div>
                <div style="margin-bottom: 5px;">
                    <strong>Model:</strong> ${firefly.model}
                </div>
                <div>
                    <strong>Serial:</strong> ${firefly.serialNumber}
                </div>
            </div>
            <p style="margin-top: 15px; color: green;">
                ✅ Account has been added to your wallet.
            </p>
            <button id="close-window-btn" style="margin-top: 10px; padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                Close Window
            </button>
        `, 'success');

        // Add close button handler
        const closeBtn = document.getElementById('close-window-btn');
        if (closeBtn) {
            closeBtn.onclick = () => window.close();
        }

        // Set up disconnect handler
        if (firefly.ondisconnect) {
            firefly.ondisconnect = () => {
                showStatus('<strong>⚠️ Connection Lost</strong><br>The Firefly device was disconnected.', 'error');
                firefly = null;
                signer = null;
                connectBtn.disabled = false;
                connectBtn.textContent = 'Connect Firefly';
            };
        }

        // Update button to allow disconnect
        connectBtn.disabled = false;
        connectBtn.textContent = 'Disconnect';

    } catch (error) {
        console.error('Firefly connection error:', error);
        
        let errorMessage = error.message || 'Unknown error';
        
        // Clean up on error
        if (firefly) {
            try {
                firefly.destroy();
            } catch (e) {
                console.warn('Error destroying firefly:', e);
            }
            firefly = null;
            signer = null;
        }
        
        // Provide helpful error messages
        if (error.message && error.message.includes('NOT READY')) {
            errorMessage = 'Wallet App not running on Firefly. Please start the wallet app on your device.';
        } else if (error.message && error.message.includes('timeout')) {
            if (error.message.includes('Discovery timeout')) {
                errorMessage = 'Discovery timeout: Your Firefly device did not respond. Please:<br>' +
                    '1. Ensure your Firefly device is powered on<br>' +
                    '2. Ensure Bluetooth is enabled on both device and computer<br>' +
                    '3. Try disconnecting and reconnecting the device<br>' +
                    '4. Try again';
            } else if (error.message.includes('Address query timeout')) {
                errorMessage = 'Address query timeout: Your Firefly device connected but did not respond. Please:<br>' +
                    '1. Ensure the Firefly wallet app is running on your device<br>' +
                    '2. Check that the device screen is unlocked<br>' +
                    '3. Try disconnecting and reconnecting<br>' +
                    '4. Try again';
            } else {
                errorMessage = 'Connection timeout: Your Firefly device did not respond in time. Please:<br>' +
                    '1. Ensure your device is powered on and Bluetooth is enabled<br>' +
                    '2. Ensure the Firefly wallet app is running<br>' +
                    '3. Try disconnecting and reconnecting<br>' +
                    '4. Try again';
            }
        } else if (error.message && error.message.includes('globally disabled')) {
            errorMessage = 'Web Bluetooth is disabled. Please:<br>' +
                '1. Go to chrome://flags/#enable-web-bluetooth<br>' +
                '2. Enable it and restart Chrome<br>' +
                '3. Try again';
        } else if (error.message && error.message.includes('not supported')) {
            errorMessage = 'Web Bluetooth is not supported in this browser or context. Please ensure:<br>' +
                '1. You are using Chrome/Edge<br>' +
                '2. Web Bluetooth is enabled in chrome://flags<br>' +
                '3. Try again';
        } else if (error.message && error.message.includes('Failed to discover')) {
            errorMessage = 'Failed to discover Firefly device. Please:<br>' +
                '1. Ensure your Firefly device is powered on<br>' +
                '2. Ensure Bluetooth is enabled<br>' +
                '3. Try again';
        }

        // Display error
        showStatus(`
            <strong>❌ Connection Failed</strong><br>
            <div style="margin-top: 10px;">${errorMessage}</div>
            <p style="margin-top: 15px;">Please check the error above and try again.</p>
            <button id="close-window-btn" style="margin-top: 10px; padding: 10px 20px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                Close Window
            </button>
        `, 'error');

        // Add close button handler
        const closeBtn = document.getElementById('close-window-btn');
        if (closeBtn) {
            closeBtn.onclick = () => window.close();
        }
        
        connectBtn.disabled = false;
        connectBtn.textContent = 'Connect Firefly';

        // Send error back to extension
        sendResultToExtension(false, null, null, errorMessage);
    }
};

// Handle disconnect button
if (connectBtn.textContent === 'Disconnect') {
    connectBtn.onclick = () => {
        if (firefly) {
            firefly.destroy();
            firefly = null;
            signer = null;
        }
        showStatus('Device disconnected.', 'info');
        connectBtn.textContent = 'Connect Firefly';
    };
}

// Check Web Bluetooth availability on load (Firefly uses Web Bluetooth)
console.log('Checking Web Bluetooth availability...');
if (!navigator.bluetooth) {
    console.warn('Web Bluetooth API is not available');
    showStatus('⚠️ Web Bluetooth API is not available. Firefly requires Web Bluetooth. Please ensure:<br>1. You are using Chrome/Edge<br>2. Web Bluetooth is enabled in chrome://flags', 'error');
    connectBtn.disabled = true;
} else {
    console.log('Web Bluetooth API is available:', navigator.bluetooth);
}

