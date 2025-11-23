/**
 * Script to generate a properly signed payment payload using LINK token
 * for Ethereum Sepolia with 3 wei amount
 * 
 * Usage:
 *   bun run generate-link-payload.ts
 * 
 * This generates a verify-request.json file with a properly signed signature
 * that can be used with:
 *   cre workflow simulate ./d-verify --http-payload generated-payloads/verify-request.json
 */

import { createWalletClient, http, type Account } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { exact } from "x402/schemes";
import { type PaymentRequirements } from "x402/types";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import dotenv from "dotenv";

// Load environment variables
const envPath = join(process.cwd(), "..", ".env");
const localEnvPath = join(process.cwd(), ".env");
dotenv.config({ path: envPath });
dotenv.config({ path: localEnvPath });

// LINK token address on Ethereum Sepolia
const LINK_TOKEN_SEPOLIA = "0x779877A7B0D9E8603169DdbD7836e478b4624789" as `0x${string}`;

async function main() {
  // Get private key from environment
  const privateKey = process.env.PRIVATE_KEY || process.env.CRE_ETH_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY or CRE_ETH_PRIVATE_KEY not found in .env file");
  }

  // Ensure private key has 0x prefix
  const formattedPrivateKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;

  // Create account from private key
  const account = privateKeyToAccount(formattedPrivateKey as `0x${string}`);
  console.log(`Using account: ${account.address}`);

  // Recipient address
  const recipientAddress = "0xf9711003d9b608e7aa96089cf3bdb510a950705c" as `0x${string}`;
  console.log(`Recipient address: ${recipientAddress}`);

  // Create payment requirements for LINK token
  const now = Math.floor(Date.now() / 1000);
  const paymentRequirements: PaymentRequirements = {
    scheme: "exact",
    network: "sepolia", // x402 uses "sepolia" instead of "ethereum-testnet-sepolia"
    maxAmountRequired: "3", // 3 wei (LINK has 18 decimals, so this is 3 * 10^-18 LINK)
    resource: "https://webhook.site/defe88ad-5059-4410-904c-95a2feb81dde",
    description: "Test payment with LINK token",
    mimeType: "application/json",
    payTo: recipientAddress,
    maxTimeoutSeconds: 3600,
    asset: LINK_TOKEN_SEPOLIA,
    outputSchema: {
      input: {
        type: "http",
        method: "GET",
        discoverable: true,
      },
    },
  };

  console.log(`\n=== Payment Requirements ===`);
  console.log(`Network: ${paymentRequirements.network}`);
  console.log(`Token: LINK (${LINK_TOKEN_SEPOLIA})`);
  console.log(`Amount: ${paymentRequirements.maxAmountRequired} wei`);
  console.log(`PayTo: ${paymentRequirements.payTo}`);

  // Create wallet client
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(),
  });

  console.log(`\n=== Signing Payment ===`);
  
  // Create and sign the payment using x402's exact.evm.createPayment
  const paymentPayload = await exact.evm.createPayment(
    walletClient as any,
    1, // x402Version
    paymentRequirements
  );

  console.log(`✓ Payment signed successfully`);
  console.log(`  Payer: ${paymentPayload.payload.authorization.from}`);
  console.log(`  Recipient: ${paymentPayload.payload.authorization.to}`);
  console.log(`  Amount: ${paymentPayload.payload.authorization.value}`);
  console.log(`  Valid after: ${new Date(Number(paymentPayload.payload.authorization.validAfter) * 1000).toISOString()}`);
  console.log(`  Valid before: ${new Date(Number(paymentPayload.payload.authorization.validBefore) * 1000).toISOString()}`);

  // Create verify request
  const verifyRequest = {
    x402Version: 1,
    paymentPayload,
    paymentRequirements,
  };

  // Create output directory
  const outputDir = join(process.cwd(), "generated-payloads");
  mkdirSync(outputDir, { recursive: true });

  // Write verify request file
  writeFileSync(
    join(outputDir, "verify-request.json"),
    JSON.stringify(verifyRequest, null, 2)
  );

  console.log(`\n✓ Generated: generated-payloads/verify-request.json`);
  console.log(`\nTo use with CRE workflow simulation:`);
  console.log(`  cre workflow simulate ./d-verify --http-payload generated-payloads/verify-request.json`);
}

// Run the script
main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});

