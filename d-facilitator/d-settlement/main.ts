import { 
  cre, 
  type Runtime, 
  type HTTPPayload, 
  Runner, 
  decodeJson,
  getNetwork,
  hexToBase64,
  bytesToHex,
  TxStatus,
  HTTPSendRequester,
  ok,
  consensusIdenticalAggregation
} from "@chainlink/cre-sdk"
import { encodeAbiParameters, parseAbiParameters, encodeFunctionData, parseErc6492Signature, type Hex, keccak256, toHex, parseAbi, decodeEventLog, type Address } from "viem"
import {
  PaymentRequirementsSchema,
  type PaymentRequirements,
  type PaymentPayload,
  PaymentPayloadSchema,
  createSigner,
  createConnectedClient,
  SupportedEVMNetworks,
  // TODO: Uncomment when CRE supports Solana (SVM)
  // SupportedSVMNetworks,
  Signer,
  ConnectedClient,
  type X402Config,
  type SettleResponse,
} from "x402/types"
import { verifyPayment } from "../shared/verify-payment";
import { getNetworkInfo } from "../shared/network";
import { prepareSettlementExecutionData } from "../shared/settlement";


type Config = {
  authorizedEVMAddress: string;
  settlementReceiverAddress: string; // SettlementReceiver contract address
  executionProxyAddress: string; // ExecutionProxy contract address
  chainSelectorName: string; // Chain selector name for EVM log trigger (e.g., "ethereum-testnet-sepolia")
  isTestnet: boolean; // Whether the chain is a testnet
  // Note: chainSelectorName is now determined from paymentRequirements.network in the request
  // This allows the workflow to handle payments on any supported network dynamically
  gasLimit?: string; // Optional, defaults to "500000"
  reVerifyBeforeSettle?: boolean; // Optional, defaults to true - re-verify payment before settling
  callbackUrl?: string; // Optional URL to send EVM log event data via POST
  // TODO: Uncomment when CRE supports Solana (SVM)
  // svmPrivateKey?: string;
  x402Config?: X402Config;
}

type SettleRequest = {
  x402Version?: number; // Optional top-level version for API compatibility
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
};

// Event ABIs for ExecutionProxy
const executionProxyAbi = parseAbi([
  "event ExecutionSucceeded(address indexed caller, address indexed target, bytes data, uint256 value, bool success, bytes result)",
  "event ExecutionFailed(address indexed caller, address indexed target, bytes data, uint256 value, string reason)"
]);

/// @notice Log payload structure from EVM log trigger
type EVMLogPayload = {
  address: string | Uint8Array;
  topics: Uint8Array[];
  data: Uint8Array;
  blockNumber?: bigint | BigInt;
  transactionHash?: string;
  logIndex?: number;
};

