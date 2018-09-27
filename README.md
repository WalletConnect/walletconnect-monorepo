# WalletConnect

[![Build Status](https://travis-ci.org/WalletConnect/walletconnect-monorepo.svg?branch=master)](https://travis-ci.org/WalletConnect/walletconnect-monorepo)
[![NPM Version](https://img.shields.io/badge/npm-v0.7.0-brightgreen.svg)](http://npmjs.com/package/walletconnect)

An open source standard for connecting mobile wallets to dapps - https://walletconnect.org

For more documentation go to: https://docs.walletconnect.org

#### Monorepo for WalletConnect Javascript Libraries

| Library                        | Description             |
| ------------------------------ | ----------------------- |
| js-walletconnect-core          | Javascript Core library |
| walletconnect                  | Browser SDK             |
| rn-walletconnect-wallet        | React-Native SDK        |
| walletconnect-web3-subprovider | Web3 Subprovider        |
| walletconnect-qrcode-modal     | QR Code Modal           |

### Getting Started

1.  [For Dapps (Browser SDK)](#for-dapps-browser-sdk)
2.  [For Wallets (React-Native SDK)](#for-wallets-react-native-sdk)
3.  [For Web3 Subprovider (web3.js)](#for-web3-subprovider-web3.js)
4.  [For QR Code Modal (Browsers only)](#for-qr-code-modal-browsers-only)

### For Dapps (Browser SDK)

1.  Setup

```bash
yarn add walletconnect

# OR

npm install --save walletconnect
```

2.  Implementation

```js
import WalletConnect from 'walletconnect'
import WalletConnectQRCodeModal

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
 *  Initiate WalletConnect session
 */
const session = await webConnector.initSession()

/**
 *  Get accounts (type: <Array>)
 */
let accounts = webConnector.accounts

/**
 *  Check if accounts is empty array
 */
if (!accounts.length) {
  // If there is no accounts, prompt the user to scan the QR code
  const { uri } = webConnector.uri;

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

2.  Implementation

```js
import RNWalletConnect from 'rn-walletconnect-wallet'

/**
 *  Create WalletConnector (using the URI from scanning the QR code)
 */
const walletConnector = new RNWalletConnect({ uri: uri })

/**
 *  Send session data
 */
await walletConnector.sendSessionStatus({
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
 *  Handle push notification events & get call data
 */
FCM.on(FCMEvent.Notification, event => {
  const { sessionId, callId } = event;

  const callData = await walletConnector.getCallRequest(callId);

  // example callData
  {
    method: 'eth_sendTransaction',
    data: {
      from: '0xab12...1cd',
      to: '0x0',
      nonce: 1,
      gas: 100000,
      value: 0,
      data: '0x0'
    }
  }
});

/**
 *  Send call status
 */
await walletConnector.sendCallStatus(callId, {
  success: true,
  result: '0xabcd...873'
})

/**
 *  Get all calls from bridge
 */
const allCalls = await walletConnector.getAllCallRequests();

/**
 *  allCalls is a map from callId --> callData
 */
const callData = allCalls[callId];
```

### For Web3 Subprovider (web3.js)

1.  Setup

```bash
/**
 *  Install NPM Package
 */

yarn add web3 web3-provider-engine walletconnect-web3-subprovider

# OR

npm install --save web3 web3-provider-engine walletconnect-web3-subprovider
```

2.  Implementation

```js
import Web3 from 'web3'
import ProviderEngine from 'web3-provider-engine'
import RpcSubprovider from 'web3-provider-engine/subproviders/rpc'
import WalletConnectSubprovider from 'walletconnect-web3-subprovider'

const engine = new ProviderEngine()

engine.addProvider(new WalletConnectSubprovider({
  bridgeUrl: 'https://bridge.walletconnect.org',  // Required
  dappName: 'INSERT_DAPP_NAME',                   // Required
})
engine.addProvider(new RpcSubprovider({ rpcUrl:'http://localhost:8545' }))
engine.start()

const web3 = new Web3(engine)
```

### For QR Code Modal (Browsers only)

1.  Setup

```bash
/**
 *  Install NPM Package
 */

yarn add walletconnect-qrcode-modal

# OR

npm install --save walletconnect-qrcode-modal
```

2.  Implementation

```js
import WalletConnectQRCodeModal from 'walletconnect-qrcode-modal'

/**
 *  Get URI from WalletConnect object
 */
const uri = webConnector.uri

/**
 *  Open QR Code Modal
 */
WalletConnectQRCodeModal.open(uri)

/**
 *  Close QR Code Modal
 */
WalletConnectQRCodeModal.close()
```

### Development workflow

```bash
$ git clone https://github.com/WalletConnect/walletconnect-monorepo.git && cd $_

$ npm install

$ npm run bootstrap

$ npm run check-packages
```

### Publish packages

```bash
$ npm run publish
```

### License

LGPL-3.0
