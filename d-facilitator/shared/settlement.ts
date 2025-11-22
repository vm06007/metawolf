import { encodeAbiParameters, parseAbiParameters, encodeFunctionData, parseErc6492Signature, type Hex, type Address } from "viem";
import type { PaymentPayload, PaymentRequirements } from "x402/types";

/// @notice Prepares execution data for ERC20 transferWithAuthorization call
/// @param paymentPayload The signed payment payload
/// @param paymentRequirements The payment requirements
/// @returns The execution data: target address, calldata, and value
/// @dev Works with any ERC20 token that supports transferWithAuthorization, not just USDC
export function prepareSettlementExecutionData(
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
  
  if (sig.length !== 130) {
    throw new Error(`Invalid signature length: expected 130 hex chars (65 bytes), got ${sig.length}`);
  }

  const r = `0x${sig.slice(0, 64)}` as Hex;
  const s = `0x${sig.slice(64, 128)}` as Hex;
  const v = parseInt(sig.slice(128, 130), 16);

  // Encode the function call data for transferWithAuthorization
  // Function signature: transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)
  const functionAbi = parseAbiParameters([
    "address from",
    "address to", 
    "uint256 value",
    "uint256 validAfter",
    "uint256 validBefore",
    "bytes32 nonce",
    "uint8 v",
    "bytes32 r",
    "bytes32 s"
  ]);

  const data = encodeFunctionData({
    abi: [{
      type: "function",
      name: "transferWithAuthorization",
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
      stateMutability: "nonpayable",
    }],
    functionName: "transferWithAuthorization",
    args: [
      auth.from as Address,
      auth.to as Address,
      BigInt(auth.value),
      BigInt(auth.validAfter),
      BigInt(auth.validBefore),
      auth.nonce as Hex,
      v,
      r,
      s,
    ],
  });

  // Target is the ERC20 token contract address
  const target = paymentRequirements.asset as `0x${string}`;

  // No ETH value is sent (ERC20 transfer)
  const value = 0n;

  return { target, data, value };
}

