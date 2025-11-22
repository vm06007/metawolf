# d-settlement Workflow

Payment settlement workflow for x402 protocol using Chainlink CRE.

This workflow settles verified payments by executing ERC20 token transfers on-chain using CRE's onchain write capabilities.

## Setup

**Important**: This project uses a shared code architecture. See the [main README](../README.md) for complete setup instructions.

### Quick Setup

1. **Install shared dependencies** (from project root):
   ```bash
   cd ../shared && bun install
   ```

2. **Install workflow dependencies**:
   ```bash
   cd d-settlement && bun install
   ```

3. **Configure environment**:
   Create `.env` file with:
   ```
   CRE_ETH_PRIVATE_KEY=your_private_key_here
   ```

4. **Update configuration**:
   Edit `config.staging.json` with your settings:
   - `settlementReceiverAddress`: Your SettlementReceiver contract address
   - `executionProxyAddress`: Your ExecutionProxy contract address
   - `chainSelectorName`: CRE chain selector name
   - `isTestnet`: true/false

## Running

### Simulate from Project Root

```bash
cre workflow simulate ./d-settlement --target=staging-settings
```

## Architecture

This workflow imports shared utilities from `../shared/`:
- `verify-payment.ts`: Payment verification logic (for re-verification)
- `network.ts`: Network mapping utilities
- `settlement.ts`: Settlement execution data preparation

See [main README](../README.md) for architecture details.
