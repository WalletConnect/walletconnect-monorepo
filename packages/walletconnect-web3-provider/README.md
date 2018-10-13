# WalletConnect Web3 Provider

This implements provider for walletconnect standard.

You can read more about WalletConnect standard here: http://walletconnect.org/

## Example

```js
import Web3 from 'web3'
import WalletConnectProvider from 'walletconnect-web3-provider'

/**
 *  Create WalletConnect Provider
 */
const provider = new WalletConnectProvider({
  bridgeUrl: 'https://test-bridge.walletconnect.org',   // Required
  dappName: 'INSERT_DAPP_NAME',                   // Required
  rpcUrl:'http://localhost:8545'                 // Required
}

/**
 *  Create Web3
 */
const web3 = new Web3(provider)

/**
 *  Initiate WalletConnect Session
 */
const session = await web3.currentProvider.walletconnect.initSession()

/**
 *  Get Accounts
 */
const accounts = await web3.eth.getAccounts()

if (!accounts.length) {
  // Display QR Code URI
  const uri = web3.currentProvider.walletconnect.uri

  // Listen for session status
  await  web3.currentProvider.walletconnect.listenSessionStatus()

  // Get Accounts Again
  accounts = await web3.eth.getAccounts()
}

/**
 * Send Transaction
 */
const txHash = await web3.eth.sendTransaction(tx)

/**
 * Sign Transaction
 */
const signedTx = await web3.eth.signTransaction(tx)

/**
 * Sign Message
 */
const signedMessage = await web3.eth.sign(msg)

/**
 * Sign Typed Data
 */
const signedTypedData = await web3.eth.signTypedData(msg)
```
