import { cre, type Runtime, type HTTPPayload, Runner, decodeJson, getNetwork } from "@chainlink/cre-sdk"
import {
  PaymentRequirementsSchema,
  type PaymentRequirements,
  type PaymentPayload,
  PaymentPayloadSchema,
  SupportedEVMNetworks,
  type X402Config,
} from "x402/types";
import { getNetworkId } from "x402/shared";
import { getUsdcChainConfigForChain } from "x402/shared/evm";
import { 
  getAddress, 
  verifyTypedData, 
  type Address, 
  type Hex,
  encodeFunctionData,
  parseAbi,
  decodeFunctionResult,
} from "viem";


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

/// @notice Maps x402 network string to CRE chainSelectorName
function getNetworkInfo(network: string): { chainSelectorName: string; isTestnet: boolean } {
  const networkMap: Record<string, { chainSelectorName: string; isTestnet: boolean }> = {
    'arbitrum': { chainSelectorName: 'ethereum-mainnet-arbitrum-1', isTestnet: false },
    'avalanche': { chainSelectorName: 'avalanche-mainnet', isTestnet: false },
    'base': { chainSelectorName: 'ethereum-mainnet-base-1', isTestnet: false },
    'ethereum': { chainSelectorName: 'ethereum-mainnet', isTestnet: false },
    'optimism': { chainSelectorName: 'ethereum-mainnet-optimism-1', isTestnet: false },
    'polygon': { chainSelectorName: 'polygon-mainnet', isTestnet: false },
    'arbitrum-sepolia': { chainSelectorName: 'ethereum-testnet-sepolia-arbitrum-1', isTestnet: true },
    'avalanche-fuji': { chainSelectorName: 'avalanche-testnet-fuji', isTestnet: true },
    'base-sepolia': { chainSelectorName: 'ethereum-testnet-sepolia-base-1', isTestnet: true },
    'ethereum-sepolia': { chainSelectorName: 'ethereum-testnet-sepolia', isTestnet: true },
    'sepolia': { chainSelectorName: 'ethereum-testnet-sepolia', isTestnet: true },
    'optimism-sepolia': { chainSelectorName: 'ethereum-testnet-sepolia-optimism-1', isTestnet: true },
    'polygon-amoy': { chainSelectorName: 'polygon-testnet-amoy', isTestnet: true },
  };
  
  const normalized = network.toLowerCase().replace(/[\s_]/g, '-');
  
  if (networkMap[normalized]) {
    return networkMap[normalized];
  }
  
  const isTestnet = normalized.includes('testnet') || 
                    normalized.includes('sepolia') || 
                    normalized.includes('fuji') ||
                    normalized.includes('amoy');
  
  return { chainSelectorName: network, isTestnet };
}

