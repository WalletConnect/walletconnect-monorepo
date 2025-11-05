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

## Building Guide

### Build Process

The build process compiles all TypeScript packages:

```bash
# Build all packages
npm run build

# Build output
# - Each package's build output goes to its dist/ directory
# - Source maps are generated for debugging
# - Type definitions are included
```

### Build Commands

- **`npm run build`**: Builds all packages in the monorepo
- **`npm run clean`**: Removes all build folders
- **`npm run reset`**: Cleans and rebuilds everything

### Building Individual Packages

To build a specific package:

```bash
cd packages/core
npm run build
```

### Build Configuration

Each package has its own build configuration:

- **Rollup**: Used for bundling
- **TypeScript**: Compiles to JavaScript
- **Source Maps**: Generated for debugging

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
