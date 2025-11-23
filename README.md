# Wolfy Wallet

A modern browser extension wallet with advanced features including EIP-7702, EIP-5792 support, hardware wallet integration (Arx HaLo chip and Firefly), and multisig wallet capabilities.

## Features

### Core Wallet Features
- **Multiple Account Types**
  - Create new accounts with seed phrases
  - Import private keys
  - Hardware wallet integration (Arx HaLo chip, Firefly)
  - Multisig wallets (2-of-3 chip signatures)
  - Watch-only addresses (view-only, cannot sign)

### Advanced EIP Support
- **EIP-7702**: Set EOA code delegation for smart contract functionality
- **EIP-5792**: Atomic batched transactions (wallet_getCapabilities)
- **EIP-1193**: Standard Ethereum provider interface

### Hardware Wallet Integration
- **Arx HaLo Chip**: NFC-enabled hardware wallet support
- **Firefly Wallet**: Bluetooth hardware wallet integration

### Multisig Wallets
- Deploy multisig smart contracts on multiple chains
- Configure threshold signatures (e.g., 2-of-3)
- Support for multiple chip signers
- Factory contract deployment system

### Gas Station
- Configurable gas station for sponsored transactions
- Multi-chain support

### Network Support
- Ethereum Mainnet
- Sepolia Testnet
- Polygon
- Base
- Arbitrum
- Optimism
- Avalanche
- BSC
- Zircuit Mainnet
- And more...

## Smart Contracts

### Delegator on Zircuit

The EIP-7702 Delegator contract is deployed on Zircuit Mainnet:

