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

## FAQ

### Common Questions

**Q: How do I get a TEST_PROJECT_ID?**
A: Sign up at [cloud.walletconnect.com](https://cloud.walletconnect.com) and create a project.

**Q: Can I use WalletConnect without a project ID?**
A: A project ID is required for testing and some features. Get one from WalletConnect Cloud.

**Q: How do I report bugs?**
A: Open an issue on GitHub with detailed information about the bug.

**Q: How do I contribute?**
A: Fork the repo, create a branch, make changes, and submit a pull request.

**Q: Is WalletConnect free to use?**
A: Yes, WalletConnect is open source and free to use.

**Q: Which chains are supported?**
A: WalletConnect supports multiple chains. Check the documentation for the full list.

**Q: How do I get help?**
A: Join the Discord community or check the documentation.

### Still Have Questions?

- Check the [documentation](https://docs.walletconnect.com)
- Join [Discord](https://discord.gg/walletconnect)
- Open a [GitHub issue](https://github.com/Vaios0x/walletconnect-monorepo/issues)

## License

Apache 2.0
