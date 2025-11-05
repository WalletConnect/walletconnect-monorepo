# WalletConnect v2.x.x

Open protocol for connecting Wallets to Dapps - https://walletconnect.com

## Setup

1. Ensure [nodejs](https://nodejs.org) and [npm](https://www.npmjs.com)
2. Clone the repository
3. Install all package dependencies, by running `npm install` from the root folder

### Prerequisites

Before starting, make sure you have:

- **Node.js**: Version 16.x or higher recommended
- **npm**: Version 8.x or higher
- **Git**: Latest version for cloning the repository

### Installation Steps

For a smooth setup experience:

1. **Clone the repository**: `git clone https://github.com/Vaios0x/walletconnect-monorepo.git`
2. **Navigate to the directory**: `cd walletconnect-monorepo`
3. **Install dependencies**: `npm install`
4. **Verify installation**: Check that all packages are installed correctly

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

### Command Details

Each command serves a specific purpose in the development workflow:

- **clean**: Use this when you need to remove all build artifacts and start fresh
- **lint**: Ensures code quality and consistency across all packages
- **prettier**: Formats code according to project standards
- **build**: Compiles all packages for production use
- **test**: Runs the test suite to verify functionality
- **check**: Quick way to validate code before committing
- **reset**: Complete reset when you need to start from scratch

### Usage Examples

```bash
# Run linting on all packages
npm run lint

# Build all packages
npm run build

# Run tests (requires TEST_PROJECT_ID)
TEST_PROJECT_ID=your_id npm run test

# Complete check before committing
TEST_PROJECT_ID=your_id npm run check
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
