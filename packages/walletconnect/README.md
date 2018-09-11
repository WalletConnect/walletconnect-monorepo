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

 const accounts = sessionStatus.data // Get wallet accounts
} else {
 const { accounts } = session // Get wallet accounts
}

/**
*  Draft transaction
*/
const tx = {from: '0xab12...1cd', to: '0x0', nonce: 1, gas: 100000, value: 0, data: '0x0'}

/**
 *  Create transaction
 */
const transactionId = await webConnector.createTransaction(tx)

/**
 *  Listen to transaction status
 */
 /**
  *  Listen to transaction status
  */
 const transactionStatus = await webConnector.listenTransactionStatus(transactionId)

 if (transactionStatus.success) {
   const { txHash } = transactionStatus // Get transaction hash
 }
```
