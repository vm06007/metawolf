#!/bin/bash
# Deployment script that loads environment variables from .env file
# Usage: ./deploy.sh [network] [chain_name]
# Example: ./deploy.sh eth_sepolia ethereum-testnet-sepolia

set -e

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check if ALCHEMY_API_KEY is set
if [ -z "$ALCHEMY_API_KEY" ]; then
    echo "Error: ALCHEMY_API_KEY not set. Please add it to .env file or export it."
    exit 1
fi

# Check if PRIVATE_KEY is set
if [ -z "$PRIVATE_KEY" ]; then
    echo "Error: PRIVATE_KEY not set. Please add it to .env file or export it."
    exit 1
fi

# Network selection
NETWORK=${1:-eth_sepolia}
CHAIN_NAME=${2:-ethereum-testnet-sepolia}

# Map network to RPC URL
case $NETWORK in
    eth_sepolia)
        RPC_URL="https://eth-sepolia.g.alchemy.com/v2/$ALCHEMY_API_KEY"
        ;;
    eth_mainnet)
        RPC_URL="https://eth-mainnet.g.alchemy.com/v2/$ALCHEMY_API_KEY"
        ;;
    base_sepolia)
        RPC_URL="https://base-sepolia.g.alchemy.com/v2/$ALCHEMY_API_KEY"
        ;;
    *)
        echo "Error: Unknown network. Use: eth_sepolia, eth_mainnet, or base_sepolia"
        exit 1
        ;;
esac

# Set IS_SIMULATION based on network
if [ "$NETWORK" = "eth_mainnet" ]; then
    export IS_SIMULATION=false
else
    export IS_SIMULATION=true
fi

export CHAIN_NAME=$CHAIN_NAME

echo "Deploying to: $NETWORK"
echo "Chain Name: $CHAIN_NAME"
echo "RPC URL: $RPC_URL"
echo "Is Simulation: $IS_SIMULATION"
echo ""

# Run deployment with slow mode for more accurate gas estimates
# --slow: More accurate gas estimation (slower but more precise)
# --gas-limit: Optional override if estimates are too high (uncomment and set if needed)
forge script script/Deploy.s.sol:Deploy \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" \
    --slow \
    --broadcast \
    "$@"
    # --gas-limit 5000000 \  # Uncomment and adjust if needed for Base Sepolia

