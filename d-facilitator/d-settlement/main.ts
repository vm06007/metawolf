import { 
  cre, 
  type Runtime, 
  type HTTPPayload, 
  Runner, 
  decodeJson,
  getNetwork,
  hexToBase64,
  bytesToHex,
  TxStatus
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
} from "x402/types"
import { verify } from "x402/facilitator"


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
  // TODO: Uncomment when CRE supports Solana (SVM)
  // svmPrivateKey?: string;
  x402Config?: X402Config;
}

type SettleRequest = {
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
  address: string;
  topics: Uint8Array[];
  data: Uint8Array;
  blockNumber?: bigint;
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
    const logAddress = payload.address;
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
          topics: logTopics.map(t => bytesToHex(t)),
          eventName: "ExecutionSucceeded",
        });

        runtime.log(`\n--- ExecutionProxy.ExecutionSucceeded ---`);
        runtime.log(`Caller: ${decoded.args.caller}`);
        runtime.log(`Target: ${decoded.args.target}`);
        runtime.log(`Value: ${decoded.args.value.toString()}`);
        runtime.log(`Success: ${decoded.args.success}`);
        runtime.log(`Data Length: ${decoded.args.data.length} bytes`);
        runtime.log(`Result Length: ${decoded.args.result.length} bytes`);

        return JSON.stringify({
          status: "processed",
          contract: "ExecutionProxy",
          event: "ExecutionSucceeded",
          caller: decoded.args.caller,
          target: decoded.args.target,
          value: decoded.args.value.toString(),
          success: decoded.args.success,
          dataLength: decoded.args.data.length,
          resultLength: decoded.args.result.length,
        });
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
          topics: logTopics.map(t => bytesToHex(t)),
          eventName: "ExecutionFailed",
        });

        runtime.log(`\n--- ExecutionProxy.ExecutionFailed ---`);
        runtime.log(`Caller: ${decoded.args.caller}`);
        runtime.log(`Target: ${decoded.args.target}`);
        runtime.log(`Value: ${decoded.args.value.toString()}`);
        runtime.log(`Reason: ${decoded.args.reason}`);
        runtime.log(`Data Length: ${decoded.args.data.length} bytes`);

        return JSON.stringify({
          status: "processed",
          contract: "ExecutionProxy",
          event: "ExecutionFailed",
          caller: decoded.args.caller,
          target: decoded.args.target,
          value: decoded.args.value.toString(),
          reason: decoded.args.reason,
          dataLength: decoded.args.data.length,
        });
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
    return JSON.stringify({ 
      status: "error", 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}

/// @notice Maps x402 network string to CRE chainSelectorName
/// @param network The network string from payment request (e.g., "base-sepolia", "ethereum-testnet-sepolia")
/// @returns The CRE chainSelectorName and isTestnet flag
/// @dev Maps x402 network formats to CRE's official chainSelectorName format
function getNetworkInfo(network: string): { chainSelectorName: string; isTestnet: boolean } {
  // Mapping from x402 network strings to CRE chainSelectorName format
  // Based on CRE's official supported networks documentation
  const networkMap: Record<string, { chainSelectorName: string; isTestnet: boolean }> = {
    // Mainnets
    'arbitrum': { chainSelectorName: 'ethereum-mainnet-arbitrum-1', isTestnet: false },
    'arbitrum-one': { chainSelectorName: 'ethereum-mainnet-arbitrum-1', isTestnet: false },
    'avalanche': { chainSelectorName: 'avalanche-mainnet', isTestnet: false },
    'base': { chainSelectorName: 'ethereum-mainnet-base-1', isTestnet: false },
    'base-mainnet': { chainSelectorName: 'ethereum-mainnet-base-1', isTestnet: false },
    'bsc': { chainSelectorName: 'binance_smart_chain-mainnet', isTestnet: false },
    'binance-smart-chain': { chainSelectorName: 'binance_smart_chain-mainnet', isTestnet: false },
    'ethereum': { chainSelectorName: 'ethereum-mainnet', isTestnet: false },
    'ethereum-mainnet': { chainSelectorName: 'ethereum-mainnet', isTestnet: false },
    'optimism': { chainSelectorName: 'ethereum-mainnet-optimism-1', isTestnet: false },
    'optimism-mainnet': { chainSelectorName: 'ethereum-mainnet-optimism-1', isTestnet: false },
    'op-mainnet': { chainSelectorName: 'ethereum-mainnet-optimism-1', isTestnet: false },
    'polygon': { chainSelectorName: 'polygon-mainnet', isTestnet: false },
    'polygon-mainnet': { chainSelectorName: 'polygon-mainnet', isTestnet: false },
    
    // Testnets
    'arbitrum-sepolia': { chainSelectorName: 'ethereum-testnet-sepolia-arbitrum-1', isTestnet: true },
    'arbitrum-testnet': { chainSelectorName: 'ethereum-testnet-sepolia-arbitrum-1', isTestnet: true },
    'avalanche-fuji': { chainSelectorName: 'avalanche-testnet-fuji', isTestnet: true },
    'avalanche-testnet': { chainSelectorName: 'avalanche-testnet-fuji', isTestnet: true },
    'base-sepolia': { chainSelectorName: 'ethereum-testnet-sepolia-base-1', isTestnet: true },
    'base-testnet': { chainSelectorName: 'ethereum-testnet-sepolia-base-1', isTestnet: true },
    'bsc-testnet': { chainSelectorName: 'binance_smart_chain-testnet', isTestnet: true },
    'binance-smart-chain-testnet': { chainSelectorName: 'binance_smart_chain-testnet', isTestnet: true },
    'ethereum-sepolia': { chainSelectorName: 'ethereum-testnet-sepolia', isTestnet: true },
    'ethereum-testnet-sepolia': { chainSelectorName: 'ethereum-testnet-sepolia', isTestnet: true },
    'sepolia': { chainSelectorName: 'ethereum-testnet-sepolia', isTestnet: true },
    'optimism-sepolia': { chainSelectorName: 'ethereum-testnet-sepolia-optimism-1', isTestnet: true },
    'optimism-testnet': { chainSelectorName: 'ethereum-testnet-sepolia-optimism-1', isTestnet: true },
    'op-sepolia': { chainSelectorName: 'ethereum-testnet-sepolia-optimism-1', isTestnet: true },
    'polygon-amoy': { chainSelectorName: 'polygon-testnet-amoy', isTestnet: true },
    'polygon-testnet': { chainSelectorName: 'polygon-testnet-amoy', isTestnet: true },
  };
  
  // Normalize network string (lowercase, replace spaces/underscores with hyphens)
  const normalized = network.toLowerCase().replace(/[\s_]/g, '-');
  
  // Check if we have a direct mapping
  if (networkMap[normalized]) {
    return networkMap[normalized];
  }
  
  // Fallback: try to determine from common patterns
  const isTestnet = normalized.includes('testnet') || 
                    normalized.includes('sepolia') || 
                    normalized.includes('goerli') ||
                    normalized.includes('mumbai') ||
                    normalized.includes('fuji') ||
                    normalized.includes('amoy');
  
  // If no direct mapping, try to construct CRE format
  // This is a fallback for networks that might not be in our map
  // Most x402 networks should match CRE format directly
  if (normalized.includes('ethereum-testnet-sepolia') || normalized === 'ethereum-testnet-sepolia') {
    return { chainSelectorName: 'ethereum-testnet-sepolia', isTestnet: true };
  }
  
  // Default: assume the network string matches CRE format
  // Log a warning if we're using fallback
  return {
    chainSelectorName: network, // Use original network string as fallback
    isTestnet,
  };
}


/// @notice Prepares execution data for ERC20 transferWithAuthorization call
/// @param paymentPayload The signed payment payload
/// @param paymentRequirements The payment requirements
/// @returns The execution data: target address, calldata, and value
/// @dev Works with any ERC20 token that supports transferWithAuthorization, not just USDC
function prepareSettlementExecutionData(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements
): { target: `0x${string}`, data: `0x${string}`, value: bigint } {
  // Extract authorization data from EVM payload
  if (!('authorization' in paymentPayload.payload)) {
    throw new Error("Only EVM payloads are supported");
  }

  const auth = paymentPayload.payload.authorization;
  const signature = paymentPayload.payload.signature as Hex;

  // Parse ERC6492 signature if present (returns original signature if not ERC6492)
  // This matches the x402 settle() function pattern
  const { signature: parsedSignature } = parseErc6492Signature(signature);
  
  // Extract v, r, s from the parsed signature
  // Signature format: 65 bytes = r (32 bytes) + s (32 bytes) + v (1 byte)
  const sig = parsedSignature.startsWith('0x') ? parsedSignature.slice(2) : parsedSignature;
  if (sig.length < 130) {
    throw new Error("Invalid signature format: signature must be at least 65 bytes");
  }
  
  const r = `0x${sig.slice(0, 64)}` as `0x${string}`;
  const s = `0x${sig.slice(64, 128)}` as `0x${string}`;
  const v = parseInt(sig.slice(128, 130), 16);

  // Target is the token contract address (any ERC20 token that supports transferWithAuthorization)
  const target = paymentRequirements.asset as `0x${string}`;

  // Encode transferWithAuthorization function call
  // transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)
  // Note: For ERC6492 signatures, the signature is parsed to extract v, r, s
  const data = encodeFunctionData({
    abi: [{
      name: "transferWithAuthorization",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
        { name: "v", type: "uint8" },
        { name: "r", type: "bytes32" },
        { name: "s", type: "bytes32" },
      ],
      outputs: [],
    }],
    functionName: "transferWithAuthorization",
    args: [
      auth.from as `0x${string}`,
      auth.to as `0x${string}`,
      BigInt(auth.value),
      BigInt(auth.validAfter),
      BigInt(auth.validBefore),
      auth.nonce as `0x${string}`,
      v,
      r,
      s,
    ],
  });

  // Value is 0 for token transfers (not sending ETH)
  const value = 0n;

  return { target, data, value };
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
  
  // Create a connected client for verification
  let client: ConnectedClient;
  
  if (SupportedEVMNetworks.includes(paymentRequirements.network)) {
    client = createConnectedClient(paymentRequirements.network);
  } else {
    throw new Error("Invalid network - only EVM networks are currently supported");
  }
  
  // Re-verify to ensure the payment is still valid
  const verifyResponse = await verify(client, paymentPayload, paymentRequirements, x402Config);
  
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
    
    // Validate the request data
    const paymentRequirements = PaymentRequirementsSchema.parse(body.paymentRequirements);
    const paymentPayload = PaymentPayloadSchema.parse(body.paymentPayload);

    runtime.log(`Network: ${paymentRequirements.network}`);

    // Use the correct private key based on the requested network
    let signer: Signer;

    if (SupportedEVMNetworks.includes(paymentRequirements.network)) {
      // Get EVM private key from secrets
      const secret = runtime.getSecret({ id: 'EVM_PRIVATE_KEY' }).result();
      const evmPrivateKey = secret.value || '';
      if (!evmPrivateKey) {
        throw new Error("EVM_PRIVATE_KEY secret is required but not found");
      }
      signer = await createSigner(paymentRequirements.network, evmPrivateKey);

      // Log balances for debugging
      if ('account' in signer && signer.account) {
        const address = signer.account.address;
        runtime.log(`Facilitator address: ${address}`);
        
        // Check if it's an EVM payload (has authorization field)
        if ('authorization' in paymentPayload.payload) {
          const auth = paymentPayload.payload.authorization;
          runtime.log(`Payment from: ${auth.from}`);
          runtime.log(`Payment to: ${auth.to}`);
          runtime.log(`Payment amount: ${auth.value}`);

          // Check ETH balance
          try {
            const ethBalance = await signer.getBalance({ address });
            runtime.log(`Facilitator ETH balance: ${ethBalance.toString()} wei`);

            // Check payer's ETH balance
            const payerEthBalance = await signer.getBalance({ 
              address: auth.from as `0x${string}` 
            });
            runtime.log(`Payer ETH balance: ${payerEthBalance.toString()} wei`);
          } catch (balanceError) {
            runtime.log(`Warning: Could not fetch balances: ${balanceError instanceof Error ? balanceError.message : String(balanceError)}`);
          }
        }
      }
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
    const errorResponse = { error: "Invalid request" };
    if (error instanceof Error) {
      errorResponse.error = `Invalid request: ${error.message}`;
    }
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

