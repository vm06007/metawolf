# Generate Real Payment Payloads

This script generates **real signed payment payloads** using your private key from `.env`. These payloads can be used to test the `d-verify` and `d-settlement` workflows.

## Setup

1. **Install dependencies:**
   ```bash
   cd d-verify
   bun install
   ```

2. **Create `.env` file in the project root** (not in d-verify):
   ```bash
   # In the project root directory
   PRIVATE_KEY=0xYourPrivateKeyHere
   ```

3. **Make sure your wallet has USDC** on the testnet you're using (for verification to pass).

## Usage

Run the script:
```bash
cd d-verify
bun run generate-payloads.ts
```

Or using npm/node:
```bash
cd d-verify
npx tsx generate-payloads.ts
```

## Output

The script generates:

1. **Individual network files** in `d-verify/generated-payloads/`:
   - `base-sepolia-verify.json` - Payload for verify endpoint
   - `base-sepolia-settle.json` - Payload for settle endpoint
   - `ethereum-testnet-sepolia-verify.json`
   - `ethereum-testnet-sepolia-settle.json`
   - `arbitrum-sepolia-verify.json`
   - `arbitrum-sepolia-settle.json`

2. **Combined file**: `all-payloads.json` - All payloads in one file

3. **Terminal output**: Prints the base-sepolia verify payload to console

## Configuration

The script uses:
- **Recipient address**: `0xf9711003d9b608e7aa96089cf3bdb510a950705c` (hardcoded)
- **Amount**: 1 USDC (1000000 with 6 decimals)
- **Token**: USDC addresses for each network
- **Sender**: Derived from your `PRIVATE_KEY` in `.env`

## Using the Generated Payloads

### For Verify Workflow

```bash
# Using the generated payload
curl -X POST http://your-cre-verify-endpoint \
  -H "Content-Type: application/json" \
  -d @d-verify/generated-payloads/base-sepolia-verify.json
```

### For Settle Workflow

```bash
# Using the generated payload
curl -X POST http://your-cre-settle-endpoint \
  -H "Content-Type: application/json" \
  -d @d-verify/generated-payloads/base-sepolia-settle.json
```

## Important Notes

1. **Real Signatures**: These payloads contain **real EIP-712 signatures** that will pass verification
2. **Balance Required**: Your wallet must have USDC on the network for verification to succeed
3. **Network Support**: Currently generates for:
   - base-sepolia
   - ethereum-testnet-sepolia
   - arbitrum-sepolia

4. **Token Addresses**: Uses official USDC addresses for each network

## Customization

Edit `generate-payloads.ts` to:
- Change the recipient address
- Change the amount
- Add more networks
- Modify payment requirements

