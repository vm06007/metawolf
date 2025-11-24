/**
 * Simple mock utility for generating verify request payloads for CRE workflow simulation
 * This generates a single verify request that can be used with: cre workflow simulate ./d-verify --http-payload <file>
 */

import { type Address } from "viem";
import {
  type PaymentPayload,
  type PaymentRequirements,
} from "x402/types";

/**
 * Default test configuration for ethereum-testnet-sepolia
 * Using LINK token (18 decimals)
 */
const DEFAULT_CONFIG = {
  network: "ethereum-testnet-sepolia" as const,
  payTo: "0xf9711003d9b608e7aa96089cf3bdb510a950705c" as Address,
  payer: "0x46e0d7556C38E6b5Dac66D905814541723A42176" as Address,
  tokenAddress: "0x779877A7B0D9E8603169DdbD7836e478b4624789" as Address, // LINK token on Ethereum Sepolia
  amount: "3", // 3 wei (3 * 10^0, since LINK has 18 decimals)
  resource: "https://webhook.site/defe88ad-5059-4410-904c-95a2feb81dde",
};

/**
 * Creates a mock verify request payload for CRE workflow simulation
 * This is the format needed when running: cre workflow simulate ./d-verify --http-payload <file>
 */
export function createMockVerifyRequest(): {
  x402Version: number;
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
} {
  const now = Math.floor(Date.now() / 1000);
  
  // Generate a dummy nonce (32 bytes)
  const nonce = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}` as `0x${string}`;
  
  // Dummy signature (65 bytes) - NOT valid for real verification
  const dummySignature = `0x${Array.from({ length: 130 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}` as `0x${string}`;
  
  return {
    x402Version: 1,
    paymentPayload: {
      x402Version: 1,
      scheme: "exact",
      network: DEFAULT_CONFIG.network,
      payload: {
        signature: dummySignature,
        authorization: {
          from: DEFAULT_CONFIG.payer,
          to: DEFAULT_CONFIG.payTo,
          value: DEFAULT_CONFIG.amount,
          validAfter: (now - 60).toString(), // Valid 1 minute ago
          validBefore: (now + 3600).toString(), // Valid for 1 hour
          nonce,
        },
      },
    },
    paymentRequirements: {
      scheme: "exact",
      network: DEFAULT_CONFIG.network,
      maxAmountRequired: DEFAULT_CONFIG.amount,
      resource: DEFAULT_CONFIG.resource,
      description: "Test payment",
      mimeType: "application/json",
      payTo: DEFAULT_CONFIG.payTo,
      maxTimeoutSeconds: 3600,
      asset: DEFAULT_CONFIG.tokenAddress,
      outputSchema: {
        input: {
          type: "http",
          method: "GET",
          discoverable: true,
        },
      },
    },
  };
}


