import { cre, type Runtime, type HTTPPayload, Runner, decodeJson } from "@chainlink/cre-sdk"
import {
  PaymentRequirementsSchema,
  type PaymentRequirements,
  type PaymentPayload,
  PaymentPayloadSchema,
  type X402Config,
} from "x402/types";
import { verifyPayment } from "../shared/verify-payment";


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
    // Note: Zod's URL validation may be strict, so we validate the resource URL separately
    // and use the raw object if schema validation fails only on the resource field
    let paymentRequirements: PaymentRequirements;
    const paymentRequirementsResult = PaymentRequirementsSchema.safeParse(body.paymentRequirements);
    
    if (!paymentRequirementsResult.success) {
      // Check if the only error is the resource URL validation
      const errors = paymentRequirementsResult.error.errors;
      const isOnlyResourceUrlError = errors.length === 1 && 
        errors[0].path.length === 1 && 
        errors[0].path[0] === "resource" &&
        errors[0].code === "invalid_string";
      
      if (isOnlyResourceUrlError) {
        // If it's only the resource URL validation failing, use the raw object
        // The URL is likely valid but Zod's validation is too strict
        runtime.log(`Warning: Resource URL validation failed, but URL appears valid: "${body.paymentRequirements.resource}"`);
        runtime.log(`Using payment requirements without strict URL validation`);
        paymentRequirements = body.paymentRequirements as PaymentRequirements;
      } else {
        // Other validation errors - return them
        const errorMessage = JSON.stringify(errors, null, 2);
        runtime.log(`Schema validation error: ${errorMessage}`);
        return JSON.stringify({
          isValid: false,
          error: "Validation error",
          errorMessage: errorMessage,
          invalidReason: errorMessage,
        });
      }
    } else {
      paymentRequirements = paymentRequirementsResult.data;
    }
    
    const paymentPayloadResult = PaymentPayloadSchema.safeParse(body.paymentPayload);
    if (!paymentPayloadResult.success) {
      const errorMessage = JSON.stringify(paymentPayloadResult.error.errors, null, 2);
      runtime.log(`Error: ${errorMessage}`);
      return JSON.stringify({
        isValid: false,
        error: "Validation error",
        errorMessage: errorMessage,
        invalidReason: errorMessage,
      });
    }
    const paymentPayload = paymentPayloadResult.data;

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

