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

## Simple WalletConnect Example (Beginner)

This example shows how to connect a wallet using **WalletConnect v2** and log the connected Ethereum address in a basic JavaScript app.

### Install Dependencies

```bash
npm install @walletconnect/sign-client @walletconnect/modal ethers
```
### Example Code

```js
import SignClient from '@walletconnect/sign-client'
import { WalletConnectModal } from '@walletconnect/modal'
import { ethers } from 'ethers'

// 1. Get your Project ID from WalletConnect Cloud and paste it here
const projectId = 'YOUR_REAL_PROJECT_ID_HERE' 

const modal = new WalletConnectModal({
  projectId,
  themeMode: 'dark'
})

async function connectWallet() {
  try {
    // Initialization
    const client = await SignClient.init({
      projectId,
      metadata: {
        name: 'WalletConnect Demo',
        description: 'Beginner WalletConnect v2 Example',
        url: 'https://example.com',
        icons: ['https://walletconnect.com/walletconnect-logo.png']
      }
    })

    // Request connection
    const { uri, approval } = await client.connect({
      requiredNamespaces: {
        eip155: {
          methods: ['eth_sendTransaction', 'eth_sign', 'personal_sign', 'eth_signTypedData'],
          chains: ['eip155:1'], // Mainnet
          events: ['chainChanged', 'accountsChanged']
        }
      }
    })

    // Open modal
    if (uri) {
      modal.openModal({ uri })
      
      // Wait for user approval
      const session = await approval()
      
      // Close modal once connected
      modal.closeModal()

      // 2. Get address from session
      // Extracting address from format "eip155:1:0xAddress..."
      const account = session.namespaces.eip155.accounts[0].split(':')[2] 
      console.log('Connected Address:', account)
    }
  } catch (error) {
    // Catch error if user closes modal or rejects connection
    console.error('Connection failed or rejected:', error)
    modal.closeModal() 
  }
}

connectWallet()
```

## License

Apache 2.0
