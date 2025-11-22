import { cre, type Runtime, type HTTPPayload, Runner, decodeJson } from "@chainlink/cre-sdk"
import { verify } from "x402/facilitator";
import {
  PaymentRequirementsSchema,
  type PaymentRequirements,
  type PaymentPayload,
  PaymentPayloadSchema,
  createConnectedClient,
  // TODO: Uncomment when CRE supports Solana (SVM)
  // createSigner,
  SupportedEVMNetworks,
  // SupportedSVMNetworks,
  // Signer,
  ConnectedClient,
  type X402Config,
} from "x402/types";


type Config = {
  authorizedEVMAddress: string;
  // TODO: Uncomment when CRE supports Solana (SVM)
  // svmPrivateKey?: string;
  x402Config?: X402Config;
}

type VerifyRequest = {
  x402Version?: number; // Optional top-level version for API compatibility
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
};

/// @notice Verifies a payment payload against the required payment details
/// @param runtime The CRE runtime
/// @param paymentPayload The signed payment payload containing transfer parameters and signature
/// @param paymentRequirements The payment requirements that the payload must satisfy
/// @param x402Config Optional x402 configuration
/// @returns Verification response indicating if the payment is valid and any invalidation reason
/// 
/// This function performs several verification steps (via x402 verify function):
/// - Verifies protocol version compatibility (scheme and x402Version)
/// - Validates the permit signature (recoverable for the owner address, verified against the token contract)
/// - Validates token contract address (uses paymentRequirements.asset - accepts any ERC20 token, not just USDC)
/// - Checks permit deadline is sufficiently in the future (validBefore)
/// - Verifies permit is currently valid (validAfter <= now)
/// - Verifies client has sufficient token balance (>= maxAmountRequired) for the specified token
/// - Ensures payment amount meets required minimum (value >= maxAmountRequired)
/// - Verifies payment recipient matches paymentRequirements.payTo
/// 
/// Note: The verify function does NOT restrict payments to USDC only. It accepts any ERC20 token
/// address specified in paymentRequirements.asset. The signature verification uses this address
/// as the verifyingContract in the EIP-712 domain, so it will work with any ERC20 token that
/// supports the transferWithAuthorization function.
async function verifyPayment(
  runtime: Runtime<Config>,
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  x402Config: X402Config
): Promise<{ isValid: boolean; invalidReason?: string; payer?: string; errorMessage?: string }> {
  try {
    runtime.log("Starting payment verification...");
    runtime.log(`Network: ${paymentRequirements.network}`);
    runtime.log(`Payment scheme: ${paymentPayload.scheme}`);
    runtime.log(`X402 version: ${paymentPayload.x402Version}`);

    // Use the correct client/signer based on the requested network
    let client: ConnectedClient;

    if (SupportedEVMNetworks.includes(paymentRequirements.network)) {
      runtime.log("Creating EVM client...");
      client = createConnectedClient(paymentRequirements.network);
    } else {
      // TODO: Uncomment when CRE supports Solana (SVM)
      // SVM verify requires a Signer because it signs & simulates the txn
      // } else if (SupportedSVMNetworks.includes(paymentRequirements.network)) {
      //   const svmPrivateKey = runtime.config.svmPrivateKey;
      //   if (!svmPrivateKey) {
      //     throw new Error("SVM_PRIVATE_KEY is required for SVM networks");
      //   }
      //   client = await createSigner(paymentRequirements.network, svmPrivateKey);
      throw new Error("Invalid network - only EVM networks are currently supported");
    }

    runtime.log("Calling x402 verify function...");
    runtime.log(`Token contract: ${paymentRequirements.asset}`);
    runtime.log("Verification checks being performed:");
    runtime.log("  - Protocol version compatibility");
    runtime.log("  - Permit signature validation");
    runtime.log("  - Token contract address validation (uses paymentRequirements.asset)");
    runtime.log("  - Deadline validation (validAfter/validBefore)");
    runtime.log("  - Balance checks");
    runtime.log("  - Amount validation");
    
    // Verify payment using x402 facilitator
    // The verify function performs all the security checks:
    // 1. Protocol version verification (scheme and version match)
    // 2. Permit signature validation (recoverable for owner, verified against the token contract)
    // 3. Token contract address validation (uses paymentRequirements.asset - can be any ERC20 token)
    //    Note: The verify function does NOT restrict to USDC only - it accepts any ERC20 token
    //    The signature is verified against the token contract specified in paymentRequirements.asset
    // 4. Deadline validation (validBefore >= now + 6 seconds, validAfter <= now)
    // 5. Balance checks (payer has >= maxAmountRequired of the specified token)
    // 6. Amount validation (value >= maxAmountRequired)
    // 7. Recipient validation (to === paymentRequirements.payTo)
    const verifyResponse = await verify(client, paymentPayload, paymentRequirements, x402Config);
    
    if (verifyResponse.isValid) {
      runtime.log(`✓ Verification successful`);
      runtime.log(`  Payer: ${verifyResponse.payer}`);
    } else {
      runtime.log(`✗ Verification failed`);
      runtime.log(`  Reason: ${verifyResponse.invalidReason || 'Unknown'}`);
      runtime.log(`  Payer: ${verifyResponse.payer || 'N/A'}`);
    }

    return {
      isValid: verifyResponse.isValid,
      invalidReason: verifyResponse.invalidReason,
      payer: verifyResponse.payer,
      errorMessage: verifyResponse.invalidReason, // For compatibility with thirdweb format
    };
  } catch (error) {
    runtime.log(`Verification error: ${error instanceof Error ? error.message : String(error)}`);
    return {
      isValid: false,
      invalidReason: error instanceof Error ? error.message : String(error),
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

const onHttpTrigger = async (runtime: Runtime<Config>, payload: HTTPPayload): Promise<string> => {
  try {
    runtime.log("\n=== API Call: POST /verify ===");
    runtime.log(`Timestamp: ${new Date().toISOString()}`);

    // Decode the request body
    const body = decodeJson(payload.input) as VerifyRequest;
    
    // Validate optional top-level x402Version for API compatibility
    if (body.x402Version !== undefined && body.x402Version !== 1) {
      runtime.log(`Warning: Unsupported x402Version: ${body.x402Version}, expected 1`);
    }
    
    // Validate the request data using Zod schemas
    // This performs initial validation similar to decodePaymentRequest
    const paymentRequirements = PaymentRequirementsSchema.parse(body.paymentRequirements);
    const paymentPayload = PaymentPayloadSchema.parse(body.paymentPayload);

    // Additional validation: Ensure paymentPayload has x402Version
    if (!paymentPayload.x402Version) {
      throw new Error("paymentPayload must include x402Version");
    }

    // Get x402Config from config or use default/empty config
    const x402Config = runtime.config.x402Config || ({} as X402Config);

    // Verify payment
    const response = await verifyPayment(
      runtime,
      paymentPayload,
      paymentRequirements,
      x402Config
    );
    
    runtime.log("=========================\n");

    // Return response in the same format as thirdweb facilitator
    return JSON.stringify(response);
  } catch (error) {
    runtime.log(`Error: ${error instanceof Error ? error.message : String(error)}`);
    
    // Return error response compatible with thirdweb facilitator format
    const errorResponse = { 
      isValid: false,
      error: "Verification error",
      errorMessage: error instanceof Error ? error.message : String(error),
      invalidReason: error instanceof Error ? error.message : String(error)
    };
    // In CRE, we can't set HTTP status codes directly, but we can return error JSON
    return JSON.stringify(errorResponse);
  }
}


const initWorkflow = (config: Config) => {
  const httpTrigger = new cre.capabilities.HTTPCapability()

  return [
    cre.handler(
      httpTrigger.trigger({
        authorizedKeys: [
          {
            type: "KEY_TYPE_ECDSA_EVM",
            publicKey: config.authorizedEVMAddress,
          },
        ],
      }),
      onHttpTrigger
    ),
  ]
}

export async function main() {
  const runner = await Runner.newRunner<Config>()
  await runner.run(initWorkflow)
}

main()

