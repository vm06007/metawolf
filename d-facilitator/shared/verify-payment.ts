import { cre,
  type Runtime, 
  getNetwork,
  encodeCallMsg,
  bytesToHex,
  LAST_FINALIZED_BLOCK_NUMBER,
} from "@chainlink/cre-sdk";
import {
  type PaymentRequirements,
  type PaymentPayload,
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
  zeroAddress,
  encodeFunctionData,
  decodeFunctionResult,
  parseAbi,
} from "viem";

import { getNetworkInfo } from "./network";

export type VerifyPaymentResult = {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
  errorMessage?: string;
};

/// @notice Verifies a payment payload against the required payment details using CRE EVM capabilities
/// @param runtime The CRE runtime (for logging)
/// @param paymentPayload The signed payment payload containing transfer parameters and signature
/// @param paymentRequirements The payment requirements that the payload must satisfy
/// @param x402Config Optional x402 configuration
/// @returns Verification response indicating if the payment is valid and any invalidation reason
/// 
/// This function performs all verification checks using CRE EVM capabilities:
/// 1. Protocol version verification (scheme and x402Version)
/// 2. Smart wallet deployment check (if signature length > 130) - skipped (CRE limitation)
/// 3. USDC address validation (verifies token address matches expected USDC for the chain)
/// 4. Token contract name/version retrieval (from paymentRequirements.extra or USDC config)
/// 5. Permit signature validation (recoverable for owner, verified against the token contract)
/// 6. Recipient validation (to === paymentRequirements.payTo)
/// 7. Deadline validation (validBefore >= now + 6 seconds, validAfter <= now)
/// 8. Nonce validation (checks if authorization nonce has been used - prevents replay attacks)
/// 9. Balance checks (ERC20 token balance via CRE callContract) - native tokens not supported
/// 10. Amount validation (value >= maxAmountRequired)
export async function verifyPayment(
  runtime: Runtime<any>,
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  x402Config?: X402Config
): Promise<VerifyPaymentResult> {
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

    // Get network info once at the beginning (used for multiple checks)
    const networkInfo = getNetworkInfo(paymentRequirements.network);
    runtime.log(`Network mapping: "${paymentRequirements.network}" -> chainSelectorName="${networkInfo.chainSelectorName}", isTestnet=${networkInfo.isTestnet}`);
    
    // Get CRE network - getNetwork() looks up networks by chainSelectorName
    // Note: The network must be available in CRE SDK and ideally configured in project.yaml
    const creNetwork = getNetwork({
      chainFamily: "evm",
      chainSelectorName: networkInfo.chainSelectorName,
      isTestnet: networkInfo.isTestnet,
    });

    if (!creNetwork) {
      runtime.log(`ERROR: Failed to get CRE network`);
      runtime.log(`  Input network: "${paymentRequirements.network}"`);
      runtime.log(`  Mapped to chainSelectorName: "${networkInfo.chainSelectorName}"`);
      runtime.log(`  isTestnet: ${networkInfo.isTestnet}`);
      runtime.log(`  chainFamily: "evm"`);
      runtime.log(`NOTE: The network must be configured in project.yaml with an RPC endpoint`);
      runtime.log(`NOTE: Check that the chainSelectorName matches CRE SDK's expected format`);
      return {
        isValid: false,
        invalidReason: "invalid_network",
        payer: payerAddress,
        errorMessage: `Network not found: ${networkInfo.chainSelectorName} (from "${paymentRequirements.network}"). Ensure it's configured in project.yaml.`,
      };
    }

    runtime.log(`✓ CRE Network found`);
    runtime.log(`  Name: ${creNetwork.name || 'N/A'}`);
    runtime.log(`  Chain Selector: ${creNetwork.chainSelector.selector}`);
    runtime.log(`  Chain Family: ${creNetwork.chainType || 'evm'}`);

    // 1. Check if smart wallet (signature length > 130)
    const signatureLength = signature.startsWith("0x") ? signature.length - 2 : signature.length;
    const isSmartWallet = signatureLength > 130;
    
    if (isSmartWallet) {
      runtime.log("Detected smart wallet signature, checking deployment...");
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

    const chainId = getNetworkId(paymentRequirements.network);
    const erc20Address = paymentRequirements.asset as Address;

    // 4. Get token name and version
    // TODO: CRE EVMClient doesn't support read operations yet
    // When CRE adds read support, use: evmClient.read(runtime, { address, data })
    // Original logic: name = paymentRequirements.extra?.name ?? config[chainId.toString()].usdcName
    //                 version = paymentRequirements.extra?.version ?? await getVersion(client)
    // For now, try to use fallback to USDC config if available
    let name: string;
    let version: string;
    
    try {
      // Try to get name from extra, fallback to USDC config (matches original logic)
      // Original: name = paymentRequirements.extra?.name ?? config[chainId.toString()].usdcName
      const usdcConfig = getUsdcChainConfigForChain(chainId);
      
      // 3. Verify USDC address is correct for the chain (security check)
      // This prevents using a malicious or incorrect token contract
      if (usdcConfig?.usdcAddress) {
        const expectedUsdcAddress = getAddress(usdcConfig.usdcAddress as Address);
        const providedTokenAddress = getAddress(erc20Address);
        
        if (expectedUsdcAddress !== providedTokenAddress) {
          runtime.log(`Token address mismatch: expected ${expectedUsdcAddress}, got ${providedTokenAddress}`);
          return {
            isValid: false,
            invalidReason: "invalid_exact_evm_payload_token_address_mismatch",
            payer: payerAddress,
            errorMessage: `Token address ${providedTokenAddress} does not match expected USDC address ${expectedUsdcAddress} for chain ${chainId}`,
          };
        }
        runtime.log(`✓ Token address verified: ${providedTokenAddress} matches expected USDC address for chain ${chainId}`);
      } else {
        runtime.log(`WARNING: USDC config not found for chain ${chainId} - skipping address validation`);
      }
      
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

    // 9. Verify nonce has not been used (check authorizationState on-chain)
    // Note: This check prevents replay attacks by ensuring the nonce hasn't been consumed
    // ERC20 tokens with transferWithAuthorization typically store: authorizationState[nonce] = true when used
    if (creNetwork) {
      try {
        runtime.log(`Checking if nonce has been used...`);
        const evmClient = new cre.capabilities.EVMClient(creNetwork.chainSelector.selector);

        // Define authorizationState ABI (common in USDC and similar tokens)
        const authorizationStateAbi = parseAbi([
          "function authorizationState(address owner, bytes32 nonce) view returns (bool)"
        ]);

        // Encode the function call
        const nonceCheckData = encodeFunctionData({
          abi: authorizationStateAbi,
          functionName: "authorizationState",
          args: [payerAddress, exactEvmPayload.authorization.nonce as Hex],
        });

        // Call the contract
        const nonceCheckCall = evmClient
          .callContract(runtime, {
            call: encodeCallMsg({
              from: zeroAddress,
              to: tokenAddress,
              data: nonceCheckData,
            }),
            blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
          })
          .result();

        // Decode the result
        const nonceUsed = decodeFunctionResult({
          abi: authorizationStateAbi,
          functionName: "authorizationState",
          data: bytesToHex(nonceCheckCall.data),
        }) as boolean;

        if (nonceUsed) {
          runtime.log(`Nonce has already been used`);
          return {
            isValid: false,
            invalidReason: "invalid_exact_evm_payload_nonce_already_used",
            payer: payerAddress,
            errorMessage: "Authorization nonce has already been used",
          };
        }
        runtime.log(`✓ Nonce check passed: nonce has not been used`);
      } catch (error) {
        // If authorizationState function doesn't exist or call fails, log warning but continue
        // Some tokens may use different nonce tracking mechanisms
        runtime.log(`WARNING: Nonce check failed: ${error instanceof Error ? error.message : String(error)}`);
        runtime.log(`Continuing verification - nonce check skipped`);
      }
    }

    // 10. Check ERC20 token balance
    runtime.log("Checking payer ERC20 balance...");
    const tokenAddress = paymentRequirements.asset as Address;
    const requiredAmount = BigInt(paymentRequirements.maxAmountRequired);
    
    // Validate that token address is not zero (native tokens not supported)
    if (tokenAddress === zeroAddress || tokenAddress.toLowerCase() === "0x0000000000000000000000000000000000000000") {
      return {
        isValid: false,
        invalidReason: "invalid_asset",
        payer: payerAddress,
        errorMessage: "Native token payments are not supported. Only ERC20 tokens are supported.",
      };
    }
    
    let balance: bigint;
    
    // Use the creNetwork already retrieved at the beginning
    if (!creNetwork) {
      runtime.log(`ERROR: CRE network not available for balance check`);
      return {
        isValid: false,
        invalidReason: "invalid_network",
        payer: payerAddress,
        errorMessage: "Network not available for balance check",
      };
    }
    
    try {
      runtime.log(`Checking ERC20 balance for token: ${tokenAddress}`);
      // Create EVM client using the already retrieved network
      const evmClient = new cre.capabilities.EVMClient(creNetwork.chainSelector.selector);

      // Define ERC20 balanceOf ABI
      const erc20Abi = parseAbi([
        "function balanceOf(address owner) view returns (uint256)"
      ]);

      // Encode the function call
      const callData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [payerAddress],
      });

      // Call the contract
      const contractCall = evmClient
        .callContract(runtime, {
          call: encodeCallMsg({
            from: zeroAddress,
            to: tokenAddress,
            data: callData,
          }),
          blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
        })
        .result();

      // Decode the result
      const decodedResult = decodeFunctionResult({
        abi: erc20Abi,
        functionName: "balanceOf",
        data: bytesToHex(contractCall.data),
      });

      balance = decodedResult as bigint;
      runtime.log(`Payer ERC20 balance: ${balance.toString()}, Required: ${requiredAmount.toString()}`);
    } catch (error) {
      runtime.log(`Balance check error: ${error instanceof Error ? error.message : String(error)}`);
      return {
        isValid: false,
        invalidReason: "balance_check_failed",
        payer: payerAddress,
        errorMessage: `Failed to check balance: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    // Verify balance is sufficient (balance >= requiredAmount)
    if (balance < requiredAmount) {
      return {
        isValid: false,
        invalidReason: "insufficient_funds",
        payer: payerAddress,
        errorMessage: `Insufficient balance: ${balance.toString()} < ${requiredAmount.toString()}`,
      };
    }
    
    runtime.log(`✓ Balance check passed: ${balance.toString()} >= ${requiredAmount.toString()}`);

    // 11. Verify amount >= maxAmountRequired
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

