# WalletConnect v2.x.x

Open protocol for connecting Wallets to Dapps - https://walletconnect.com

## Setup

1. Ensure [nodejs](https://nodejs.org) and [npm](https://www.npmjs.com)
2. Clone the repository
3. Install all package dependencies, by running `npm install` from the root folder

## Running checks for all packages

To ensure all packages lint, build and test correctly, we can run the following command from the root folder:

> **For tests to pass in the following command, you will need your own `TEST_PROJECT_ID` value**,
> which will be generated for you when you set up a new project on [WalletConnect Cloud](https://cloud.walletconnect.com).

```zsh
TEST_PROJECT_ID=YOUR_PROJECT_ID npm run check
```

## Command Overview

- `clean` - Removes build folders from all packages
- `lint` - Runs [eslint](https://eslint.org/) checks
- `prettier` - Runs [prettier](https://prettier.io/) checks
- `build` - Builds all packages
- `test` - Tests all packages
- `check` - Shorthand to run lint, build and test commands
- `reset` - Shorthand to run clean and check commands

## Development Workflow

1. **Install dependencies**: `npm install`
2. **Set up environment**: Export `TEST_PROJECT_ID` from WalletConnect Cloud
3. **Run checks**: `TEST_PROJECT_ID=your_id npm run check`
4. **Work on a package**: Navigate to the package directory and make changes
5. **Test locally**: Run `npm run test` in the package directory
6. **Build**: Run `npm run build` to verify compilation
7. **Submit PR**: Ensure all checks pass before submitting

## Package Structure

- `packages/core` - Core WalletConnect functionality
- `packages/sign-client` - Sign client implementation
- `packages/types` - TypeScript type definitions
- `packages/utils` - Utility functions
- `packages/web3wallet` - Web3Wallet implementation
- `packages/react-native-compat` - React Native compatibility
- `providers/ethereum-provider` - Ethereum provider
- `providers/universal-provider` - Universal provider
- `providers/signer-connection` - Signer connection provider

## Troubleshooting

1. If you are experiencing issues with installation ensure you install `npm i -g node-gyp`
2. You will need to have xcode command line tools installed
3. If there are issues with xcode command line tools try running

```zsh
sudo xcode-select --switch /Library/Developer/CommandLineTools
sudo xcode-select --reset
```

## License

Apache 2.0
