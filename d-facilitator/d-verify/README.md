# d-verify Workflow

Payment verification workflow for x402 protocol using Chainlink CRE.

This workflow verifies payment payloads against payment requirements using CRE EVM capabilities.

## Setup

**Important**: This project uses a shared code architecture. See the [main README](../README.md) for complete setup instructions.

### Quick Setup

1. **Install shared dependencies** (from project root):
   ```bash
   cd ../shared && bun install
   ```

2. **Install workflow dependencies**:
   ```bash
   cd d-verify && bun install
   ```

3. **Configure environment**:
   Create `.env` file with:
   ```
   CRE_ETH_PRIVATE_KEY=your_private_key_here
   ```

4. **Update configuration**:
   Edit `config.staging.json` with your settings.

## Running

### Simulate from Project Root

```bash
cre workflow simulate ./d-verify --target=staging-settings
```

### Simulate with HTTP Payload

```bash
cre workflow simulate ./d-verify \
  --http-payload d-verify/test-verify-payload.json \
  --non-interactive \
  --trigger-index 0
```

## Architecture

This workflow imports shared utilities from `../shared/`:
- `verify-payment.ts`: Payment verification logic
- `network.ts`: Network mapping utilities

See [main README](../README.md) for architecture details.