/// @notice Handles EVM log events from ExecutionProxy contract
/// @param runtime The CRE runtime
/// @param payload The log payload containing event data
/// @returns A string summary of the processed event
async function onEVMLogTrigger(runtime: Runtime<Config>, payload: EVMLogPayload): Promise<string> {
  try {
    runtime.log("\n=== EVM Log Event Detected ===");
    runtime.log(`Timestamp: ${new Date().toISOString()}`);
    
    // Extract log data
    // Convert address to string if it's Uint8Array
    const logAddress = typeof payload.address === 'string' 
      ? payload.address 
      : bytesToHex(payload.address);
    const logTopics = payload.topics || [];
    const logData = payload.data || new Uint8Array(0);

    runtime.log(`Contract Address: ${logAddress}`);
    runtime.log(`Topics Count: ${logTopics.length}`);
    runtime.log(`Data Length: ${logData.length} bytes`);

    // Verify it's from ExecutionProxy
    const isExecutionProxy = logAddress.toLowerCase() === runtime.config.executionProxyAddress.toLowerCase();

    if (!isExecutionProxy) {
      runtime.log(`Warning: Event from unknown contract: ${logAddress}`);
      return JSON.stringify({ status: "ignored", reason: "unknown_contract" });
    }

    // Get event signature from topics[0]
    const eventSignature = logTopics.length > 0 ? bytesToHex(logTopics[0]) : null;
    
    if (!eventSignature) {
      runtime.log("Warning: No event signature found in topics");
      return JSON.stringify({ status: "error", reason: "no_signature" });
    }

    // Calculate event selectors for comparison
    const executionSucceededHash = keccak256(toHex("ExecutionSucceeded(address,address,bytes,uint256,bool,bytes)"));
    const executionFailedHash = keccak256(toHex("ExecutionFailed(address,address,bytes,uint256,string)"));

    if (eventSignature === executionSucceededHash) {
      // Decode ExecutionSucceeded event
      try {
        const decoded = decodeEventLog({
          abi: executionProxyAbi,
          data: bytesToHex(logData),
          topics: [bytesToHex(logTopics[0]), ...logTopics.slice(1).map(t => bytesToHex(t))] as [Hex, ...Hex[]],
          eventName: "ExecutionSucceeded",
        });

        runtime.log(`\n--- ExecutionProxy.ExecutionSucceeded ---`);
        runtime.log(`Caller: ${decoded.args.caller}`);
        runtime.log(`Target: ${decoded.args.target}`);
        runtime.log(`Value: ${decoded.args.value.toString()}`);
        runtime.log(`Success: ${decoded.args.success}`);
        runtime.log(`Data Length: ${decoded.args.data.length} bytes`);
        runtime.log(`Result Length: ${decoded.args.result.length} bytes`);
        runtime.log(`Transaction Hash: ${payload.transactionHash || 'N/A'}`);

        // Map event data to SettleResponse format
        const settleResponse: SettleResponse = {
          success: decoded.args.success,
          payer: decoded.args.caller as string,
          transaction: payload.transactionHash || "",
          network: getX402NetworkFromChainSelector(runtime.config.chainSelectorName),
        };

        // Send callback if configured
        if (runtime.config.callbackUrl) {
          await sendEventCallback(runtime, settleResponse);
        }

        return JSON.stringify(settleResponse);
      } catch (error) {
        runtime.log(`Error decoding ExecutionProxy.ExecutionSucceeded: ${error instanceof Error ? error.message : String(error)}`);
        return JSON.stringify({ status: "error", reason: "decode_failed" });
      }
    } else if (eventSignature === executionFailedHash) {
      // Decode ExecutionFailed event
      try {
        const decoded = decodeEventLog({
          abi: executionProxyAbi,
          data: bytesToHex(logData),
          topics: [bytesToHex(logTopics[0]), ...logTopics.slice(1).map(t => bytesToHex(t))] as [Hex, ...Hex[]],
          eventName: "ExecutionFailed",
        });

        runtime.log(`\n--- ExecutionProxy.ExecutionFailed ---`);
        runtime.log(`Caller: ${decoded.args.caller}`);
        runtime.log(`Target: ${decoded.args.target}`);
        runtime.log(`Value: ${decoded.args.value.toString()}`);
        runtime.log(`Reason: ${decoded.args.reason}`);
        runtime.log(`Data Length: ${decoded.args.data.length} bytes`);
        runtime.log(`Transaction Hash: ${payload.transactionHash || 'N/A'}`);

        // Map event data to SettleResponse format
        const settleResponse: SettleResponse = {
          success: false,
          errorReason: decoded.args.reason as SettleResponse["errorReason"],
          payer: decoded.args.caller as string,
          transaction: payload.transactionHash || "",
          network: getX402NetworkFromChainSelector(runtime.config.chainSelectorName),
        };

        // Send callback if configured
        if (runtime.config.callbackUrl) {
          await sendEventCallback(runtime, settleResponse);
        }

        return JSON.stringify(settleResponse);
      } catch (error) {
        runtime.log(`Error decoding ExecutionProxy.ExecutionFailed: ${error instanceof Error ? error.message : String(error)}`);
        return JSON.stringify({ status: "error", reason: "decode_failed" });
      }
    } else {
      runtime.log(`Warning: Unknown event signature: ${eventSignature}`);
      return JSON.stringify({ status: "ignored", reason: "unknown_event" });
    }
  } catch (error) {
    runtime.log(`Error processing EVM log: ${error instanceof Error ? error.message : String(error)}`);
    const errorResponse: SettleResponse = {
      success: false,
      errorReason: (error instanceof Error ? error.message : String(error)) as SettleResponse["errorReason"],
      transaction: "",
      network: getX402NetworkFromChainSelector(runtime.config.chainSelectorName),
    };
    
    // Send callback even for errors if configured
    if (runtime.config.callbackUrl) {
      try {
        await sendEventCallback(runtime, errorResponse);
      } catch (callbackError) {
        runtime.log(`Warning: Failed to send error callback: ${callbackError instanceof Error ? callbackError.message : String(callbackError)}`);
      }
    }
    
    return JSON.stringify(errorResponse);
  }
}

