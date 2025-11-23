/**
 * Script to generate real signed payment payloads for testing
 * Uses private key from .env to sign payments
 * Outputs payloads that can be used for verify and settle workflows
 */

import { createWalletClient, http, type Account } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, sepolia, arbitrumSepolia } from "viem/chains";
import { exact } from "x402/schemes";
import { type PaymentRequirements, SupportedEVMNetworks } from "x402/types";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import dotenv from "dotenv";

// Load environment variables
// Try project root first, then current directory
const envPath = join(process.cwd(), "..", ".env");
const localEnvPath = join(process.cwd(), ".env");
dotenv.config({ path: envPath });
dotenv.config({ path: localEnvPath }); // Override with local if exists

// USDC token addresses for different networks
const USDC_ADDRESSES: Record<string, `0x${string}`> = {
  "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  "base": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "ethereum-testnet-sepolia": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  "ethereum-mainnet": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "arbitrum-sepolia": "0x75faf114eafb1BDbe2F0316DF893fd58Ce33AF70",
  "arbitrum-one": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  "optimism-sepolia": "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
  "optimism-mainnet": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  "polygon-amoy": "0x41e94eb019c0762f9bfcf9fb1f5f0c41813e40b5",
  "polygon-mainnet": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
};

// Network to viem chain mapping
const NETWORK_TO_CHAIN: Record<string, any> = {
  "base-sepolia": baseSepolia,
  "base": baseSepolia, // Use testnet for testing
  "ethereum-testnet-sepolia": sepolia,
  "ethereum-mainnet": sepolia, // Use testnet for testing
  "arbitrum-sepolia": arbitrumSepolia,
  "arbitrum-one": arbitrumSepolia, // Use testnet for testing
  "optimism-sepolia": sepolia, // Approximate
  "optimism-mainnet": sepolia, // Approximate
  "polygon-amoy": sepolia, // Approximate
  "polygon-mainnet": sepolia, // Approximate
};

/**
 * Creates payment requirements for a given network
 */
function createPaymentRequirements(
  network: typeof SupportedEVMNetworks[number],
  options: {
    payTo: `0x${string}`;
    amount: string;
    resource?: string;
  }
): PaymentRequirements {
  const now = Math.floor(Date.now() / 1000);
  
  return {
    scheme: "exact",
    network,
    maxAmountRequired: options.amount,
    resource: options.resource || `https://webhook.site/defe88ad-5059-4410-904c-95a2feb81dde`,
    description: "Test payment",
    mimeType: "application/json",
    payTo: options.payTo,
    maxTimeoutSeconds: 3600,
    asset: USDC_ADDRESSES[network] || USDC_ADDRESSES["base-sepolia"],
    outputSchema: {
      input: {
        type: "http",
        method: "GET",
        discoverable: true,
      },
      output: undefined,
    },
  };
}

/**
 * Generates a signed payment payload
 */
async function generateSignedPayment(
  account: Account,
  network: typeof SupportedEVMNetworks[number],
  paymentRequirements: PaymentRequirements
) {
  const chain = NETWORK_TO_CHAIN[network] || baseSepolia;
  
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(),
  });

  // Create and sign the payment using x402's exact.evm.createPayment
  // This function creates a properly signed EIP-712 payment
  const paymentPayload = await exact.evm.createPayment(
    walletClient as any, // x402 expects a compatible wallet client
    1, // x402Version
    paymentRequirements
  );

  return paymentPayload;
}

/**
 * Main function to generate payloads
 */
