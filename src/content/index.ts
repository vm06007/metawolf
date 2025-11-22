/**
 * Content script - Injected into web pages
 * Provides wallet provider API to dApps
 */

(function () {
    // Inject in-page script
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('inpage.js');
    script.onload = function () {
        (this as HTMLScriptElement).remove();
    };
    (document.head || document.documentElement).appendChild(script);

    // Listen for messages from in-page script
    window.addEventListener(
        'message',
        async (event) => {
            // Only accept messages from the same window
            if (event.source !== window) return;

            if (event.data && event.data.type) {
                if (event.data.type === 'WOLFY_REQUEST') {
                    // Handle RPC request
                    const method = event.data.method;
                    const params = event.data.params || [];

                    // Map to internal message types
                    let messageType = '';
                    let payload: any = {};

                    if (method === 'eth_accounts' || method === 'eth_requestAccounts') {
                        messageType = 'GET_ACCOUNTS';
                        payload = {};
                    } else if (method === 'eth_sendTransaction') {
                        messageType = 'SIGN_TRANSACTION';
                        payload = {
                            transaction: {
                                to: params[0]?.to,
                                value: params[0]?.value,
                                data: params[0]?.data,
                                gasLimit: params[0]?.gas,
                                gasPrice: params[0]?.gasPrice,
                                maxFeePerGas: params[0]?.maxFeePerGas,
                                maxPriorityFeePerGas: params[0]?.maxPriorityFeePerGas,
                                nonce: params[0]?.nonce
                                    ? parseInt(params[0].nonce, 16)
                                    : undefined,
                            },
                        };
                    } else if (method === 'eth_signTransaction') {
                        messageType = 'SIGN_TRANSACTION';
                        payload = {
                            transaction: {
                                to: params[0]?.to,
                                value: params[0]?.value,
                                data: params[0]?.data,
                                gasLimit: params[0]?.gas,
                                gasPrice: params[0]?.gasPrice,
                                maxFeePerGas: params[0]?.maxFeePerGas,
                                maxPriorityFeePerGas: params[0]?.maxPriorityFeePerGas,
                                nonce: params[0]?.nonce
                                    ? parseInt(params[0].nonce, 16)
                                    : undefined,
                            },
                        };
                    } else if (method === 'personal_sign') {
                        messageType = 'SIGN_MESSAGE';
                        payload = {
                            message: params[0],
                            address: params[1],
                        };
                    } else if (method === 'eth_signTypedData_v4') {
                        messageType = 'SIGN_TYPED_DATA';
                        payload = {
                            address: params[0],
                            typedData: params[1],
                        };
                    }

                    if (messageType) {
                        chrome.runtime.sendMessage(
                            { type: messageType, ...payload },
                            (response) => {
                                // Forward response back to in-page script
                                window.postMessage(
                                    {
                                        type: event.data.type + '_RESPONSE',
                                        id: event.data.id,
                                        response: response,
                                    },
                                    '*'
                                );
                            }
                        );
                    } else {
                        // Unknown method
                        window.postMessage(
                            {
                                type: event.data.type + '_RESPONSE',
                                id: event.data.id,
                                response: {
                                    success: false,
                                    error: `Unknown method: ${method}`,
                                },
                            },
                            '*'
                        );
                    }
                } else if (event.data.type.startsWith('WOLFY_')) {
                    // Forward other messages to background script
                    chrome.runtime.sendMessage(
                        event.data,
                        (response) => {
                            // Forward response back to in-page script
                            window.postMessage(
                                {
                                    type: event.data.type + '_RESPONSE',
                                    id: event.data.id,
                                    response: response,
                                },
                                '*'
                            );
                        }
                    );
                }
            }
        },
        false
    );
})();

