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
 *  Create WalletConnect Controller
 */
const WalletConnectController = new RNWalletConnect({
  push: {                                                                // Optional
    type: 'fcm',
    token: 'cSgGd8BWURk:APA91bGXsLd_...YdFbutyfc8pScl0Qe8-',
    webhook: 'https://push.walletconnect.org/notification/new',
    database: 'https://push.walletconnect.org/notification/data',
    language: 'en'
  }
})

/**
 *  Initiate WalletConnect Controller (on App load)
 */
WalletConnectController.init()

/**
 *  Handle scanned QR Code (New Session)
 */
QRCodeScanner.on('scan', event => {
  const uri = event.data

  const session = WalletConnectController.generateSession(uri)
})

/**
 *  Handle depp linking events (New Session)
 */
Linking.addEventListener('url', event => {
  const uri = event.url

  const session = WalletConnectController.generateSession(uri)
});

// session sample
session {
  sessionId: 'c6f552b0-dc1d-4291-8099-b0c941a75477',
  dappData: {
    name: 'WalletConnect Example',
    ssl: true
    host: "example.walletconnect.org",
    icons: ["https://example.walletconnect.org/favicon.ico"]
  }
}

/**
 * IMPORTANT!
 * Display WalletConnect session request using the provided dappData
 */

/**
 *  Approve Session (send chainId and accounts)
 */
await WalletConnectController.approveSession({
  sessionId: session.sessionId        //  Required
  chainId: 1,                                 //  Required
  accounts: [                                 //  Required
    '0x4292...931B3',
    '0xa4a7...784E8',
    ...
  ]
})

/**
 *  Reject Session (optionally send custom error message)
 */
await WalletConnectController.rejectSession({
  sessionId: session.sessionId        //  Required
  error: 'Custom Error Message'               //  Optional
})


/**
 *  Kill Session
 */
await WalletConnectController.killSession({
  sessionId: session.sessionId        //  Required
})


/**
 *  Handle push notification events
 */
PushNotificationService.on('notification', event => {
  const { sessionId, callId } = event.data;

  // Get Call Request data
  const callRequest = await WalletConnectController.onCallRequest({
    sessionId: sessionId,
    callId: callId
  })

  // Display Call Request
  callRequest {
    id: 15423847283472,
    jsonrpc: '2.0',
    method: 'eth_sign',
    params: [
      '0xbc28ea04101f03ea7a94c1379bc3ab32e65e62d3',
      'Are you Bob?'
    ]
  }
})


/**
 *  Get all pending call requests
 */
const allCallRequests = await WalletConnectController.getCallRequests({
  sessionId: session.sessionId        //  Required
});

// allCallRequests sample
allCallRequests {
  '8668929c-00ea-4885-b03a-4220eb1c00fb': {
    id: 15423847283472,
    jsonrpc: '2.0',
    method: 'eth_sign',
    params: [
      '0xbc28ea04101f03ea7a94c1379bc3ab32e65e62d3',
      'Are you Bob?'
    ]
  }
}

/**
 *  Approve call request (send call result)
 */
await WalletConnectController.approveCallRequest({
  sessionId: session.sessionId,       //  Required
  callId: callRequest.callId,                 //  Required
  result: '0xabcd...873'                      //  Required
})

/**
 *  Reject call request (optionally send custom error message)
 */
await WalletConnectController.rejectCallRequest({
  sessionId: session.sessionId,       //  Required
  callId: callRequest.callId,                 //  Required
  error: 'Custom Error Message'               //  Optional
)
```
