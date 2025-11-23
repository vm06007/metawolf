# X402 Payment Protocol Client

This implementation provides a clean client for handling HTTP 402 Payment Required flows with wallet signing.

## What is X402?

X402 is a protocol that uses HTTP 402 (Payment Required) status codes to enable micropayments for API access. When you request a protected resource:

1. Server responds with `402 Payment Required` and payment requirements
2. Client signs a payment authorization with their wallet
3. Client re-requests with `X-PAYMENT` header containing signed authorization
4. Server validates payment and returns the resource

## Usage

### Basic GET Request with Auto-Payment

```typescript
import { X402Client } from './services/x402-client';

// This handles the complete flow automatically
const response = await X402Client.payAndGet(
    'https://api.example.com/protected-resource',
    account  // Your wallet account
);

if (response.success) {
    console.log('Resource:', response.data);
} else {
    console.error('Error:', response.error);
}
```

### Manual Flow (Step by Step)

```typescript
import { X402Client } from './services/x402-client';

// Step 1: Get payment requirements
const initialResponse = await X402Client.get('https://api.example.com/protected');

if (initialResponse.paymentRequired) {
    const paymentRequirements = initialResponse.paymentRequirements;

    // Step 2: Create payment signature (via background script)
    const paymentResponse = await chrome.runtime.sendMessage({
        type: 'CREATE_X402_PAYMENT',
        address: account.address,
        paymentRequirements: paymentRequirements,
    });

    // Step 3: Submit payment
    const paidResponse = await X402Client.getWithPayment(
        'https://api.example.com/protected',
        paymentResponse.encodedPayment
    );

    console.log('Resource:', paidResponse.data);
}
```

## Payment Requirements Format

When you receive a 402 response, the payment requirements look like:

```json
{
    "scheme": "exact",
    "network": "base-sepolia",
    "maxAmountRequired": "10000000",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "payTo": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "resource": "https://api.example.com/protected",
    "description": "Subscription: monthly",
    "mimeType": "application/json",
    "maxTimeoutSeconds": 60,
    "extra": {
        "name": "USD Coin",
        "version": "2"
    }
}
```

## Payment Payload Format

The signed payment authorization includes:

```typescript
{
    "scheme": "exact",
    "x402Version": 1,
    "payload": {
        "authorization": {
            "from": "0x...",
            "to": "0x...",
            "value": "10000000",
            "validAfter": 1234567890,
            "validBefore": 1234567999,
            "nonce": "0x..."
        },
        "signature": "0x..."
    }
}
```

## How Wallet Signing Works

1. **Payment Requirements** contain the token contract address, amount, and recipient
2. **Background Script** creates an EIP-712 typed data signature:
   - Type: `TransferWithAuthorization` (USDC standard)
   - Message includes: from, to, value, validAfter, validBefore, nonce
   - Domain includes: token name, version, chainId, verifyingContract
3. **Wallet Signs** using hardware chip (HaLo) or private key
4. **Signature Sent** via `X-PAYMENT` header to the server
5. **Server Verifies**:
   - Signature is valid
   - Payer has sufficient balance
   - Nonce hasn't been used
   - Amount matches requirements
6. **Server Returns** the protected resource

## Security Features

- **Private keys never leave wallet**: Signing happens in background script
- **EIP-712 typed data**: Structured, readable signatures
- **Nonce prevents replay attacks**: Each authorization is single-use
- **Time-bounded validity**: `validAfter` and `validBefore` timestamps
- **On-chain verification**: Server can verify balance and nonce state

## Supported Networks

Currently supports EVM networks:
- Ethereum Mainnet
- Base
- Base Sepolia
- Arbitrum
- Optimism
- Polygon
- And more...

## Error Handling

The X402Client returns a consistent response format:

```typescript
interface X402Response {
    success: boolean;
    status: number;
    paymentRequired?: boolean;
    paymentRequirements?: PaymentRequirements;
    data?: any;
    error?: string;
}
```

Always check `response.success` before using the data.

## Integration with Subscriptions

Example: Bankless Podcast subscription

```typescript
// User clicks "Subscribe to Bankless"
const response = await X402Client.get('https://api.bankless.com/verify');

if (response.paymentRequired) {
    // Show payment modal to user
    showPaymentModal(response.paymentRequirements);

    // User confirms, sign and pay
    const payment = await createX402Payment(account, response.paymentRequirements);
    const verified = await X402Client.getWithPayment(
        'https://api.bankless.com/verify',
        payment
    );

    if (verified.success) {
        // Subscription active!
        console.log('Subscribed successfully!');
    }
}
```

## Background Script Integration

The X402Client relies on the background script for secure signing:

```typescript
// In background/index.ts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'CREATE_X402_PAYMENT') {
        const { address, paymentRequirements } = request;

        // Create EIP-712 signature using private key (secure)
        const payment = await createEIP712Payment(address, paymentRequirements);

        sendResponse({
            success: true,
            encodedPayment: JSON.stringify(payment)
        });
    }
});
```

## References

- X402 Protocol: https://github.com/district-labs/x402
- EIP-712: https://eips.ethereum.org/EIPS/eip-712
- USDC TransferWithAuthorization: https://docs.circle.com/stablecoins/docs/transfer-with-authorization
