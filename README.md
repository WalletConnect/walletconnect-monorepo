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

## Testing Guide

### Running Tests

To run tests, you need a TEST_PROJECT_ID:

```bash
TEST_PROJECT_ID=your_project_id npm run test
```

### Test Structure

Tests are organized by package:

- Each package has its own `test` directory
- Tests use Vitest as the test runner
- Test files follow the `.spec.ts` naming convention

### Writing Tests

When writing new tests:

1. Create test files in the package's `test` directory
2. Use descriptive test names
3. Follow the existing test patterns
4. Ensure good test coverage

### Test Commands

```bash
# Run all tests
TEST_PROJECT_ID=your_id npm run test

# Run tests for a specific package
cd packages/core && npm test

# Run tests in watch mode
TEST_PROJECT_ID=your_id npm run test -- --watch
```

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
