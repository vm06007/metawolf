# Subscription Middleware Usage Examples

## Overview

The subscription middleware supports three modes:
1. **Normal mode**: Verify + Settle + Route Handler (default)
2. **Verify-only mode**: Only verify payment, return immediately
3. **Settle-only mode**: Only settle payment (assumes already verified)

## Multiple Routes

You can define multiple routes with different subscription requirements:

```typescript
import express from 'express';
import { subscriptionMiddleware } from './index';

const app = express();

// Multiple routes with different subscription tiers
app.use(subscriptionMiddleware(
  '0x123...', // payTo address
  {
    // Premium tier - $20/month
    '/api/premium/*': {
      price: '$20',
      network: 'base-sepolia',
      billingPeriod: 'monthly',
      maxRequestsPerPeriod: 1000,
      description: 'Premium API access'
    },
    // Basic tier - $5/month
    '/api/basic/*': {
      price: '$5',
      network: 'base-sepolia',
      billingPeriod: 'monthly',
      maxRequestsPerPeriod: 100,
      description: 'Basic API access'
    },
    // Free tier - $0.01 per request
    '/api/free/*': {
      price: '$0.01',
      network: 'base-sepolia',
      description: 'Pay-per-request access'
    }
  }
));

app.get('/api/premium/data', (req, res) => {
  res.json({ data: 'premium content' });
});

app.get('/api/basic/data', (req, res) => {
  res.json({ data: 'basic content' });
});
```

## Verify-Only Mode

Use verify-only mode when you want to check if a payment is valid without settling:

```typescript
// Verify-only middleware - only checks payment validity
app.use('/api/verify', subscriptionMiddleware(
  '0x123...',
  {
    '/api/verify': {
      price: '$10',
      network: 'base-sepolia',
      billingPeriod: 'monthly'
    }
  },
  undefined, // facilitator config
  undefined, // paywall config
  { verifyOnly: true } // Options
));
```

### cURL Example - Verify Only

```bash
# Verify payment without settling
curl -X GET http://localhost:3000/api/verify \
  -H "X-PAYMENT: <your-payment-header>" \
  -H "Accept: application/json"

# Response:
# {
#   "x402Version": 1,
#   "verified": true,
#   "payer": "0x...",
#   "message": "Payment verified successfully"
# }
```

## Settle-Only Mode

Use settle-only mode when payment has already been verified and you just need to settle:

```typescript
// Settle-only middleware - assumes payment already verified
app.use('/api/settle', subscriptionMiddleware(
  '0x123...',
  {
    '/api/settle': {
      price: '$10',
      network: 'base-sepolia',
      billingPeriod: 'monthly'
    }
  },
  undefined,
  undefined,
  { 
    settleOnly: true,
    skipVerification: true // Skip verification if already done
  }
));
```

### cURL Example - Settle Only

```bash
# Settle payment (assumes already verified)
curl -X POST http://localhost:3000/api/settle \
  -H "X-PAYMENT: <your-payment-header>" \
  -H "Accept: application/json"

# Response:
# {
#   "x402Version": 1,
#   "settled": true,
#   "transaction": "0x...",
#   "network": "base-sepolia",
#   "payer": "0x..."
# }
```

## Normal Mode (Verify + Settle)

Default mode - verifies payment, executes route handler, then settles:

```typescript
// Normal mode - verify, execute route, then settle
app.use(subscriptionMiddleware(
  '0x123...',
  {
    '/api/data': {
      price: '$10',
      network: 'base-sepolia',
      billingPeriod: 'monthly'
    }
  }
));

app.get('/api/data', (req, res) => {
  res.json({ data: 'protected content' });
});
```

### cURL Example - Normal Mode

```bash
# Normal request - verify, execute, settle
curl -X GET http://localhost:3000/api/data \
  -H "X-PAYMENT: <your-payment-header>" \
  -H "Accept: application/json"

# Response: Your route handler's response
# Headers: X-PAYMENT-RESPONSE: <settlement-header>
```

## Separate Verify and Settle Endpoints

You can create separate endpoints for verify and settle:

```typescript
// Verify endpoint
app.use('/api/verify', subscriptionMiddleware(
  '0x123...',
  {
    '/api/verify': {
      price: '$10',
      network: 'base-sepolia',
      billingPeriod: 'monthly'
    }
  },
  undefined,
  undefined,
  { verifyOnly: true }
));

// Settle endpoint (separate route)
app.use('/api/settle', subscriptionMiddleware(
  '0x123...',
  {
    '/api/settle': {
      price: '$10',
      network: 'base-sepolia',
      billingPeriod: 'monthly'
    }
  },
  undefined,
  undefined,
  { 
    settleOnly: true,
    skipVerification: true
  }
));

// Protected endpoint (normal mode)
app.use('/api/protected', subscriptionMiddleware(
  '0x123...',
  {
    '/api/protected': {
      price: '$10',
      network: 'base-sepolia',
      billingPeriod: 'monthly'
    }
  }
));
```

### Workflow Example

```bash
# Step 1: Verify payment
curl -X GET http://localhost:3000/api/verify \
  -H "X-PAYMENT: <payment-header>"

# Step 2: Use protected endpoint (normal mode)
curl -X GET http://localhost:3000/api/protected \
  -H "X-PAYMENT: <payment-header>"

# Step 3: Or settle separately
curl -X POST http://localhost:3000/api/settle \
  -H "X-PAYMENT: <payment-header>"
```

## Getting Payment Requirements (No Payment Header)

When no `X-PAYMENT` header is provided, the middleware returns payment requirements:

```bash
# Get payment requirements
curl -X GET http://localhost:3000/api/data \
  -H "Accept: application/json"

# Response:
# {
#   "x402Version": 1,
#   "error": "X-PAYMENT header is required for subscription access",
#   "accepts": [
#     {
#       "scheme": "exact",
#       "network": "base-sepolia",
#       "maxAmountRequired": "10000000",
#       "resource": "http://localhost:3000/api/data",
#       "description": "Subscription: monthly",
#       "payTo": "0x123...",
#       "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
#       ...
#     }
#   ]
# }
```

## Error Handling

All modes return appropriate error responses:

```bash
# Invalid payment header
curl -X GET http://localhost:3000/api/data \
  -H "X-PAYMENT: invalid"

# Response:
# {
#   "x402Version": 1,
#   "error": "Invalid or malformed payment header",
#   "accepts": [...]
# }

# Payment verification failed
# Response:
# {
#   "x402Version": 1,
#   "error": "Payment verification failed reason",
#   "accepts": [...],
#   "payer": "0x..."
# }
```

