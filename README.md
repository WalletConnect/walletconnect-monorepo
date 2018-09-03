# WalletConnect

[![Build Status](https://travis-ci.org/WalletConnect/walletconnect-monorepo.svg?branch=master)](https://travis-ci.org/WalletConnect/walletconnect-monorepo)

Monorepo for WalletConnect Javascript Libraries
This repository contains core libraries, browser SDK, react-native SDK and web3-provider for WalletConnect standard.
For more information, check out https://walletconnect.org

### Index

1. [For Dapps (Browser SDK)](#for-dapps-browser-sdk)
2. [For Wallets (React-Native SDK)](#for-wallets-react-native-sdk)
3. [Development workflow](#development-workflow)


### For Dapps (Browser SDK)

1. Setup

```bash
yarn add walletconnect

# OR

npm install --save walletconnect
```

2. Implementation

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

console.log(session) // prints { sessionId, sharedKey, qrcode }

/**
 *  Listen to session status
 */
webConnector.listenSessionStatus((err, result) => {
  console.log(result) // check result
})

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
webConnector.listenTransactionStatus(transactionId, (err, result) => {
  console.log(result) // check result
})
```

### For Wallets (React-Native SDK)

1.  Setup

```bash
/**
 *  Install NPM Package
 */

yarn add rn-walletconnect-wallet

# OR

npm install --save rn-walletconnect-wallet

/**
 *  Nodify 'crypto' package for cryptography
 */

# install "crypto" shims and run package-specific hacks
rn-nodeify --install "crypto" --hack
```

2. Implementation

```js
import RNWalletConnect from 'rn-walletconnect-wallet'


/**
 *  Scan QR code URI to init WalletConnect
 */
onQRCodeScan(string => {
  // save qrcode string
})


/**
 *  Create WalletConnector
 */
const walletConnector = new RNWalletConnect(string)

/**
 *  Send session data
 */
walletConnector.sendSessionStatus({
  fcmToken: '12354...3adc',
  pushEndpoint: 'https://push.walletconnect.org/notification/new',  
  data: {
    accounts: [
      '0x4292...931B3',
      '0xa4a7...784E8',
      ...
    ]
  }
})

/**
 *  Handle push notification events & Get transaction data
 */
FCM.on(FCMEvent.Notification, event => {
  const { sessionId, transactionId } = event;

  const transactionData = await walletConnector.getTransactionRequest(transactionId);
});

/**
 *  Send transaction status
 */
walletConnector.sendTransactionStatus({
  success: true,
  txHash: '0xabcd...873'
})
```

### Development workflow

```bash
$ git clone https://github.com/WalletConnect/walletconnect-monorepo
$ cd walletconnect-monorepo
$ npm install
$ npm run bootstrap

# Run testcases
$ npm run test

# Run eslint
$ npm run lint
```

### Publish

```bash
$ npm run publish
```

### License

MIT
