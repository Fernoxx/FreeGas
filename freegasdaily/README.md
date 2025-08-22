# FreeGasDaily - CELO Faucet Contract

A smart contract that allows users to claim 0.2 CELO once every 24 hours. Perfect for providing gas money to users on the CELO network.

## Contract Address

**Mainnet CELO**: `0x73Ce62F638A4De74B92307DfEC4837a4E6c6e3eE`

## Features

- **Daily Claims**: Users can claim 0.2 CELO once every 24 hours
- **Pause Mechanism**: Owner can pause/unpause claims in case of emergencies
- **Configurable Amount**: Owner can adjust the claim amount
- **Events**: All actions emit events for easy tracking
- **Gas Efficient**: Optimized for minimal gas usage

## Project Structure

```
freegasdaily/
├── contracts/          # Solidity smart contracts
├── scripts/           # Deployment and interaction scripts
├── test/              # Contract test suite
├── frontend/          # Web interface for claiming
├── hardhat.config.js  # Hardhat configuration
├── package.json       # Dependencies
└── .env.example       # Environment variables template
```

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- MetaMask or another Web3 wallet
- CELO tokens for deployment and testing

## Installation

1. Clone the repository and install dependencies:

```bash
cd freegasdaily
npm install
```

2. Copy the environment file and add your configuration:

```bash
cp .env.example .env
```

3. Edit `.env` with your values:
   - `PRIVATE_KEY`: Your wallet's private key (for deployment)
   - `CELOSCAN_API_KEY`: For contract verification on Celoscan

## Contract Deployment

### Compile the contract:

```bash
npm run compile
```

### Run tests:

```bash
npm test
```

### Deploy to networks:

```bash
# Deploy to local Hardhat network
npm run deploy:local

# Deploy to Alfajores testnet
npm run deploy:alfajores

# Deploy to CELO mainnet
npm run deploy:celo
```

## Frontend Usage

The frontend provides a simple interface for users to claim their daily CELO:

1. Open `frontend/index.html` in a web browser
2. Connect your MetaMask wallet
3. Switch to CELO network (the app will prompt if needed)
4. Click "Claim CELO" when available
5. Approve the transaction in your wallet

### Features:
- Auto-connects to previously connected wallets
- Shows countdown timer until next claim
- Displays contract balance
- Network switching support
- Mobile responsive design

## Contract Interaction Scripts

### Check claim status and interact with contract:

```bash
npx hardhat run scripts/interact.js --network celo
```

This script will:
- Show contract information
- Check your claim status
- Attempt to claim if eligible
- Display owner functions (if you're the owner)

## Contract Methods

### Public Functions

- `claim()`: Claim your daily 0.2 CELO allocation
- `lastClaim(address)`: Check when an address last claimed
- `claimAmount()`: View current claim amount
- `paused()`: Check if contract is paused
- `owner()`: View contract owner

### Owner Functions

- `setPaused(bool)`: Pause/unpause the contract
- `setClaimAmount(uint256)`: Change the claim amount
- `transferOwnership(address)`: Transfer contract ownership

## Security Considerations

1. **Private Keys**: Never commit your private key to version control
2. **Contract Balance**: Ensure the contract has sufficient CELO balance
3. **Claim Limits**: The 24-hour limit prevents abuse
4. **Owner Rights**: Only the owner can pause or modify the contract

## Gas Costs

- **Claiming**: ~50,000 - 70,000 gas
- **First claim**: Slightly higher due to storage initialization

## Funding the Contract

Send CELO directly to the contract address to fund it. The contract has a `receive()` function that accepts CELO transfers.

## Troubleshooting

### "Already claimed today"
Wait 24 hours from your last claim before trying again.

### "Insufficient contract balance"
The contract needs more CELO. Contact the owner or send CELO to the contract.

### "Contract paused"
The owner has temporarily paused claims. Check back later.

### Network Issues
Ensure you're connected to the CELO network (Chain ID: 42220).

## License

MIT License - see LICENSE file for details

## Support

For issues or questions:
1. Check existing issues on GitHub
2. Join the CELO Discord community
3. Contact the contract owner

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request with tests

---

**Note**: This is a faucet contract intended to help users get started on CELO. Please use responsibly.