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

## Troubleshooting

1. If you are experiencing issues with installation ensure you install `npm i -g node-gyp`
2. You will need to have xcode command line tools installed
3. If there are issues with xcode command line tools try running

```zsh
sudo xcode-select --switch /Library/Developer/CommandLineTools
sudo xcode-select --reset
```

## Development Workflow

### Typical Development Cycle

1. **Create a branch**: `git checkout -b feature/my-feature`
2. **Make changes**: Edit code in the appropriate package
3. **Run checks**: `TEST_PROJECT_ID=your_id npm run check`
4. **Commit changes**: `git commit -m "description"`
5. **Push branch**: `git push origin feature/my-feature`
6. **Create PR**: Open a pull request on GitHub

### Before Committing

Always run these checks:

```bash
# Run linting
npm run lint

# Run prettier
npm run prettier

# Run tests
TEST_PROJECT_ID=your_id npm run test
```

### Git Workflow

- Use descriptive commit messages
- Keep commits focused and atomic
- Rebase before pushing if needed
- Follow conventional commit format

## License

Apache 2.0
