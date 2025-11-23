/**
 * X402 Payment Protocol Client
 * Handles HTTP 402 Payment Required flow with wallet signing
 */

import type { PaymentRequirements, PaymentPayload } from 'x402/types';

export interface X402Response {
    success: boolean;
    status: number;
    paymentRequired?: boolean;
    paymentRequirements?: PaymentRequirements;
    data?: any;
    error?: string;
}

export class X402Client {
    /**
     * Make a GET request that handles x402 payment flow
     *
     * Flow:
     * 1. GET endpoint -> receives 402 with payment requirements
     * 2. Sign payment authorization with wallet
     * 3. GET endpoint with X-PAYMENT header -> receives 200 with resource
     */
    static async get(url: string, options?: {
        headers?: Record<string, string>;
        timeout?: number;
    }): Promise<X402Response> {
        try {
            console.log('[X402Client] GET:', url);

            // Step 1: Make initial request (expect 402)
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    ...options?.headers,
                },
            });

            console.log('[X402Client] Response status:', response.status);

            // Handle 402 Payment Required
            if (response.status === 402) {
                const data = await response.json();
                console.log('[X402Client] 402 response data:', data);

                // Extract payment requirements from various possible formats
                const paymentRequirements =
                    data.paymentRequirements ||
                    data.accepts?.[0] ||
                    data.accept?.[0] ||
                    data;

                if (!paymentRequirements) {
                    return {
                        success: false,
                        status: 402,
                        error: 'No payment requirements in 402 response',
                    };
                }

                return {
                    success: true,
                    status: 402,
                    paymentRequired: true,
                    paymentRequirements,
                };
            }

            // Handle success (200)
            if (response.ok) {
                const data = await response.json();
                return {
                    success: true,
                    status: response.status,
                    data,
                };
            }

            // Handle other errors
            const errorText = await response.text();
            return {
                success: false,
                status: response.status,
                error: `HTTP ${response.status}: ${errorText}`,
            };

        } catch (error: any) {
            console.error('[X402Client] Request failed:', error);
            return {
                success: false,
                status: 0,
                error: error.message || 'Request failed',
            };
        }
    }

    /**
     * Make a request with payment authorization
     */
    static async getWithPayment(
        url: string,
        paymentPayload: string,
        options?: {
            headers?: Record<string, string>;
        }
    ): Promise<X402Response> {
        try {
            console.log('[X402Client] GET with payment:', url);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'X-PAYMENT': paymentPayload,
                    ...options?.headers,
                },
            });

            console.log('[X402Client] Response status:', response.status);

            if (response.ok) {
                const data = await response.json();
                return {
                    success: true,
                    status: response.status,
                    data,
                };
            }

            // Handle error
            const errorText = await response.text();
            return {
                success: false,
                status: response.status,
                error: `HTTP ${response.status}: ${errorText}`,
            };

        } catch (error: any) {
            console.error('[X402Client] Request with payment failed:', error);
            return {
                success: false,
                status: 0,
                error: error.message || 'Request failed',
            };
        }
    }

    /**
     * Complete x402 payment flow
     *
     * This handles the full flow:
     * 1. GET endpoint -> 402 with payment requirements
     * 2. Create and sign payment with background script
     * 3. GET endpoint with payment -> 200 with resource
     */
    static async payAndGet(
        url: string,
        account: any,
        options?: {
            headers?: Record<string, string>;
        }
    ): Promise<X402Response> {
        try {
            // Step 1: Get payment requirements
            const initialResponse = await this.get(url, options);

            if (!initialResponse.success) {
                return initialResponse;
            }

            // If not 402, return the response as-is
            if (!initialResponse.paymentRequired) {
                return initialResponse;
            }

            const paymentRequirements = initialResponse.paymentRequirements;
            if (!paymentRequirements) {
                return {
                    success: false,
                    status: 402,
                    error: 'No payment requirements provided',
                };
            }

            console.log('[X402Client] Payment requirements:', paymentRequirements);

            // Step 2: Create x402 payment in background script
            const paymentResponse = await chrome.runtime.sendMessage({
                type: 'CREATE_X402_PAYMENT',
                address: account.address,
                paymentRequirements: paymentRequirements,
            });

            if (!paymentResponse.success || !paymentResponse.encodedPayment) {
                return {
                    success: false,
                    status: 0,
                    error: paymentResponse.error || 'Failed to create x402 payment',
                };
            }

            const encodedPayment = paymentResponse.encodedPayment;
            console.log('[X402Client] Payment created, sending with request...');

            // Step 3: Make request with payment
            const paidResponse = await this.getWithPayment(url, encodedPayment, options);

            return paidResponse;

        } catch (error: any) {
            console.error('[X402Client] Pay and get failed:', error);
            return {
                success: false,
                status: 0,
                error: error.message || 'Payment flow failed',
            };
        }
    }
}