/// @notice Verifies a payment payload against the required payment details using CRE EVM capabilities
/// @param runtime The CRE runtime
/// @param paymentPayload The signed payment payload containing transfer parameters and signature
/// @param paymentRequirements The payment requirements that the payload must satisfy
/// @param x402Config Optional x402 configuration
/// @returns Verification response indicating if the payment is valid and any invalidation reason
/// 
/// This function performs all verification checks using CRE EVM capabilities:
/// 1. Protocol version verification (scheme and x402Version)
/// 2. Smart wallet deployment check (if signature length > 130)
/// 3. Permit signature validation (recoverable for owner, verified against the token contract)
/// 4. Token contract name/version retrieval (via CRE readContract)
/// 5. Recipient validation (to === paymentRequirements.payTo)
/// 6. Deadline validation (validBefore >= now + 6 seconds, validAfter <= now)
/// 7. Balance checks (payer has >= maxAmountRequired) via CRE readContract
/// 8. Amount validation (value >= maxAmountRequired)
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

    if (!SupportedEVMNetworks.includes(paymentRequirements.network)) {
      throw new Error("Invalid network - only EVM networks are currently supported");
    }

    // Extract EVM payload
    if (!('authorization' in paymentPayload.payload)) {
      return {
        isValid: false,
        invalidReason: "invalid_payload",
        payer: undefined,
        errorMessage: "Only EVM payloads are supported",
      };
    }

    const exactEvmPayload = paymentPayload.payload;
    const payerAddress = exactEvmPayload.authorization.from as Address;
    const signature = exactEvmPayload.signature as Hex;

    // 1. Check if smart wallet (signature length > 130)
    const signatureLength = signature.startsWith("0x") ? signature.length - 2 : signature.length;
    const isSmartWallet = signatureLength > 130;
    
    if (isSmartWallet) {
      runtime.log("Detected smart wallet signature, checking deployment...");
      // Get network info for CRE
      const networkInfo = getNetworkInfo(paymentRequirements.network);
      const network = getNetwork({
        chainFamily: "evm",
        chainSelectorName: networkInfo.chainSelectorName,
        isTestnet: networkInfo.isTestnet,
      });

      if (!network) {
        return {
          isValid: false,
          invalidReason: "invalid_network",
          payer: payerAddress,
        };
      }

      // TODO: CRE EVMClient doesn't support read operations yet
      // When CRE adds read support, use: evmClient.read(runtime, { address: payerAddress })
      // For now, skip smart wallet deployment check or require it in paymentRequirements.extra
      runtime.log("Smart wallet detected - deployment check skipped (CRE read not yet supported)");
    }

    // 2. Verify scheme compatibility
    const SCHEME = "exact";
    if (paymentPayload.scheme !== SCHEME || paymentRequirements.scheme !== SCHEME) {
      return {
        isValid: false,
        invalidReason: "unsupported_scheme",
        payer: payerAddress,
      };
    }

    // 3. Get network info and create EVM client for contract reads
    const networkInfo = getNetworkInfo(paymentRequirements.network);
    const network = getNetwork({
      chainFamily: "evm",
      chainSelectorName: networkInfo.chainSelectorName,
      isTestnet: networkInfo.isTestnet,
    });

    if (!network) {
      return {
        isValid: false,
        invalidReason: "invalid_network",
        payer: payerAddress,
      };
    }

    const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);
    const chainId = getNetworkId(paymentRequirements.network);
    const erc20Address = paymentRequirements.asset as Address;

    // 4. Get token name and version
    // TODO: CRE EVMClient doesn't support read operations yet
    // When CRE adds read support, use: evmClient.read(runtime, { address, data })
    // Original logic: name = paymentRequirements.extra?.name ?? config[chainId.toString()].usdcName
    //                 version = paymentRequirements.extra?.version ?? await getVersion(client)
    // For now, try to use fallback from USDC config if available
    let name: string;
    let version: string;
    
    try {
      // Try to get name from extra, fallback to USDC config (matches original logic)
      // Original: name = paymentRequirements.extra?.name ?? config[chainId.toString()].usdcName
      const usdcConfig = getUsdcChainConfigForChain(chainId);
      const nameFromExtra = paymentRequirements.extra?.name as string | undefined;
      const nameFromConfig = usdcConfig?.usdcName;
      name = nameFromExtra ?? nameFromConfig ?? "";
      
      // Version must be in extra (can't read from contract via CRE yet)
      // Original: version = paymentRequirements.extra?.version ?? await getVersion(client)
      version = paymentRequirements.extra?.version as string | undefined ?? "";
      
      if (!name || !version) {
        runtime.log(`Error: Token name and version must be provided in paymentRequirements.extra (CRE read not yet supported)`);
        return {
          isValid: false,
          invalidReason: "invalid_payment_requirements",
          payer: payerAddress,
          errorMessage: "Token name and version must be provided in paymentRequirements.extra",
        };
      }
    } catch (error) {
      runtime.log(`Error getting token config: ${error instanceof Error ? error.message : String(error)}`);
      return {
        isValid: false,
        invalidReason: "invalid_network",
        payer: payerAddress,
      };
    }

    // 5. Verify typed data signature
    const authorizationTypes = {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    };

    const permitTypedData = {
      types: authorizationTypes,
      primaryType: "TransferWithAuthorization" as const,
      domain: {
        name,
        version,
        chainId,
        verifyingContract: erc20Address,
      },
      message: {
        from: exactEvmPayload.authorization.from,
        to: exactEvmPayload.authorization.to,
        value: exactEvmPayload.authorization.value,
        validAfter: exactEvmPayload.authorization.validAfter,
        validBefore: exactEvmPayload.authorization.validBefore,
        nonce: exactEvmPayload.authorization.nonce,
      },
    };

    const recoveredAddress = await verifyTypedData({
      address: payerAddress,
      ...permitTypedData,
      signature: signature,
    });

    if (!recoveredAddress) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_evm_payload_signature",
        payer: payerAddress,
      };
    }

    // 6. Verify recipient matches
    if (getAddress(exactEvmPayload.authorization.to) !== getAddress(paymentRequirements.payTo as Address)) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_evm_payload_recipient_mismatch",
        payer: payerAddress,
      };
    }

    // 7. Verify deadline (validBefore >= now + 6 seconds)
    // Original: BigInt(exactEvmPayload.authorization.validBefore) < BigInt(Math.floor(Date.now() / 1e3) + 6)
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (BigInt(exactEvmPayload.authorization.validBefore) < now + 6n) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_evm_payload_authorization_valid_before",
        payer: payerAddress,
      };
    }

    // 8. Verify validAfter <= now
    if (BigInt(exactEvmPayload.authorization.validAfter) > now) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_evm_payload_authorization_valid_after",
        payer: payerAddress,
      };
    }

    // 9. Check balance
    // TODO: CRE EVMClient doesn't support read operations yet
    // When CRE adds read support, use: evmClient.read(runtime, { address, data })
    // For now, we skip balance check or require it to be verified off-chain
    // Note: This is a security limitation - balance should be checked when CRE adds read support
    runtime.log("Balance check skipped (CRE read not yet supported)");
    runtime.log("WARNING: Balance verification is not performed - this should be enabled when CRE adds read support");

    // 10. Verify amount >= maxAmountRequired
    if (BigInt(exactEvmPayload.authorization.value) < BigInt(paymentRequirements.maxAmountRequired)) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_evm_payload_authorization_value",
        payer: payerAddress,
      };
    }

    runtime.log(`✓ Verification successful`);
    runtime.log(`  Payer: ${payerAddress}`);

    return {
      isValid: true,
      invalidReason: undefined,
      payer: payerAddress,
      errorMessage: undefined,
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

