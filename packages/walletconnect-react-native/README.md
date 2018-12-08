# React-Native WalletConnect Wallet

Library to connect React-Native mobile wallets to desktop Dapps using WalletConnect

You can read more about WalletConnect standard here: http://walletconnect.org/

### Setup

1.  Install NPM Package

```bash
yarn add rn-walletconnect-wallet

# OR

npm install --save rn-walletconnect-wallet
```

2.  Nodify 'crypto' package for cryptography

```bash
# install "crypto" shims and run package-specific hacks
rn-nodeify --install "crypto" --hack
```

### Getting Started

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
