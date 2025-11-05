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

### Check Process

The `check` command runs a comprehensive validation:

1. **Lint**: Checks code quality and style
2. **Build**: Compiles all packages
3. **Test**: Runs the test suite

### Setting Up TEST_PROJECT_ID

To get your TEST_PROJECT_ID:

1. Visit [WalletConnect Cloud](https://cloud.walletconnect.com)
2. Create a new project
3. Copy your Project ID
4. Use it in the command: `TEST_PROJECT_ID=your_project_id npm run check`

### Running Individual Checks

You can also run checks individually:

```bash
# Run only linting
npm run lint

# Run only build
npm run build

# Run only tests
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
