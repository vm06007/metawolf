/**
 * RPC request handler - Processes Ethereum JSON-RPC requests from dApps
 */

interface RPCRequest {
    id: number;
    method: string;
    params: any[];
    jsonrpc: string;
}

interface RPCResponse {
    id: number;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
    jsonrpc: string;
}

export class RPCHandler {
    private static handleRequest(message: RPCRequest): Promise<RPCResponse> {
        return new Promise(async (resolve) => {
            try {
                switch (message.method) {
                    case 'eth_accounts':
                    case 'eth_requestAccounts':
                        const accountsResponse = await chrome.runtime.sendMessage({
                            type: 'GET_ACCOUNTS',
                        });
                        const addresses =
                            accountsResponse.success && accountsResponse.accounts
                                ? accountsResponse.accounts.map(
                                    (acc: any) => acc.address
                                )
                                : [];
                        resolve({
                            id: message.id,
                            result: addresses,
                            jsonrpc: '2.0',
                        });
                        break;

                    case 'eth_chainId':
                        const networkResponse = await chrome.runtime.sendMessage({
                            type: 'GET_NETWORKS',
                        });
                        let chainIdString = '0x1';
                        if (networkResponse.success && networkResponse.networks) {
                            const selected = networkResponse.networks[0];
                            if (selected) {
                                chainIdString = '0x' + selected.chainId.toString(16);
                            }
                        }
                        resolve({
                            id: message.id,
                            result: chainIdString,
                            jsonrpc: '2.0',
                        });
                        break;

                    case 'eth_sendTransaction':
                        const tx = message.params[0];
                        const signTxResponse = await chrome.runtime.sendMessage({
                            type: 'SIGN_TRANSACTION',
                            transaction: {
                                to: tx.to,
                                value: tx.value,
                                data: tx.data,
                                gasLimit: tx.gas,
                                gasPrice: tx.gasPrice,
                                maxFeePerGas: tx.maxFeePerGas,
                                maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
                                nonce: tx.nonce ? parseInt(tx.nonce, 16) : undefined,
                            },
                        });

                        if (signTxResponse.success) {
                            // In production, send to network
                            resolve({
                                id: message.id,
                                result: '0x' + 'tx_hash_placeholder',
                                jsonrpc: '2.0',
                            });
                        } else {
                            resolve({
                                id: message.id,
                                error: {
                                    code: -32000,
                                    message: signTxResponse.error || 'Transaction signing failed',
                                },
                                jsonrpc: '2.0',
                            });
                        }
                        break;

                    case 'eth_signTransaction':
                        const txToSign = message.params[0];
                        const signResponse = await chrome.runtime.sendMessage({
                            type: 'SIGN_TRANSACTION',
                            transaction: {
                                to: txToSign.to,
                                value: txToSign.value,
                                data: txToSign.data,
                                gasLimit: txToSign.gas,
                                gasPrice: txToSign.gasPrice,
                                maxFeePerGas: txToSign.maxFeePerGas,
                                maxPriorityFeePerGas:
                                    txToSign.maxPriorityFeePerGas,
                                nonce: txToSign.nonce
                                    ? parseInt(txToSign.nonce, 16)
                                    : undefined,
                            },
                        });

                        if (signResponse.success) {
                            resolve({
                                id: message.id,
                                result: signResponse.signedTransaction,
                                jsonrpc: '2.0',
                            });
                        } else {
                            resolve({
                                id: message.id,
                                error: {
                                    code: -32000,
                                    message: signResponse.error || 'Signing failed',
                                },
                                jsonrpc: '2.0',
                            });
                        }
                        break;

                    case 'personal_sign':
                    case 'eth_sign':
                        const [messageData, address] = message.params;
                        const personalSignResponse = await chrome.runtime.sendMessage({
                            type: 'SIGN_MESSAGE',
                            message: messageData,
                            address: address,
                        });

                        if (personalSignResponse.success) {
                            resolve({
                                id: message.id,
                                result: personalSignResponse.signature,
                                jsonrpc: '2.0',
                            });
                        } else {
                            resolve({
                                id: message.id,
                                error: {
                                    code: -32000,
                                    message:
                                        personalSignResponse.error || 'Message signing failed',
                                },
                                jsonrpc: '2.0',
                            });
                        }
                        break;

                    case 'eth_signTypedData_v4':
                        const [signAddress, typedData] = message.params;
                        const typedSignResponse = await chrome.runtime.sendMessage({
                            type: 'SIGN_TYPED_DATA',
                            address: signAddress,
                            typedData: typedData,
                        });

                        if (typedSignResponse.success) {
                            resolve({
                                id: message.id,
                                result: typedSignResponse.signature,
                                jsonrpc: '2.0',
                            });
                        } else {
                            resolve({
                                id: message.id,
                                error: {
                                    code: -32000,
                                    message:
                                        typedSignResponse.error || 'Typed data signing failed',
                                },
                                jsonrpc: '2.0',
                            });
                        }
                        break;

                    case 'wallet_switchEthereumChain':
                        const chainIdHex = message.params[0]?.chainId;
                        const chainId = parseInt(chainIdHex, 16);
                        await chrome.runtime.sendMessage({
                            type: 'SET_NETWORK',
                            chainId: chainId,
                        });
                        resolve({
                            id: message.id,
                            result: null,
                            jsonrpc: '2.0',
                        });
                        break;

                    case 'wallet_addEthereumChain':
                        // Add custom network (implement as needed)
                        resolve({
                            id: message.id,
                            result: null,
                            jsonrpc: '2.0',
                        });
                        break;

                    case 'wallet_sendCalls':
                        // EIP-5792: Send batched calls
                        const callsParams = message.params[0] || {};
                        const sendCallsResponse = await chrome.runtime.sendMessage({
                            type: 'SEND_BATCHED_CALLS',
                            calls: callsParams.calls || [],
                            chainId: callsParams.chainId,
                            capabilities: callsParams.capabilities,
                            forceAtomic: callsParams.forceAtomic,
                        });

                        if (sendCallsResponse.success) {
                            resolve({
                                id: message.id,
                                result: {
                                    id: sendCallsResponse.id || `calls_${Date.now()}`,
                                    capabilities: sendCallsResponse.capabilities,
                                },
                                jsonrpc: '2.0',
                            });
                        } else {
                            resolve({
                                id: message.id,
                                error: {
                                    code: -32000,
                                    message: sendCallsResponse.error || 'Failed to send batched calls',
                                },
                                jsonrpc: '2.0',
                            });
                        }
                        break;

                    case 'wallet_getCallsStatus':
                        // EIP-5792: Get status of batched calls
                        const statusParams = message.params[0] || {};
                        const callsStatusResponse = await chrome.runtime.sendMessage({
                            type: 'GET_CALLS_STATUS',
                            id: statusParams.id,
                        });

                        if (callsStatusResponse.success) {
                            resolve({
                                id: message.id,
                                result: callsStatusResponse.status || null,
                                jsonrpc: '2.0',
                            });
                        } else {
                            resolve({
                                id: message.id,
                                error: {
                                    code: -32000,
                                    message: callsStatusResponse.error || 'Failed to get calls status',
                                },
                                jsonrpc: '2.0',
                            });
                        }
                        break;

                    case 'wallet_getCapabilities':
                        // EIP-5792: Get wallet capabilities
                        const capabilitiesParams = message.params[0] || {};
                        const capabilitiesResponse = await chrome.runtime.sendMessage({
                            type: 'GET_CAPABILITIES',
                            account: capabilitiesParams.account,
                        });

                        if (capabilitiesResponse.success) {
                            resolve({
                                id: message.id,
                                result: capabilitiesResponse.capabilities || {},
                                jsonrpc: '2.0',
                            });
                        } else {
                            resolve({
                                id: message.id,
                                error: {
                                    code: -32000,
                                    message: capabilitiesResponse.error || 'Failed to get capabilities',
                                },
                                jsonrpc: '2.0',
                            });
                        }
                        break;

                    default:
                        // Forward to RPC provider
                        resolve({
                            id: message.id,
                            error: {
                                code: -32601,
                                message: `Method not found: ${message.method}`,
                            },
                            jsonrpc: '2.0',
                        });
                }
            } catch (error: any) {
                resolve({
                    id: message.id,
                    error: {
                        code: -32603,
                        message: error.message || 'Internal error',
                    },
                    jsonrpc: '2.0',
                });
            }
        });
    }

    static async process(message: RPCRequest): Promise<RPCResponse> {
        return await this.handleRequest(message);
    }
}