/// @notice Maps CRE chainSelectorName back to x402 network string
/// @param chainSelectorName The CRE chain selector name (e.g., "ethereum-testnet-sepolia-base-1")
/// @returns The x402 network string (e.g., "base-sepolia")
function getX402NetworkFromChainSelector(chainSelectorName: string): SettleResponse["network"] {
  // Reverse mapping from CRE chainSelectorName to x402 network format
  // Note: Only maps to networks that are in SettleResponse["network"] type
  const reverseMap: Partial<Record<string, SettleResponse["network"]>> = {
    'avalanche-mainnet': 'avalanche',
    'ethereum-mainnet-base-1': 'base',
    'polygon-mainnet': 'polygon',
    'avalanche-testnet-fuji': 'avalanche-fuji',
    'ethereum-testnet-sepolia-base-1': 'base-sepolia',
    'polygon-testnet-amoy': 'polygon-amoy',
  };
  
  const mapped = reverseMap[chainSelectorName];
  if (mapped) {
    return mapped;
  }
  
  // Fallback: try to infer from chainSelectorName
  if (chainSelectorName.includes('base-sepolia') || chainSelectorName.includes('base-1')) {
    return 'base-sepolia';
  }
  if (chainSelectorName.includes('avalanche-fuji') || chainSelectorName.includes('fuji')) {
    return 'avalanche-fuji';
  }
  if (chainSelectorName.includes('polygon-amoy') || chainSelectorName.includes('amoy')) {
    return 'polygon-amoy';
  }
  
  // Default fallback
  return 'base-sepolia';
}

/// @notice Sends an HTTP POST callback with SettleResponse data to the configured callback URL
/// @param runtime The CRE runtime
/// @param settleResponse The settlement response to send
async function sendEventCallback(runtime: Runtime<Config>, settleResponse: SettleResponse): Promise<void> {
  try {
    runtime.log(`Sending settlement callback to: ${runtime.config.callbackUrl}`);
    
    const httpClient = new cre.capabilities.HTTPClient();
    
    // Function to send the POST request
    const sendCallback = (sendRequester: HTTPSendRequester, config: Config) => {
      // 1. Serialize the settlement response to JSON and encode as bytes
      const bodyBytes = new TextEncoder().encode(JSON.stringify(settleResponse));
      
      // 2. Convert to base64 for the request
      const body = Buffer.from(bodyBytes).toString("base64");
      
      // 3. Construct the POST request with cacheSettings
      const req = {
        url: config.callbackUrl!,
        method: "POST" as const,
        body,
        headers: {
          "Content-Type": "application/json",
        },
        cacheSettings: {
          readFromCache: true, // Enable reading from cache
          maxAgeMs: 60000, // Accept cached responses up to 60 seconds old
        },
      };
      
      // 4. Send the request and wait for the response
      const resp = sendRequester.sendRequest(req).result();
      
      if (!ok(resp)) {
        throw new Error(`HTTP request failed with status: ${resp.statusCode}`);
      }
      
      return { statusCode: resp.statusCode };
    };

    // Send request with consensus aggregation
    const result = httpClient
      .sendRequest(
        runtime,
        sendCallback,
        consensusIdenticalAggregation<{ statusCode: number }>()
      )(runtime.config)
      .result();

    runtime.log(`Callback HTTP status: ${result.statusCode}`);
  } catch (callbackError) {
    runtime.log(`Warning: Failed to send settlement callback: ${callbackError instanceof Error ? callbackError.message : String(callbackError)}`);
    // Don't throw - we don't want callback failures to break the log processing
  }
}