- **Zircuit Mainnet (Chain 48900)**: [`0xFDcEdae8367942f22813AB078aA3569fabDe943F`](https://explorer.zircuit.com/address/0xFDcEdae8367942f22813AB078aA3569fabDe943F)

### Multisig Factory

The project includes Solidity contracts for deploying multisig wallets:

- `MultisigFactory.sol`: Factory contract for deploying multisig wallets
- `MultisigWallet.sol`: Multisig wallet implementation

#### Deployed Factory Contracts

Multisig factory contracts are deployed on the following networks:

- **Ethereum Mainnet (Chain 1)**: [`0xfF25B865d75583FB77102De88901Bf9c1C51B6C0`](https://etherscan.io/address/0xfF25B865d75583FB77102De88901Bf9c1C51B6C0)
- **Zircuit Mainnet (Chain 48900)**: [`0xAB869b003948c09F6b869B35545E9D535df36e12`](https://explorer.zircuit.com/address/0xAB869b003948c09F6b869B35545E9D535df36e12)

Deploy scripts are available in `scripts/`:
```bash
bun run scripts/deploy-multisig-factory.ts
bun run scripts/verify-multisig-factory.ts
```

## Project Structure

```
metawolf/
├── src/
│   ├── background/          # Service worker (background script)
│   │   ├── handlers/        # Message handlers
│   │   └── index.ts
│   ├── content/             # Content scripts
│   ├── core/                # Core wallet logic
│   │   ├── wallet.ts        # Main wallet class
│   │   ├── types.ts         # TypeScript interfaces
│   │   ├── multisig-config.ts
│   │   └── gas-station.ts
│   ├── eips/                # EIP implementations
│   │   ├── eip7702.ts       # EIP-7702 delegation
│   │   └── eip5742.ts       # Batch transactions
│   ├── firefly/             # Firefly wallet adapter
│   ├── halo/                # HaLo chip integration
│   ├── popup/               # Extension popup UI
│   │   ├── components/      # React components
│   │   ├── services/        # Business logic services
│   │   └── modules/         # Feature modules
│   ├── notification/        # Notification window UI
│   ├── contracts/           # Solidity smart contracts
│   │   ├── MultisigFactory.sol
│   │   └── MultisigWallet.sol
│   └── inpage.ts            # Injected provider script
├── wolfy-frontend/          # Next.js frontend application
├── dist/                    # Build output
├── icons/                   # Extension icons
└── scripts/                 # Build and deployment scripts
```

## Prerequisites

- **Bun** (v1.0+): This project uses Bun as the package manager and runtime
- **Node.js** (v18+): Required for some build tools
- **Chrome/Chromium-based browser**: For extension development

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd metawolf
```

2. Install dependencies:
```bash
bun install
```

3. Install frontend dependencies (if working on frontend):
```bash
cd wolfy-frontend
bun install
cd ..
```

## Development

### Build the Extension

Build all components:
```bash
bun run build
```

Build with watch mode (auto-rebuild on changes):
```bash
bun run dev
```

Individual build commands:
```bash
bun run build:background    # Build background service worker
bun run build:content        # Build content scripts
bun run build:popup          # Build popup UI
bun run build:notification   # Build notification window
bun run build:inpage         # Build injected provider
bun run build:assets         # Copy assets and icons
```

### Load Extension in Browser

1. Build the extension: `bun run build`
2. Open Chrome/Edge and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist/` directory

### Frontend Development

The `wolfy-frontend/` directory contains a Next.js application:

```bash
cd wolfy-frontend
bun run dev      # Start development server
bun run build    # Build for production
bun run start    # Start production server
```

## Architecture

### Extension Components

- **Background Service Worker**: Handles wallet state, message routing, and transaction processing
- **Content Scripts**: Inject provider into web pages
- **Popup UI**: Main wallet interface (React-based)
- **Notification Window**: Transaction and signature approval UI
- **Inpage Script**: EIP-1193 provider injected into web pages

### Message Flow

1. Web page requests wallet connection via `window.ethereum`
2. Content script forwards request to background service worker
3. Background worker checks wallet state and permissions
4. User approves/rejects in popup or notification window
5. Response sent back through the chain

### Account Types

- **Chip Account**: Direct account from HaLo chip (hardware wallet)
- **Firefly Account**: Account from Firefly hardware wallet
- **Multisig Account**: Smart contract wallet requiring multiple signatures
- **Standard Account**: Software wallet (seed phrase or private key)
- **Watch-Only Account**: View-only address (cannot sign)

## Configuration

### Gas Station

Configure gas station settings in `src/core/gas-station-config.ts`. The config is generated during build via `scripts/generate-gas-station-config.js`.

### Multisig Factory Addresses

Configure factory contract addresses per chain in `src/core/multisig-config.ts`.

### Networks

Default networks are defined in `src/core/wallet.ts`. Networks are automatically merged with stored state on load.

## Issue Tracking

This project uses **bd (beads)** for issue tracking. See `AGENTS.md` for details on how to use it.

**Quick commands:**
```bash
bd ready --json              # Check for ready work
bd create "Issue" -p 1       # Create new issue
bd update bd-42 --status in_progress  # Claim issue
bd close bd-42 --reason "Done"  # Complete issue
```

## Technologies

- **TypeScript**: Type-safe development
- **React**: UI framework for popup and notification windows
- **Ethers.js**: Ethereum library
- **Viem**: Additional Ethereum utilities
- **Bun**: Package manager and build tool
- **esbuild**: Fast bundler for extension code
- **Next.js**: Frontend framework (wolfy-frontend)
- **Tailwind CSS**: Styling (frontend)

## Security Considerations

- Private keys are encrypted in storage
- Hardware wallets never expose private keys
- Multisig wallets require multiple signatures
- All transactions require explicit user approval
- Content Security Policy (CSP) enforced

## Contributing

1. Check for ready work: `bd ready --json`
2. Claim an issue: `bd update <id> --status in_progress`
3. Create a feature branch
4. Make your changes
5. Test thoroughly
6. Commit changes (including `.beads/issues.jsonl` if issue state changed)
7. Submit a pull request

## Support

For issues and questions, please use the project's issue tracker (via `bd`).

## Acknowledgments

- Built with support for EIP-7702 and EIP-5792 standards
- Hardware wallet integrations: Arx HaLo and Firefly
- Inspired by modern wallet UX patterns

