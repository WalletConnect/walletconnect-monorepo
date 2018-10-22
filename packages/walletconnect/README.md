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
    bridgeUrl: 'https://test-bridge.walletconnect.org',  // Required
    dappName: 'INSERT_DAPP_NAME',                   // Required
  }
)

/**
 *  Initiate WalletConnect session
 */
await webConnector.initSession()

/**
 *  Check if connection is already established
 */
if (webConnector.isConnected) {
  // If yes, get accounts
  const accounts = webConnector.accounts
} else {
  // If not, prompt the user to scan the QR code
  const uri = webConnector.uri;

  // Listen for session confirmation from wallet
  await webConnector.listenSessionStatus()

  // Get accounts after session status is resolved
  accounts = webConnector.accounts  
}

/**
 *  Draft transaction
 */
const tx = {from: '0xab12...1cd', to: '0x0', nonce: 1, gas: 100000, value: 0, data: '0x0'}

/**
 *  Send transaction
 */
try {
  // Submitted Transaction Hash
  const result = await webConnector.sendTransaction(tx)
} catch (error) {
  // Rejected Transaction
  console.error(error)
}

/**
 *  Draft message
 */
const msg = 'My email is john@doe.com - 1537836206101'

/**
 *  Sign message
 */
try {
  // Signed message
  const result = await webConnector.signMessage(msg)
} catch (error) {
  // Rejected signing
  console.error(error)
}

/**
 *  Draft Typed Data
 */
const msgParams = [
  {
    type: 'string',
    name: 'Message',
    value: 'My email is john@doe.com'
  },
  {
    type: 'uint32',
    name: 'A number',
    value: '1537836206101'
  }
]

/**
 *  Sign Typed Data
 */
try {
  // Signed typed data
  const result = await webConnector.signTypedData(msgParams)
} catch (error) {
  // Rejected signing
  console.error(error)
}
```