/// @notice Re-verifies payment before settlement to ensure it's still valid
/// @param runtime The CRE runtime
/// @param paymentPayload The signed payment payload
/// @param paymentRequirements The payment requirements
/// @param x402Config Optional x402 configuration
/// @returns Verification result
async function reVerifyPayment(
  runtime: Runtime<Config>,
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  x402Config: X402Config
): Promise<{ isValid: boolean; invalidReason?: string; payer?: string }> {
  runtime.log("Re-verifying payment before settlement...");
  
  // Re-verify to ensure the payment is still valid using shared verification function
  const verifyResponse = await verifyPayment(runtime, paymentPayload, paymentRequirements, x402Config);
  
  if (!verifyResponse.isValid) {
    runtime.log(`Re-verification failed: ${verifyResponse.invalidReason || 'Unknown reason'}`);
  } else {
    runtime.log("Re-verification successful - payment is still valid");
  }
  
  return {
    isValid: verifyResponse.isValid,
    invalidReason: verifyResponse.invalidReason,
    payer: verifyResponse.payer,
  };
}

/// @notice Settles payment by writing execution data to SettlementReceiver contract using CRE
/// @param runtime The CRE runtime
/// @param paymentPayload The signed payment payload
/// @param paymentRequirements The payment requirements
/// @param x402Config Optional x402 configuration
/// @returns Settlement response matching x402 SettleResponse format
/// @dev Works with any ERC20 token that supports transferWithAuthorization in supported networks
/// This follows the same pattern as x402's settle() function but uses CRE's onchain write:
/// 1. Re-verifies payment (optional, configurable)
/// 2. Parses ERC6492 signature if present
/// 3. Prepares execution data (target, calldata, value)
/// 4. Sends via CRE writeReport to SettlementReceiver contract
/// 5. SettlementReceiver.onReport() decodes and executes via ExecutionProxy
async function settlePaymentOnchain(
  runtime: Runtime<Config>,
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  x402Config: X402Config
): Promise<{ success: boolean; transaction?: string; network?: string; errorReason?: string; payer?: string }> {
  try {
    // Optionally re-verify payment before settlement to ensure it's still valid
    // This can be disabled via config if verification already happened in a separate workflow
    const shouldReVerify = runtime.config.reVerifyBeforeSettle !== false; // Default to true
    
    if (shouldReVerify) {
      runtime.log("Re-verifying payment before settlement...");
      const verification = await reVerifyPayment(runtime, paymentPayload, paymentRequirements, x402Config);
      
      if (!verification.isValid) {
        runtime.log(`Settlement aborted: Payment is no longer valid - ${verification.invalidReason}`);
        return {
          success: false,
          network: paymentPayload.network,
          transaction: "",
          errorReason: verification.invalidReason || "invalid_scheme",
          payer: verification.payer || (('authorization' in paymentPayload.payload) ? paymentPayload.payload.authorization.from : undefined),
        };
      }
      runtime.log("Re-verification successful - proceeding with settlement");
    } else {
      runtime.log("Skipping re-verification (disabled in config)");
    }
    
    runtime.log("Preparing settlement execution data...");
    runtime.log(`Token contract: ${paymentRequirements.asset}`);

    // Prepare execution data for the token transfer
    const { target, data, value } = prepareSettlementExecutionData(
      paymentPayload,
      paymentRequirements
    );

    runtime.log(`Target contract: ${target}`);
    runtime.log(`Execution data length: ${data.length} bytes`);

    // ABI-encode the report data: (address target, bytes data, uint256 value)
    const reportData = encodeAbiParameters(
      parseAbiParameters("address target, bytes data, uint256 value"),
      [target, data, value]
    );

    runtime.log("Generating signed report...");

    // Generate signed report
    const reportResponse = runtime
      .report({
        encodedPayload: hexToBase64(reportData),
        encoderName: "evm",
        signingAlgo: "ecdsa",
        hashingAlgo: "keccak256",
      })
      .result();

    runtime.log("Report generated, submitting to blockchain...");

    // Get network info from payment request (not config)
    // This ensures we use the correct network for the payment
    const networkInfo = getNetworkInfo(paymentRequirements.network);
    runtime.log(`Using network from payment request: ${paymentRequirements.network}`);
    runtime.log(`CRE chainSelectorName: ${networkInfo.chainSelectorName}, isTestnet: ${networkInfo.isTestnet}`);

    // Get network info for CRE
    const network = getNetwork({
      chainFamily: "evm",
      chainSelectorName: networkInfo.chainSelectorName,
      isTestnet: networkInfo.isTestnet,
    });

    if (!network) {
      throw new Error(`Network not found: ${networkInfo.chainSelectorName} (from payment request: ${paymentRequirements.network})`);
    }

    // Create EVM client
    const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);

    // Submit report to SettlementReceiver contract
    const writeResult = evmClient
      .writeReport(runtime, {
        receiver: runtime.config.settlementReceiverAddress,
        report: reportResponse,
        gasConfig: {
          gasLimit: runtime.config.gasLimit || "500000",
        },
      })
      .result();

    // Extract payer address for response (matches original settle() pattern)
    const payload = paymentPayload.payload as { authorization?: { from: string } };
    const payer = payload.authorization?.from;
    
    // Check transaction status (matches original settle() response format)
    if (writeResult.txStatus === TxStatus.SUCCESS) {
      const txHash = bytesToHex(writeResult.txHash || new Uint8Array(32));
      runtime.log(`Transaction successful: ${txHash}`);
      return {
        success: true,
        transaction: txHash,
        network: paymentPayload.network,
        payer,
      };
    } else if (writeResult.txStatus === TxStatus.REVERTED) {
      const errorMsg = writeResult.errorMessage || "Transaction reverted";
      runtime.log(`Transaction reverted: ${errorMsg}`);
      const txHash = writeResult.txHash ? bytesToHex(writeResult.txHash) : "";
      return {
        success: false,
        errorReason: "invalid_transaction_state",
        transaction: txHash,
        network: paymentPayload.network,
        payer,
      };
    } else if (writeResult.txStatus === TxStatus.FATAL) {
      const errorMsg = writeResult.errorMessage || "Fatal error";
      runtime.log(`Fatal error: ${errorMsg}`);
      const txHash = writeResult.txHash ? bytesToHex(writeResult.txHash) : "";
      return {
        success: false,
        errorReason: "fatal_error",
        transaction: txHash,
        network: paymentPayload.network,
        payer,
      };
    } else {
      return {
        success: false,
        errorReason: "unknown_status",
        transaction: "",
        network: paymentPayload.network,
        payer,
      };
    }
  } catch (error) {
    runtime.log(`Settlement error: ${error instanceof Error ? error.message : String(error)}`);
    const payload = paymentPayload.payload as { authorization?: { from: string } };
    return {
      success: false,
      errorReason: error instanceof Error ? error.message : String(error),
      transaction: "",
      network: paymentPayload.network,
      payer: payload.authorization?.from,
    };
  }
}

