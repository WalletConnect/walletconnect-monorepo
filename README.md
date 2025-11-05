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

## Development Guide

### Development Workflow

When developing on the WalletConnect monorepo:

1. **Install dependencies**: `npm install`
2. **Make changes**: Edit files in the appropriate package
3. **Run checks**: `TEST_PROJECT_ID=your_id npm run check`
4. **Test locally**: Verify your changes work as expected
5. **Submit PR**: Create a pull request with your changes

### Package Structure

The monorepo is organized into several packages:

- **core**: Core WalletConnect functionality
- **sign-client**: Sign client implementation
- **web3wallet**: Web3 wallet integration
- **types**: TypeScript type definitions
- **utils**: Utility functions and helpers
- **providers**: Provider implementations

### Testing

Always run tests before submitting:

```bash
TEST_PROJECT_ID=your_id npm run test
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
