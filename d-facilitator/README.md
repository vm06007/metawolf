# d-facilitator

A Chainlink CRE (Chainlink Runtime Environment) project implementing x402 payment verification and settlement workflows.

## Architecture

This project uses a **shared code architecture** where common utilities are stored in a central `shared/` folder that both workflows can import from.

```
d-facilitator/
├── shared/                    # Shared utilities (source of truth)
│   ├── verify-payment.ts     # Payment verification logic
│   ├── network.ts            # Network mapping utilities
│   ├── settlement.ts         # Settlement execution data preparation
│   └── package.json          # Shared dependencies
├── d-verify/                 # Payment verification workflow
│   ├── main.ts              # Imports from ../shared/
│   └── package.json         # Workflow-specific dependencies
├── d-settlement/            # Payment settlement workflow
│   ├── main.ts              # Imports from ../shared/
│   └── package.json         # Workflow-specific dependencies
└── contracts/               # Solidity smart contracts
```

### Key Features

- **Single Source of Truth**: All shared code lives in `shared/` folder
- **Reusable Components**: Verification, network mapping, and settlement logic are shared
- **Independent Workflows**: Each workflow (`d-verify`, `d-settlement`) can be deployed independently
- **Type Safety**: Full TypeScript support with proper imports

## Setup

### Prerequisites

