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
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
};

const onHttpTrigger = async (runtime: Runtime<Config>, payload: HTTPPayload): Promise<string> => {
  try {
    runtime.log("\n=== API Call: POST /verify ===");

    // Decode the request body
    const body = decodeJson(payload.input) as VerifyRequest;
    
    // Validate the request data
    const paymentRequirements = PaymentRequirementsSchema.parse(body.paymentRequirements);
    const paymentPayload = PaymentPayloadSchema.parse(body.paymentPayload);

    runtime.log(`Network: ${paymentRequirements.network}`);

    // Use the correct client/signer based on the requested network
    let client: ConnectedClient;

    if (SupportedEVMNetworks.includes(paymentRequirements.network)) {
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

    // Get x402Config from config or use default/empty config
    const x402Config = runtime.config.x402Config || ({} as X402Config);

    // Verify
    const valid = await verify(client, paymentPayload, paymentRequirements, x402Config);
    
    runtime.log(`Verification result: ${valid}`);
    runtime.log("=========================\n");

    return JSON.stringify(valid);
  } catch (error) {
    runtime.log(`Error: ${error instanceof Error ? error.message : String(error)}`);
    const errorResponse = { error: "Invalid request" };
    if (error instanceof Error) {
      errorResponse.error = error.message;
    }
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