const onHttpTrigger = async (runtime: Runtime<Config>, payload: HTTPPayload): Promise<string> => {
  try {
    runtime.log("\n=== API Call: POST /settle ===");
    runtime.log(`Timestamp: ${new Date().toISOString()}`);

    // Decode the request body
    const body = decodeJson(payload.input) as SettleRequest;
    
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

    runtime.log(`Network: ${paymentRequirements.network}`);

    // Use the correct private key based on the requested network
    let signer: Signer;

    if (SupportedEVMNetworks.includes(paymentRequirements.network)) {
      // Get EVM private key from environment variable (.env) or CRE secrets
      // Priority: 1. Environment variable (for local dev/simulation), 2. CRE secrets (for production)
      let evmPrivateKey: string | undefined;
      
        try {
      
          const secret = runtime.getSecret({ id: 'EVM_PRIVATE_KEY' }).result();
          console.log(secret);
          evmPrivateKey = secret.value || '';
        } catch (secretError) {
          runtime.log(`Warning: Could not read EVM_PRIVATE_KEY from secrets: ${secretError instanceof Error ? secretError.message : String(secretError)}`);
        }
      // }
      
      if (!evmPrivateKey) {
        throw new Error("EVM_PRIVATE_KEY is required. Set it in .env file (CRE_ETH_PRIVATE_KEY or EVM_PRIVATE_KEY) or via CRE secrets (EVM_PRIVATE_KEY)");
      }
      
      signer = await createSigner(paymentRequirements.network, evmPrivateKey);
    } else {
      // TODO: Uncomment when CRE supports Solana (SVM)
      // } else if (SupportedSVMNetworks.includes(paymentRequirements.network)) {
      //   const svmPrivateKey = runtime.config.svmPrivateKey;
      //   if (!svmPrivateKey) {
      //     throw new Error("SVM_PRIVATE_KEY is required for SVM networks");
      //   }
      //   signer = await createSigner(paymentRequirements.network, svmPrivateKey);
      throw new Error("Invalid network - only EVM networks are currently supported");
    }

    // Get x402Config from config or use default/empty config
    const x402Config = runtime.config.x402Config || ({} as X402Config);

    // Settle using CRE's onchain write pattern
    const response = await settlePaymentOnchain(
      runtime,
      paymentPayload,
      paymentRequirements,
      x402Config
    );
    
    runtime.log(`Settlement result: ${JSON.stringify(response)}`);
    runtime.log("==========================\n");

    return JSON.stringify(response);
  } catch (error) {
    runtime.log(`Error: ${error instanceof Error ? error.message : String(error)}`);
    
    // Return error response compatible with thirdweb facilitator format
    const errorResponse = { 
      isValid: false,
      error: "Settlement error",
      errorMessage: error instanceof Error ? error.message : String(error),
      invalidReason: error instanceof Error ? error.message : String(error)
    };
    // In CRE, we can't set HTTP status codes directly, but we can return error JSON
    return JSON.stringify(errorResponse);
  }
}


