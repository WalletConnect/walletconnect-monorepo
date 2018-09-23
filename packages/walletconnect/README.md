# WalletConnect

Library to connect Dapps to mobile wallets using WalletConnect

You can read more about WalletConnect standard here: http://walletconnect.org/

### Install package

```bash
yarn add walletconnect

# OR

npm install --save walletconnect
```

### Getting Started

```js
import WalletConnect from 'walletconnect'

/**
 *  Create a webConnector
 */
const webConnector = new WalletConnect(
  {
    bridgeUrl: 'https://bridge.walletconnect.org',  // Required
    dappName: 'INSERT_DAPP_NAME',                   // Required
  }
)

/**
 *  Create a new session
 */
const session = await webConnector.initSession()

if (session.new) {
  const { uri } = session; // Display QR code with URI string

  const sessionStatus = await webConnector.listenSessionStatus() // Listen to session status

  const { accounts } = sessionStatus // Get wallet accounts
} else {
  const { accounts } = session // Get wallet accounts
}

/**
 *  Draft transaction
 */
const tx = {from: '0xab12...1cd', to: '0x0', nonce: 1, gas: 100000, value: 0, data: '0x0'}

/**
 *  Send transaction
 */
try {
  // Submitted Transaction
  const transactionHash = await webConnector.sendTransaction(tx)
} catch (error) {
  // Rejected Transaction
  console.error(error)
}

/**
 *  Draft message
 */
const msg = 'My name is John Doe'

/**
 *  Sign message
 */
try {
  // Signed message
  const transactionHash = await webConnector.sendTransaction(msg)
} catch (error) {
  // Rejected signing
  console.error(error)
}
```
