# WalletConnect v1.0.0-beta.1

Open protocol for connecting Wallets to Dapps - https://walletconnect.org

| Library                         | Current Version                                                                                                                                  | Description      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| @walletconnect/core             | [![npm version](https://badge.fury.io/js/%40walletconnect%2Fcore.svg)](https://badge.fury.io/js/%40walletconnect%2Fcore)                         | Core SDK         |
| @walletconnect/browser          | [![npm version](https://badge.fury.io/js/%40walletconnect%2Fbrowser.svg)](https://badge.fury.io/js/%40walletconnect%2Fbrowser)                   | Browser SDK      |
| @walletconnect/react-native     | [![npm version](https://badge.fury.io/js/%40walletconnect%2Freact-native.svg)](https://badge.fury.io/js/%40walletconnect%2Freact-native)         | React-Native SDK |
| @walletconnect/utils            | [![npm version](https://badge.fury.io/js/%40walletconnect%2Futils.svg)](https://badge.fury.io/js/%40walletconnect%2Futils)                       | Utility Library  |
| @walletconnect/types            | [![npm version](https://badge.fury.io/js/%40walletconnect%2Ftypes.svg)](https://badge.fury.io/js/%40walletconnect%2Ftypes)                       | Typescript Types |
| @walletconnect/web3-provider    | [![npm version](https://badge.fury.io/js/%40walletconnect%2Fweb3-provider.svg)](https://badge.fury.io/js/%40walletconnect%2Fweb3-provider)       | Web3 Provider    |
| @walletconnect/web3-subprovider | [![npm version](https://badge.fury.io/js/%40walletconnect%2Fweb3-subprovider.svg)](https://badge.fury.io/js/%40walletconnect%2Fweb3-subprovider) | Web3 Subprovider |
| @walletconnect/qrcode-modal     | [![npm version](https://badge.fury.io/js/%40walletconnect%2Fqrcode-modal.svg)](https://badge.fury.io/js/%40walletconnect%2Fqrcode-modal)         | QR Code Modal    |

## Getting Started

1. [For Dapps (Client SDK - browser)](#for-dapps-client-sdk-browser)
2. [For Wallets (Client SDK - react-native)](#for-wallets-client-sdk-react-native)

## For Dapps (Client SDK - browser)

### Install

```bash
yarn add @walletconnect/browser

# OR

npm install --save @walletconnect/browser
```

### Initiate Connection

```js
import WalletConnect from "@walletconnect/browser";
import WalletConnectQRCodeModal from "@walletconnect/qrcode-modal";

/**
 *  Create a walletConnector
 */
const walletConnector = new WalletConnect({
  bridge: "https://bridge.walletconnect.org" // Required
});

/**
 *  Check if connection is already established
 */
if (!walletConnector.connected) {
  // create new session
  await walletConnector.createSession();

  // get uri for QR Code modal
  const uri = walletConnector.uri;

  // display QR Code modal
  WalletConnectQRCodeModal.open(uri, () => {
    console.log("QR Code Modal closed");
  });
}

/**
 *  Subscribe to connection events
 */
walletConnector.on("connect", (error, payload) => {
  if (error) {
    throw error;
  }

  // close QR Code Modal
  WalletConnectQRCodeModal.close();

  // get provided accounts and chainId
  const { accounts, chainId } = payload.params[0];
});

walletConnector.on("session_update", (error, payload) => {
  if (error) {
    throw error;
  }

  // get updated accounts and chainId
  const { accounts, chainId } = payload.params[0];
});

walletConnector.on("disconnect", (error, payload) => {
  if (error) {
    throw error;
  }

  // delete walletConnector
});
```

### Send Transaction

```js
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
  const result = await walletConnector.sendTransaction(tx);
} catch (error) {
  // Rejected Transaction
  console.error(error);
}
```

### Sign Message

```js
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
  const result = await walletConnector.signMessage(msgParams);
} catch (error) {
  // Rejected signing
  console.error(error);
}
```

### Sign Typed Data

```js
/**
 *  Draft Typed Data
 */
const msgParams = [
  "0xbc28ea04101f03ea7a94c1379bc3ab32e65e62d3",
  {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" }
      ],
      Person: [
        { name: "name", type: "string" },
        { name: "account", type: "address" }
      ],
      Mail: [
        { name: "from", type: "Person" },
        { name: "to", type: "Person" },
        { name: "contents", type: "string" }
      ]
    },
    primaryType: "Mail",
    domain: {
      name: "Example Dapp",
      version: "1.0.0-beta",
      chainId: 1,
      verifyingContract: "0x0000000000000000000000000000000000000000"
    },
    message: {
      from: {
        name: "Alice",
        account: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      to: {
        name: "Bob",
        account: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
      },
      contents: "Hey, Bob!"
    }
  }
];

/**
 *  Sign Typed Data
 */
try {
  // Signed typed data
  const result = await walletConnector.signTypedData(msgParams);
} catch (error) {
  // Rejected signing
  console.error(error);
}
```

## For Wallets (Client SDK - react-native)

### Install

```bash
/**
 *  Install NPM Package
 */

yarn add @walletconnect/react-native

# OR

npm install --save @walletconnect/react-native

/**
 *  Polyfill NodeJS modules for React-Native
 */

npm install --save rn-nodeify

rn-nodeify --install --hack
```

### Initiate Connection

```js
import RNWalletConnect from '@walletconnect/react-native'

/**
 *  Create WalletConnector
 */
const walletConnector = new RNWalletConnect(
  {
    uri: 'wc:8a5e5bdc-a0e4-47...TJRNmhWJmoxdFo6UDk2WlhaOyQ5N0U=',       // Required
  },
  {
    clientMeta: {                                                       // Required
      description: "WalletConnect Developer App",
      url: "https://walletconnect.org",
      icons: ["https://walletconnect.org/walletconnect-logo.png"],
      name: "WalletConnect",
      ssl: true
    },
    push: {                                                             // Optional
      url: "https://push.walletconnect.org",
      type: "fcm",
      token: token,
      peerMeta: true,
      language: language
    }
  }
)

/**
 *  Subscribe to connection events
 */
walletConnector.on("call_request", (error, payload) => {
  if (error) {
    throw error;
  }

  // Handle Call Request
  payload {
    id: 1,
    jsonrpc: '2.0'.
    method: 'eth_sign',
    params: [
      "0xbc28ea04101f03ea7a94c1379bc3ab32e65e62d3",
      "My email is john@doe.com - 1537836206101"
    ]
  }
});

walletConnector.on("disconnect", (error, payload) => {
  if (error) {
    throw error;
  }

  // delete walletConnector
});
```

### Manage Connection

```js
/**
 *  Approve Session
 */
walletConnector.approveSession({
  accounts: [
    '0x4292...931B3',
    '0xa4a7...784E8',
    ...
  ],
  chainId: 1
})

/**
 *  Reject Session
 */
walletConnector.rejectSession()


/**
 *  Kill Session
 */
walletConnector.killSession()
```

### Manage Call Requests

```js
/**
 *  Approve Call Request
 */
walletConnector.approveRequest({
  id: 1,
  result: "0x41791102999c339c844880b23950704cc43aa840f3739e365323cda4dfa89e7a"
});

/**
 *  Reject Call Request
 */
walletConnector.rejectRequest({
  id: 1,
  result: null
});
```
