# WalletConnect v2.x.x

Open protocol for connecting Wallets to Dapps - https://walletconnect.com

## Setup

### Prerequisites

1. **Node.js**: Version 18.x or higher (check with `node --version`)
2. **npm**: Version 9.x or higher (check with `npm --version`)
3. **Build tools**: 
   - Windows: Install [windows-build-tools](https://www.npmjs.com/package/windows-build-tools)
   - macOS: Install Xcode Command Line Tools: `xcode-select --install`
   - Linux: Install build-essential: `sudo apt-get install build-essential`

### Installation Steps

1. Clone the repository:
   ```sh
   git clone https://github.com/walletconnect/walletconnect-monorepo.git
   cd walletconnect-monorepo
   ```

2. Install global dependencies:
   ```sh
   npm i -g node-gyp
   ```

3. Install all package dependencies:
   ```sh
   npm install
   ```

4. Set up test environment (optional but recommended):
   - Get your project ID from [WalletConnect Cloud](https://cloud.walletconnect.com)
   - Export it: `export TEST_PROJECT_ID=your_project_id`
   - Or create a `.env` file: `echo "TEST_PROJECT_ID=your_project_id" > .env`

### Platform-Specific Notes

#### Windows
- Use Git Bash or WSL2 for running scripts
- Install Windows Build Tools for native modules
- May need Visual Studio Build Tools

#### macOS
- Ensure Xcode Command Line Tools are installed
- If issues occur, reset: `sudo xcode-select --reset`

#### Linux
- Install build-essential package
- May need Python 3.x for node-gyp

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