async function main() {
  // Get private key from environment (check both PRIVATE_KEY and CRE_ETH_PRIVATE_KEY)
  const privateKey = process.env.PRIVATE_KEY || process.env.CRE_ETH_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY or CRE_ETH_PRIVATE_KEY not found in .env file");
  }

  // Ensure private key has 0x prefix
  const formattedPrivateKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;

  // Create account from private key
  const account = privateKeyToAccount(formattedPrivateKey as `0x${string}`);
  console.log(`Using account: ${account.address}`);

  // Recipient address (can be different from sender)
  const recipientAddress = "0xf9711003d9b608e7aa96089cf3bdb510a950705c" as `0x${string}`;
  console.log(`Recipient address: ${recipientAddress}`);

  // Networks to generate payloads for
  // Note: Using network names that x402 actually supports
  const networks: (typeof SupportedEVMNetworks[number])[] = [
    "base-sepolia",
    // "ethereum-testnet-sepolia", // x402 uses "sepolia" instead
    // "arbitrum-sepolia", // x402 may use different name
  ];

  const results: Record<string, any> = {};

  for (const network of networks) {
    console.log(`\n=== Generating payload for ${network} ===`);
    
    try {
      // Create payment requirements
      const paymentRequirements = createPaymentRequirements(network, {
        payTo: recipientAddress,
        amount: "1000000", // 1 USDC (6 decimals)
        resource: `https://api.example.com:443/v1/resource-${network}`,
      });

      console.log(`Token address: ${paymentRequirements.asset}`);
      console.log(`Amount: ${paymentRequirements.maxAmountRequired} (1 USDC)`);

      // Generate signed payment
      const paymentPayload = await generateSignedPayment(
        account,
        network,
        paymentRequirements
      );

      // Create verify request
      const verifyRequest = {
        x402Version: 1,
        paymentPayload,
        paymentRequirements,
      };

      // Create settle request
      const settleRequest = {
        paymentPayload,
        paymentRequirements,
      };

      results[network] = {
        verify: verifyRequest,
        settle: settleRequest,
        paymentPayload,
        paymentRequirements,
      };

      console.log(`✓ Successfully generated payload for ${network}`);
      console.log(`  Payer: ${paymentPayload.payload.authorization.from}`);
      console.log(`  Recipient: ${paymentPayload.payload.authorization.to}`);
      console.log(`  Amount: ${paymentPayload.payload.authorization.value}`);
      console.log(`  Valid until: ${new Date(Number(paymentPayload.payload.authorization.validBefore) * 1000).toISOString()}`);

    } catch (error) {
      console.error(`✗ Failed to generate payload for ${network}:`, error);
      results[network] = { error: error instanceof Error ? error.message : String(error) };
    }
  }

  // Output results
  console.log("\n=== Generated Payloads ===");
  
  // Write to files (in the d-verify directory where script is located)
  // When running from d-verify/, process.cwd() is already d-verify, so just use current dir
  const outputDir = join(process.cwd().endsWith("d-verify") ? process.cwd() : join(process.cwd(), "d-verify"), "generated-payloads");
  try {
    mkdirSync(outputDir, { recursive: true });
  } catch (e) {
    // Directory might already exist
  }

  // Write individual network files
  for (const [network, data] of Object.entries(results)) {
    if (data.error) continue;

    // Verify request file
    writeFileSync(
      join(outputDir, `${network}-verify.json`),
      JSON.stringify(data.verify, null, 2)
    );

    // Settle request file
    writeFileSync(
      join(outputDir, `${network}-settle.json`),
      JSON.stringify(data.settle, null, 2)
    );

    console.log(`\n✓ Written files for ${network}:`);
    console.log(`  - ${network}-verify.json`);
    console.log(`  - ${network}-settle.json`);
  }

  // Write combined file
  writeFileSync(
    join(outputDir, "all-payloads.json"),
    JSON.stringify(results, null, 2)
  );

  console.log(`\n✓ Written combined file: all-payloads.json`);
  console.log(`\nAll files written to: ${outputDir}`);

  // Also output to terminal
  console.log("\n=== Terminal Output (base-sepolia verify) ===");
  if (results["base-sepolia"] && !results["base-sepolia"].error) {
    console.log(JSON.stringify(results["base-sepolia"].verify, null, 2));
  }
}

// Run the script
main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});

