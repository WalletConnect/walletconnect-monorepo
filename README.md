# WalletConnect v2.x.x

Open protocol for connecting Wallets to Dapps - https://walletconnect.com

## Monorepo Structure

This repository uses a monorepo structure managed by Lerna:

### Directory Structure

```
walletconnect-monorepo/
├── packages/          # Core packages
│   ├── core/         # Core WalletConnect functionality
│   ├── sign-client/  # Sign client implementation
│   ├── web3wallet/   # Web3 wallet integration
│   ├── types/        # TypeScript definitions
│   └── utils/        # Utility functions
├── providers/        # Provider implementations
│   ├── ethereum-provider/
│   ├── universal-provider/
│   └── signer-connection/
├── scripts/          # Build and utility scripts
└── package.json      # Root package configuration
```

### Package Management

- **Lerna**: Monorepo management
- **npm workspaces**: Dependency management
- **Shared configs**: Common TypeScript and ESLint configs

### Adding New Packages

To add a new package:

1. Create directory in `packages/` or `providers/`
2. Add `package.json` with proper configuration
3. Update root `package.json` if needed
4. Run `npm install` to link dependencies

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
