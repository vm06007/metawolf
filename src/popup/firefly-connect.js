console.log('=== FIREFLY CONNECT SCRIPT LOADED ===');

// Load Firefly library directly as a module
const fireflyUrl = chrome.runtime.getURL('popup/lib/firefly.js');
console.log('Loading Firefly from:', fireflyUrl);

const { Firefly, FireflySigner } = await import(fireflyUrl);
console.log('Firefly loaded:', { Firefly, FireflySigner });

const connectBtn = document.getElementById('connect-btn');
const statusDiv = document.getElementById('status');

function showStatus(message, type = 'info') {
    statusDiv.className = type;
    statusDiv.style.display = 'block';
    statusDiv.innerHTML = message;
}

showStatus('Ready to connect. Click the button to connect your Firefly wallet.', 'success');

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
        // Check if Web Bluetooth is available
        if (!('bluetooth' in navigator) || !navigator.bluetooth) {
            throw new Error('Web Bluetooth API is not available. Please enable it in Chrome flags: chrome://flags/#enable-experimental-web-platform-features');
        }

        // Discover Firefly device
        showStatus('Discovering Firefly device... Please select your device in the Bluetooth dialog.', 'info');
        const firefly = await Firefly.discover();
        
        showStatus('Device connected! Getting address...', 'info');
        
        // Create signer and get address
        const signer = new FireflySigner(firefly);
        const address = await signer.getAddress();

        // Send result back to extension
        const urlParams = new URLSearchParams(window.location.search);
        const requestId = urlParams.get('requestId');
        
        if (requestId && chrome.runtime) {
            chrome.runtime.sendMessage({
                type: 'FIREFLY_CONNECTION_RESULT',
                requestId: requestId,
                success: true,
                address: address,
                deviceInfo: {
                    model: firefly.model,
                    serialNumber: firefly.serialNumber,
                    connectedAt: Date.now(),
                }
            });
        }

        showStatus(`
            <strong>✅ Connected Successfully!</strong><br>
            <div id="address">Address: ${address}</div>
            <div style="margin-top: 10px;">Model: ${firefly.model}</div>
            <div>Serial: ${firefly.serialNumber}</div>
            <p style="margin-top: 15px;">You can close this window. The account will be added to your wallet.</p>
        `, 'success');

    } catch (error) {
        console.error('Firefly connection error:', error);
        
        let errorMessage = error.message || 'Unknown error';
        if (error.message && error.message.includes('globally disabled')) {
            errorMessage = 'Web Bluetooth is disabled. Please:<br>' +
                '1. Go to chrome://flags/#enable-experimental-web-platform-features<br>' +
                '2. Enable it and restart Chrome<br>' +
                '3. Try again';
        }

        showStatus(`<strong>❌ Connection Failed</strong><br>${errorMessage}`, 'error');
        connectBtn.disabled = false;

        // Send error back to extension
        const urlParams = new URLSearchParams(window.location.search);
        const requestId = urlParams.get('requestId');
        
        if (requestId && chrome.runtime) {
            chrome.runtime.sendMessage({
                type: 'FIREFLY_CONNECTION_RESULT',
                requestId: requestId,
                success: false,
                error: error.message
            });
        }
    }
};

// Check Web Bluetooth availability on load
console.log('Checking Web Bluetooth availability...');
if (!('bluetooth' in navigator) || !navigator.bluetooth) {
    console.warn('Web Bluetooth API is not available');
    showStatus('⚠️ Web Bluetooth API is not available. Please enable it in Chrome flags: chrome://flags/#enable-experimental-web-platform-features', 'error');
    connectBtn.disabled = true;
} else {
    console.log('Web Bluetooth API is available:', navigator.bluetooth);
}

