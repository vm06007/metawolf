console.log('=== FIREFLY SIGN SCRIPT LOADED ===');

// Global variables
let Firefly, FireflySigner, JsonRpcProvider, parseEther;
let connectBtn, signBtn, statusDiv, txDetailsDiv;
let firefly = null;
let signer = null;
let provider = null;
let transactionData = null;

function showStatus(message, type = 'info') {
    if (!statusDiv) return;
    statusDiv.className = type;
    statusDiv.style.display = 'block';
    statusDiv.innerHTML = message;
}

function sendResultToExtension(success, signedTransaction, transactionHash, error) {
    const urlParams = new URLSearchParams(window.location.search);
    const requestId = urlParams.get('requestId');
    
    if (requestId && chrome.runtime) {
        console.log('Sending result to extension:', { requestId, success, error });
        chrome.runtime.sendMessage({
            type: 'FIREFLY_SIGN_RESULT',
            requestId: requestId,
            success: success,
            signedTransaction: signedTransaction,
            transactionHash: transactionHash,
            error: error
        }).then((response) => {
            console.log('Message sent, response:', response);
        }).catch((err) => {
            console.error('Error sending message:', err);
            // Also try storing in chrome.storage as fallback
            if (requestId) {
                chrome.storage.local.set({
                    [`firefly_sign_${requestId}`]: {
                        success: success,
                        signedTransaction: signedTransaction,
                        transactionHash: transactionHash,
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

// Load transaction data from storage
async function loadTransactionData() {
    const urlParams = new URLSearchParams(window.location.search);
    const requestId = urlParams.get('requestId');
    
    if (!requestId) {
        showStatus('Error: No request ID found', 'error');
        return;
    }
    
    try {
        const storage = await chrome.storage.local.get(`firefly_sign_${requestId}`);
        const data = storage[`firefly_sign_${requestId}`];
        
        if (!data || !data.transaction) {
            showStatus('Error: Transaction data not found', 'error');
            return;
        }
        
        transactionData = data.transaction;
        
        // Display transaction details
        document.getElementById('tx-to').textContent = transactionData.to || 'N/A';
        document.getElementById('tx-amount').textContent = transactionData.amount ? `${transactionData.amount} ETH` : '0 ETH';
        document.getElementById('tx-network').textContent = `Chain ID: ${transactionData.chainId || 'N/A'}`;
        document.getElementById('tx-gas').textContent = transactionData.gasLimit || 'N/A';
        txDetailsDiv.style.display = 'block';
        
        // Get network RPC URL
        const networksResponse = await chrome.runtime.sendMessage({ type: 'GET_NETWORKS' });
        const networks = networksResponse && networksResponse.success ? networksResponse.networks : [];
        if (!Array.isArray(networks)) {
            throw new Error('Invalid networks response format');
        }
        const network = networks.find((n) => n.chainId === transactionData.chainId);
        if (network && network.rpcUrl) {
            provider = new JsonRpcProvider(network.rpcUrl, undefined, { staticNetwork: true });
        } else {
            throw new Error(`Network not found for chainId ${transactionData.chainId}`);
        }
        
    } catch (error) {
        console.error('Error loading transaction data:', error);
        showStatus(`Error loading transaction: ${error.message}`, 'error');
    }
}

// Initialize when DOM is ready
async function initialize() {
    // Get DOM elements
    connectBtn = document.getElementById('connect-btn');
    signBtn = document.getElementById('sign-btn');
    statusDiv = document.getElementById('status');
    txDetailsDiv = document.getElementById('tx-details');
    
    if (!connectBtn || !signBtn || !statusDiv || !txDetailsDiv) {
        console.error('Required DOM elements not found');
        return;
    }
    
    // Load Firefly library
    const fireflyUrl = chrome.runtime.getURL('popup/lib/firefly.js');
    console.log('Loading Firefly from:', fireflyUrl);
    
    try {
        const module = await import(fireflyUrl);
        Firefly = module.Firefly;
        FireflySigner = module.FireflySigner;
        JsonRpcProvider = module.JsonRpcProvider;
        parseEther = module.parseEther;
        console.log('Firefly loaded:', { Firefly, FireflySigner });
    } catch (error) {
        console.error('Failed to load Firefly module:', error);
        showStatus('Failed to load Firefly library. Please refresh the page.', 'error');
        return;
    }
    
    // Attach event listeners
    attachEventListeners();
    
    // Load transaction data
    await loadTransactionData();
}

// Attach event listeners
function attachEventListeners() {
    // Connect to Firefly device
    connectBtn.onclick = async function(e) {
        e.preventDefault();
        e.stopPropagation();
        connectBtn.disabled = true;
        showStatus('Connecting to Firefly...', 'info');
        console.log('=== Starting Firefly discovery... ===');

        try {
            if (!Firefly || !FireflySigner) {
                throw new Error('Firefly library not loaded. Please refresh the page.');
            }

            // Discover Firefly device
            showStatus('Discovering Firefly device... Please select your device in the Bluetooth dialog.', 'info');
            
            const discoveryPromise = Firefly.discover();
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Discovery timeout: Device did not respond in time.')), 30000);
            });
            
            firefly = await Promise.race([discoveryPromise, timeoutPromise]);
            console.log('Firefly device discovered:', firefly);
            
            if (!firefly) {
                throw new Error('Failed to discover Firefly device.');
            }
            
            showStatus('Device connected! Verifying address...', 'info');
            
            // Ensure provider is set (should be set from loadTransactionData, but double-check)
            if (!provider) {
                const networksResponse = await chrome.runtime.sendMessage({ type: 'GET_NETWORKS' });
                const networks = networksResponse && networksResponse.success ? networksResponse.networks : [];
                if (!Array.isArray(networks)) {
                    throw new Error('Invalid networks response format');
                }
                const network = networks.find((n) => n.chainId === transactionData.chainId);
                if (network && network.rpcUrl) {
                    provider = new JsonRpcProvider(network.rpcUrl, undefined, { staticNetwork: true });
                } else {
                    throw new Error(`Network not found for chainId ${transactionData.chainId}`);
                }
            }
            
            // Create signer and verify address matches
            // FireflySigner needs both firefly device and provider
            signer = new FireflySigner(firefly, provider);
            console.log('FireflySigner created with provider, getting address...');
            
            let address;
            let retries = 3;
            let lastError;
            
            while (retries > 0) {
                try {
                    const addressPromise = signer.getAddress();
                    const addressTimeout = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('Address query timeout')), 15000);
                    });
                    
                    address = await Promise.race([addressPromise, addressTimeout]);
                    console.log('Address received:', address);
                    break;
                } catch (error) {
                    lastError = error;
                    retries--;
                    if (retries > 0) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }
            
            if (!address) {
                throw lastError || new Error('Failed to get address from Firefly device.');
            }
            
            // Verify address matches
            if (transactionData.address && address.toLowerCase() !== transactionData.address.toLowerCase()) {
                throw new Error(`Address mismatch. Expected ${transactionData.address}, got ${address}`);
            }
            
            showStatus(`✅ Connected! Address: ${address.slice(0, 6)}...${address.slice(-4)}`, 'success');
            signBtn.disabled = false;
            connectBtn.textContent = 'Disconnect';

        } catch (error) {
            console.error('Firefly connection error:', error);
            
            let errorMessage = error.message || 'Unknown error';
            if (error.message && error.message.includes('timeout')) {
                errorMessage = 'Connection timeout. Please ensure your Firefly device is powered on and try again.';
            } else if (error.message && error.message.includes('NOT READY')) {
                errorMessage = 'Wallet App not running on Firefly. Please start the wallet app on your device.';
            }
            
            showStatus(`❌ Connection Failed: ${errorMessage}`, 'error');
            connectBtn.disabled = false;
            connectBtn.textContent = 'Connect Firefly';
            
            if (firefly) {
                try {
                    firefly.destroy();
                } catch (e) {}
                firefly = null;
                signer = null;
            }
        }
    };

    // Sign transaction
    signBtn.onclick = async function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        if (!firefly || !signer || !transactionData) {
            showStatus('Error: Firefly not connected or transaction data missing', 'error');
            return;
        }
        
        signBtn.disabled = true;
        showStatus('Preparing transaction...', 'info');
        
        try {
            // Ensure provider is connected to signer
            if (!signer.provider) {
                throw new Error('Provider not connected to signer. Please reconnect Firefly.');
            }
            
            // Build transaction - FireflySigner will populate gas, nonce, etc. automatically
            // Match the example format: { chainId, to, value, data }
            // Value should be in wei (hex string or bigint) - already formatted from firefly-transfer-service
            const tx = {
                chainId: transactionData.chainId,
                to: transactionData.to,
                value: transactionData.value || '0x0', // Already in wei from parseEther
                data: transactionData.data || '0x',
            };
            
            console.log('Sending transaction to Firefly:', tx);
            console.log('Signer provider:', signer.provider);
            showStatus('Please confirm the transaction on your Firefly device...', 'info');
            
            // Send transaction - FireflySigner.sendTransaction() will:
            // 1. Call populateTransaction() to get nonce, gas, fees from provider
            // 2. Call signTransaction() which sends payload to device via firefly.sendMessage("ffx_signTransaction", params)
            // 3. Device signs and returns signature (r, s, v)
            // 4. Call provider.broadcastTransaction() with signed transaction to broadcast to network
            const txResponse = await signer.sendTransaction(tx);
            console.log('Transaction sent, response:', txResponse);
            
            // Get transaction hash from response
            // FireflySigner.sendTransaction returns the transaction response which has a hash
            let transactionHash = null;
            if (typeof txResponse === 'string') {
                transactionHash = txResponse;
            } else if (txResponse && txResponse.hash) {
                transactionHash = txResponse.hash;
            } else if (txResponse && typeof txResponse === 'object' && 'hash' in txResponse) {
                transactionHash = txResponse.hash;
            }
            
            if (!transactionHash) {
                // Try to extract from response object
                console.warn('Could not extract hash from response, trying alternative methods');
                transactionHash = txResponse?.transactionHash || txResponse?.txHash || null;
            }
            
            if (!transactionHash) {
                throw new Error('Transaction sent but no hash received. Response: ' + JSON.stringify(txResponse));
            }
            
            showStatus(`✅ Transaction signed and sent!<br><br><strong>Transaction Hash:</strong><br><span style="font-family: monospace; font-size: 12px; word-break: break-all;">${transactionHash}</span><br><br>You can close this window.`, 'success');
            
            // Send result back to extension
            sendResultToExtension(true, null, transactionHash, null);
            
            // Close window after a delay
            setTimeout(() => {
                window.close();
            }, 3000);
            
        } catch (error) {
            console.error('Transaction signing error:', error);
            
            let errorMessage = error.message || 'Unknown error';
            if (error.message && error.message.includes('timeout')) {
                errorMessage = 'Transaction timeout. Please try again.';
            } else if (error.message && error.message.includes('rejected') || error.message.includes('cancelled')) {
                errorMessage = 'Transaction was rejected or cancelled on the device.';
            }
            
            showStatus(`❌ Signing Failed: ${errorMessage}`, 'error');
            signBtn.disabled = false;
            
            // Send error back to extension
            sendResultToExtension(false, null, null, errorMessage);
        }
    };

    // Handle disconnect
    connectBtn.addEventListener('click', function(e) {
        if (connectBtn.textContent === 'Disconnect') {
            e.preventDefault();
            if (firefly) {
                try {
                    firefly.destroy();
                } catch (e) {}
                firefly = null;
                signer = null;
            }
            showStatus('Device disconnected.', 'info');
            connectBtn.textContent = 'Connect Firefly';
            signBtn.disabled = true;
        }
    });
    
    // Check Web Bluetooth availability
    console.log('Checking Web Bluetooth availability...');
    if (!navigator.bluetooth) {
        console.warn('Web Bluetooth API is not available');
        showStatus('⚠️ Web Bluetooth API is not available. Please enable it in Chrome flags.', 'error');
        connectBtn.disabled = true;
    } else {
        console.log('Web Bluetooth API is available:', navigator.bluetooth);
    }
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    // DOM is already ready
    initialize();
}