- [Bun](https://bun.sh/) installed (see [installation guide](https://bun.sh/docs/installation))
- [CRE CLI](https://github.com/smartcontractkit/cre-cli) installed
- Node.js 18+ (if not using Bun)

### Installation Steps

1. **Install shared dependencies**

   The `shared/` folder has its own `package.json` with dependencies needed for the shared utilities:

   ```bash
   cd shared && bun install
   ```

2. **Install workflow dependencies**

   Each workflow directory has its own dependencies:

   ```bash
   # Install d-verify dependencies
   cd d-verify && bun install

   # Install d-settlement dependencies
   cd d-settlement && bun install
   ```

3. **Configure secrets**

   The `d-settlement` workflow requires the `EVM_PRIVATE_KEY` for signing transactions.

   **For Local Simulation (using .env file):**

   Create a `.env` file in the project root:

   ```bash
   # Option 1: Use EVM_PRIVATE_KEY_ALL (matches secrets.yaml mapping)
   EVM_PRIVATE_KEY_ALL=your_private_key_here

   # Option 2: Use CRE_ETH_PRIVATE_KEY or EVM_PRIVATE_KEY (code fallback)
   CRE_ETH_PRIVATE_KEY=your_private_key_here
   # or
   EVM_PRIVATE_KEY=your_private_key_here
   ```

   The `d-settlement/workflow.yaml` is configured with `secrets-path: ""` for staging, which allows using `.env` files.

   **For Production (using CRE secrets):**

   Set secrets using the CRE CLI:

   ```bash
   # Set EVM_PRIVATE_KEY secret
   cre secret set EVM_PRIVATE_KEY_ALL --value "your_private_key_here"
   ```

   Then update `d-settlement/workflow.yaml` production-settings to use secrets:
   ```yaml
   production-settings:
     workflow-artifacts:
       secrets-path: "../secrets.yaml"  # Use CRE secrets for production
   ```

   The secret name `EVM_PRIVATE_KEY_ALL` is defined in `secrets.yaml` and maps to the secret ID `EVM_PRIVATE_KEY` used in the code.

   **For simulation/testing:**

   Use a dummy key in your `.env` file:
   ```
   EVM_PRIVATE_KEY_ALL=0000000000000000000000000000000000000000000000000000000000000001
   ```

   **Note:** The `d-verify` workflow does not require secrets as it only performs verification (read-only operations).

4. **Update configuration files**

   Update the config files for each workflow:
   - `d-verify/config.staging.json` - Verification workflow config
   - `d-settlement/config.staging.json` - Settlement workflow config

## Running Workflows

### Simulate d-verify Workflow

From the project root:

```bash
cre workflow simulate ./d-verify --target=staging-settings
```

With HTTP payload:

```bash
cre workflow simulate ./d-verify \
  --http-payload d-verify/test-verify-payload.json \
  --non-interactive \
  --trigger-index 0
```

### Simulate d-settlement Workflow

From the project root:

```bash
cre workflow simulate ./d-settlement --target=staging-settings
```

## Project Structure

### Shared Folder (`shared/`)

Contains reusable utilities used by both workflows:

- **`verify-payment.ts`**: Payment verification logic using CRE EVM capabilities
  - Verifies payment payloads against requirements
  - Checks signatures, deadlines, amounts, etc.
  - Returns verification results

- **`network.ts`**: Network mapping utilities
  - Maps x402 network strings to CRE chain selector names
  - Handles mainnet/testnet detection

- **`settlement.ts`**: Settlement execution data preparation
  - Prepares ERC20 `transferWithAuthorization` call data
  - Handles ERC6492 signature parsing

### Workflow Directories

Each workflow directory contains:

- **`main.ts`**: Workflow entry point that imports from `../shared/`
- **`package.json`**: Workflow-specific dependencies
- **`config.staging.json`**: Staging environment configuration
- **`config.production.json`**: Production environment configuration
- **`workflow.yaml`**: CRE workflow configuration

## Development

### Adding New Shared Utilities

1. Create new file in `shared/` folder
2. Export functions/types from the file
3. Import in workflows using: `import { ... } from "../shared/filename"`

### Updating Shared Code

When you modify files in `shared/`:
- Changes are immediately available to all workflows
- No need to copy files or run sync scripts
- Just recompile the workflows

### Import Pattern

All workflows import from the shared folder using relative paths:

```typescript
// In d-verify/main.ts or d-settlement/main.ts
import { verifyPayment } from "../shared/verify-payment";
import { getNetworkInfo } from "../shared/network";
import { prepareSettlementExecutionData } from "../shared/settlement";
```

## Verification Checks

The payment verification implementation in `shared/verify-payment.ts` performs the following checks, matching the x402 protocol reference implementation:

### Implemented Checks ✅

1. **Protocol version verification** - Validates scheme and x402Version compatibility
2. **USDC address validation** - Verifies token address matches expected USDC address for the chain (prevents malicious token contracts)
3. **Token contract name/version retrieval** - Gets token name and version from paymentRequirements.extra or USDC config
4. **Permit signature validation** - Verifies EIP-712 signature is recoverable for the owner address
5. **Recipient validation** - Ensures payment recipient matches paymentRequirements.payTo
6. **Deadline validation** - Checks validBefore >= now + 6 seconds and validAfter <= now
7. **Nonce validation** - Verifies authorization nonce has not been used (prevents replay attacks)
8. **Balance checks** - Verifies payer has sufficient ERC20 token balance (>= maxAmountRequired)
9. **Amount validation** - Ensures payment value >= maxAmountRequired

### Limitations & TODOs

- **Smart wallet deployment check** - Detected but skipped due to CRE limitations (requires read operations not yet supported)
- **Native token support** - Not supported (x402 typically uses ERC20 tokens)
- **Minimum amount threshold** - Not implemented (x402 TODO mentions checking if amount is above threshold to cover gas costs)
- **Resource payment tracking** - Not implemented (x402 TODO mentions verifying resource is not already paid for - marked as "next version")

### Security Notes

- All EVM read operations use CRE's `callContract` capability
- Token address validation prevents using malicious or incorrect token contracts
- Nonce validation prevents replay attacks
- Balance checks ensure sufficient funds before payment

## Dependencies

### Shared Dependencies (`shared/package.json`)

- `@chainlink/cre-sdk`: CRE SDK for runtime capabilities
- `x402`: x402 payment protocol types and utilities
- `viem`: Ethereum library for encoding/decoding

### Workflow Dependencies

Each workflow may have additional dependencies specific to its needs. Check individual `package.json` files for details.

## Troubleshooting

### Compilation Errors

If you see "Could not resolve" errors:

1. Ensure `shared/` has dependencies installed:
   ```bash
   cd shared && bun install
   ```

2. Ensure workflow has dependencies installed:
   ```bash
   cd d-verify && bun install  # or d-settlement
   ```

### Import Errors

If imports fail:
- Verify you're using relative paths: `../shared/filename`
- Check that the file exists in `shared/` folder
- Ensure TypeScript can resolve the path (check `tsconfig.json`)

## Additional Resources

- [CRE Documentation](https://docs.chain.link/cre)
- [x402 Protocol](https://github.com/thirdweb-dev/x402)
- [Chainlink CRE Examples](https://github.com/smartcontractkit/cre-examples)