const initWorkflow = (config: Config) => {
  const httpTrigger = new cre.capabilities.HTTPCapability()

  // Get network info for EVM log trigger
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: config.chainSelectorName,
    isTestnet: config.isTestnet,
  });

  if (!network) {
    throw new Error(`Network not found: ${config.chainSelectorName}`);
  }

  const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);

  // Calculate event hashes for ExecutionProxy events
  const executionSucceededHash = keccak256(toHex("ExecutionSucceeded(address,address,bytes,uint256,bool,bytes)"));
  const executionFailedHash = keccak256(toHex("ExecutionFailed(address,address,bytes,uint256,string)"));

  return [
    // HTTP trigger for settlement API
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
    // EVM log trigger for monitoring ExecutionProxy events
    cre.handler(
      // @ts-expect-error - CRE SDK logTrigger type compatibility issue with BigInt vs bigint
      evmClient.logTrigger({
        addresses: [config.executionProxyAddress as Address],
        topics: [
          { values: [executionSucceededHash, executionFailedHash] }, // Listen for ExecutionSucceeded OR ExecutionFailed
        ],
      }),
      onEVMLogTrigger
    ),
  ]
}

export async function main() {
  const runner = await Runner.newRunner<Config>()
  await runner.run(initWorkflow)
}

main()

