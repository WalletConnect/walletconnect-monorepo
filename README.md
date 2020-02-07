# WalletConnect v1.0.0-beta

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

1. [For Dapps (Client SDK - browser)](#for-dapps-client-sdk---browser)
2. [For Wallets (Client SDK - react-native)](#for-wallets-client-sdk---react-native)

## For Dapps (Client SDK - browser)

### Install

```bash
yarn add @walletconnect/browser @walletconnect/qrcode-modal

# OR

npm install --save @walletconnect/browser @walletconnect/qrcode-modal
```

### Initiate Connection

```javascript
import WalletConnect from "@walletconnect/browser";
import WalletConnectQRCodeModal from "@walletconnect/qrcode-modal";

// Create a walletConnector
const walletConnector = new WalletConnect({
  bridge: "https://bridge.walletconnect.org" // Required
});

// Check if connection is already established
if (!walletConnector.connected) {
  // create new session
  walletConnector.createSession().then(() => {
    // get uri for QR Code modal
    const uri = walletConnector.uri;
    // display QR Code modal
    WalletConnectQRCodeModal.open(uri, () => {
      console.log("QR Code Modal closed");
    });
  });
}

// Subscribe to connection events
walletConnector.on("connect", (error, payload) => {
  if (error) {
    throw error;
  }

  // Close QR Code Modal
  WalletConnectQRCodeModal.close();

  // Get provided accounts and chainId
  const { accounts, chainId } = payload.params[0];
});

walletConnector.on("session_update", (error, payload) => {
  if (error) {
    throw error;
  }

  // Get updated accounts and chainId
  const { accounts, chainId } = payload.params[0];
});

walletConnector.on("disconnect", (error, payload) => {
  if (error) {
    throw error;
  }

  // Delete walletConnector
});
```

### Send Transaction \(eth_sendTransaction\)

```javascript
// Draft transaction
const tx = {
  from: "0xbc28Ea04101F03aA7a94C1379bc3AB32E65e62d3", // Required
  to: "0x89D24A7b4cCB1b6fAA2625Fe562bDd9A23260359", // Required (for non contract deployments)
  data: "0x", // Required
  gasPrice: "0x02540be400", // Optional
  gasLimit: "0x9c40", // Optional
  value: "0x00", // Optional
  nonce: "0x0114" // Optional
};

// Send transaction
walletConnector
  .sendTransaction(tx)
  .then(result => {
    // Returns transaction id (hash)
    console.log(result);
  })
  .catch(error => {
    // Error returned when rejected
    console.error(error);
  });
```

### Sign Transaction \(eth_signTransaction\)

```javascript
// Draft transaction
const tx = {
  from: "0xbc28Ea04101F03aA7a94C1379bc3AB32E65e62d3", // Required
  to: "0x89D24A7b4cCB1b6fAA2625Fe562bDd9A23260359", // Required (for non contract deployments)
  data: "0x", // Required
  gasPrice: "0x02540be400", // Optional
  gasLimit: "0x9c40", // Optional
  value: "0x00", // Optional
  nonce: "0x0114" // Optional
};

// Sign transaction
walletConnector
  .signTransaction(tx)
  .then(result => {
    // Returns signed transaction
    console.log(result);
  })
  .catch(error => {
    // Error returned when rejected
    console.error(error);
  });
```

### Sign Personal Message \(personal_sign\)

```javascript

// Draft Message Parameters
const message = "My email is john@doe.com - 1537836206101"

const msgParams = [
  convertUtf8ToHex(message)                                                 // Required
  "0xbc28ea04101f03ea7a94c1379bc3ab32e65e62d3",                             // Required
];


// Sign personal message
walletConnector
  .signPersonalMessage(msgParams)
  .then((result) => {
    // Returns signature.
    console.log(result)
  })
  .catch(error => {
    // Error returned when rejected
    console.error(error);
  })
```

### Sign Message \(eth_sign\)

```javascript

// Draft Message Parameters
const message = "My email is john@doe.com - 1537836206101";

const msgParams = [
  "0xbc28ea04101f03ea7a94c1379bc3ab32e65e62d3",                            // Required
  keccak256("\x19Ethereum Signed Message:\n" + len(message) + message))    // Required
];


// Sign message
walletConnector
  .signMessage(msgParams)
  .then((result) => {
    // Returns signature.
    console.log(result)
  })
  .catch(error => {
    // Error returned when rejected
    console.error(error);
  })
```

### Sign Typed Data \(eth_signTypedData\)

```javascript
// Draft Message Parameters
const typedData = {
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
};

const msgParams = [
  "0xbc28ea04101f03ea7a94c1379bc3ab32e65e62d3", // Required
  typedData // Required
];

// Sign Typed Data
walletConnector
  .signTypedData(msgParams)
  .then(result => {
    // Returns signature.
    console.log(result);
  })
  .catch(error => {
    // Error returned when rejected
    console.error(error);
  });
```

### Send Custom Request

```javascript
// Draft Custom Request
const customRequest = {
  id: 1337,
  jsonrpc: "2.0",
  method: "eth_signTransaction",
  params: [
    {
      from: "0xbc28Ea04101F03aA7a94C1379bc3AB32E65e62d3",
      to: "0x89D24A7b4cCB1b6fAA2625Fe562bDd9A23260359",
      data: "0x",
      gasPrice: "0x02540be400",
      gasLimit: "0x9c40",
      value: "0x00",
      nonce: "0x0114"
    }
  ]
};

// Send Custom Request
walletConnector
  .sendCustomRequest(customRequest)
  .then(result => {
    // Returns request result
    console.log(result);
  })
  .catch(error => {
    // Error returned when rejected
    console.error(error);
  });
```

## For Wallets (Client SDK - react-native)

### Install

```bash
// Install NPM Package

yarn add @walletconnect/react-native

# OR

npm install --save @walletconnect/react-native

// Polyfill NodeJS modules for React-Native

npm install --save rn-nodeify

rn-nodeify --install --hack
```

### Initiate Connection

```javascript
import RNWalletConnect from "@walletconnect/react-native";

// Create WalletConnector
const walletConnector = new RNWalletConnect(
  {
    uri: "wc:8a5e5bdc-a0e4-47...TJRNmhWJmoxdFo6UDk2WlhaOyQ5N0U=" // Required
  },
  {
    clientMeta: {
      // Required
      description: "WalletConnect Developer App",
      url: "https://walletconnect.org",
      icons: ["https://walletconnect.org/walletconnect-logo.png"],
      name: "WalletConnect",
      ssl: true
    },
    push: {
      // Optional
      url: "https://push.walletconnect.org",
      type: "fcm",
      token: token,
      peerMeta: true,
      language: language
    }
  }
);

// Subscribe to session requests
walletConnector.on("session_request", (error, payload) => {
  if (error) {
    throw error;
  }

  // Handle Session Request

  /* payload:
  {
    id: 1,
    jsonrpc: '2.0'.
    method: 'session_request',
    params: [{
      peerId: '15d8b6a3-15bd-493e-9358-111e3a4e6ee4',
      peerMeta: {
        name: "WalletConnect Example",
        description: "Try out WalletConnect v1.0.0-beta",
        icons: ["https://example.walletconnect.org/favicon.ico"],
        url: "https://example.walletconnect.org",
        ssl: true
      }
    }]
  }
  */
});

// Subscribe to call requests
walletConnector.on("call_request", (error, payload) => {
  if (error) {
    throw error;
  }

  // Handle Call Request

  /* payload:
  {
    id: 1,
    jsonrpc: '2.0'.
    method: 'eth_sign',
    params: [
      "0xbc28ea04101f03ea7a94c1379bc3ab32e65e62d3",
      "My email is john@doe.com - 1537836206101"
    ]
  }
  */
});

walletConnector.on("disconnect", (error, payload) => {
  if (error) {
    throw error;
  }

  // Delete walletConnector
});
```

### Manage Connection

```javascript
// Approve Session
walletConnector.approveSession({
  accounts: [
    '0x4292...931B3',
    '0xa4a7...784E8',
    ...
  ],
  chainId: 1
})

// Reject Session
walletConnector.rejectSession({
  message: 'OPTIONAL_ERROR_MESSAGE'
})


// Kill Session
walletConnector.killSession()
```

### Manage Call Requests

```javascript
// Approve Call Request
walletConnector.approveRequest({
  id: 1,
  result: "0x41791102999c339c844880b23950704cc43aa840f3739e365323cda4dfa89e7a"
});

// Reject Call Request
walletConnector.rejectRequest({
  id: 1,
  error: {
    message: "OPTIONAL_ERROR_MESSAGE"
  }
});
```
