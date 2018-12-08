# WalletConnect

[![Build Status](https://travis-ci.org/WalletConnect/walletconnect-monorepo.svg?branch=master)](https://travis-ci.org/WalletConnect/walletconnect-monorepo)

An open source standard for connecting mobile wallets to dapps - https://walletconnect.org

For more documentation go to: https://docs.walletconnect.org

| Library                        | Current Version                                                                                                                        | Description             |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| js-walletconnect-core          | [![npm version](https://badge.fury.io/js/js-walletconnect-core.svg)](https://badge.fury.io/js/js-walletconnect-core)                   | Javascript Core library |
| walletconnect                  | [![npm version](https://badge.fury.io/js/walletconnect.svg)](https://badge.fury.io/js/walletconnect)                                   | Browser SDK             |
| rn-walletconnect-wallet        | [![npm version](https://badge.fury.io/js/rn-walletconnect-wallet.svg)](https://badge.fury.io/js/rn-walletconnect-wallet)               | React-Native SDK        |
| walletconnect-web3-provider    | [![npm version](https://badge.fury.io/js/walletconnect-web3-provider.svg)](https://badge.fury.io/js/walletconnect-web3-provider)       | Web3 Provider           |
| walletconnect-web3-subprovider | [![npm version](https://badge.fury.io/js/walletconnect-web3-subprovider.svg)](https://badge.fury.io/js/walletconnect-web3-subprovider) | Web3 Subprovider        |
| walletconnect-qrcode-modal     | [![npm version](https://badge.fury.io/js/walletconnect-qrcode-modal.svg)](https://badge.fury.io/js/walletconnect-qrcode-modal)         | QR Code Modal           |

### Getting Started

1.  [For Dapps (Browser SDK)](#for-dapps-browser-sdk)
2.  [For Wallets (React-Native SDK)](#for-wallets-react-native-sdk)
3.  [For Web3 Provider (web3.js)](#for-web3-provider-web3js)

### For Dapps (Browser SDK)

1.  Install

```bash
yarn add walletconnect

# OR

npm install --save walletconnect
```

2.  Example

```js
import WalletConnect from "walletconnect";
import WalletConnectQRCodeModal from "walletconnect-qrcode-modal";

/**
 *  Create a webConnector
 */
const webConnector = new WalletConnect({
  bridgeUrl: "https://test-bridge.walletconnect.org", // Required
  dappName: "INSERT_DAPP_NAME" // Required
});

/**
 *  Initiate WalletConnect session
 */
await webConnector.initSession();

/**
 *  Check if connection is already established
 */
if (webConnector.isConnected) {
  // If yes, get accounts
  const accounts = webConnector.accounts;
} else {
  // If not, prompt the user to scan the QR code
  const uri = webConnector.uri;

  // Listen for session confirmation from wallet
  await webConnector.listenSessionStatus();

  // Get accounts after session status is resolved
  accounts = webConnector.accounts;
}

/**
 * Get chainId
 */
const chainId = webConnector.chainId;

/**
 *  Draft transaction
 */
const tx = {
  from: "0xbc28ea04101f03ea7a94c1379bc3ab32e65e62d3",
  to: "0x0",
  nonce: 1,
  gas: 100000,
  value: 0,
  data: "0x0"
};

/**
 *  Send transaction
 */
try {
  // Submitted Transaction Hash
  const result = await webConnector.sendTransaction(tx);
} catch (error) {
  // Rejected Transaction
  console.error(error);
}

/**
 *  Draft Message Parameters
 */
const msgParams = [
  "0xbc28ea04101f03ea7a94c1379bc3ab32e65e62d3",
  "My email is john@doe.com - 1537836206101"
];

/**
 *  Sign message
 */
try {
  // Signed message
  const result = await webConnector.signMessage(msgParams);
} catch (error) {
  // Rejected signing
  console.error(error);
}

/**
 *  Draft Typed Data
 */
const msgParams = [
  {
    type: "string",
    name: "Message",
    value: "My email is john@doe.com"
  },
  {
    type: "uint32",
    name: "A number",
    value: "1537836206101"
  }
];

/**
 *  Sign Typed Data
 */
try {
  // Signed typed data
  const result = await webConnector.signTypedData(msgParams);
} catch (error) {
  // Rejected signing
  console.error(error);
}
```

### For Wallets (React-Native SDK)

1.  Install

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

2.  Example

```js
import RNWalletConnect from 'rn-walletconnect-wallet'

/**
 *  Create WalletConnector
 */
const walletConnector = new RNWalletConnect({
  uri: 'ethereum:wc-8a5e5bdc-a0e4-47...TJRNmhWJmoxdFo6UDk2WlhaOyQ5N0U=',  // Required
  push: {                                                                 // Optional
    type: 'fcm',
    token: 'cSgGd8BWURk:APA91bGXsLd_...YdFbutyfc8pScl0Qe8-',
    webhook: 'https://push.walletconnect.org/notification/new',
  }
})

/**
 *  Approve Session (send chainId and accounts)
 */
await walletConnector.approveSession({
  chainId: 1,             //  Required
  accounts: [             //  Required
    '0x4292...931B3',
    '0xa4a7...784E8',
    ...
  ]
})

/**
 *  Reject Session (optionally send custom error message)
 */
await walletConnector.rejectSession(
  'Custom Error Message'     // Optional
)


/**
 *  Kill Session
 */
await walletConnector.killSession()


/**
 *  Handle push notification events & get call data
 */
FCM.on(FCMEvent.Notification, event => {
  const { sessionId, callId } = event;

  const callData = await walletConnector.getCallRequest(callId);

  // example callData for eth_sendTransaction
  callData {
    method: 'eth_sendTransaction',
    params: [
      {
        from: '0xbc28ea04101f03ea7a94c1379bc3ab32e65e62d3',
        to: '0x0',
        nonce: 1,
        gas: 100000,
        value: 0,
        data: '0x0'
      }
    ]
  }
});

/**
 *  Get all calls from bridge
 */
const allCalls = await walletConnector.getAllCallRequests();

/**
 *  Approve call request (send call result)
 */
walletConnector.approveCallRequest(
  callId,                    // Required
  '0xabcd...873'             // Required
)

/**
 *  Reject call request (optionally send custom error message)
 */
walletConnector.rejectCallRequest(
  callId,                    // Required
  'Custom Error Message'     // Optional
)
```

### For Web3 Provider (web3.js)

1.  Install

```bash
/**
 *  Install NPM Package
 */

yarn add web3 walletconnect-web3-provider

# OR

npm install --save web3 walletconnect-web3-provider
```

2.  Example

```js
import Web3 from 'web3'
import WalletConnectProvider from 'walletconnect-web3-provider'

/**
 *  Create WalletConnect Provider
 */
const provider = new WalletConnectProvider({
  bridgeUrl: 'https://test-bridge.walletconnect.org',   // Required
  dappName: 'INSERT_DAPP_NAME',                   // Required
  rpcUrl: 'http://localhost:8545'                 // Required
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
