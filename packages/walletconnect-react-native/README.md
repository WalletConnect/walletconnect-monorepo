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
 *  Create WalletConnector (using the URI from scanning the QR code)
 */
const walletConnector = new RNWalletConnect(uri)

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
 *  Handle push notification events & Get transaction data
 */
FCM.on(FCMEvent.Notification, event => {
  const { sessionId, transactionId } = event;

  const transactionData = await walletConnector.getTransactionRequest(transactionId);
});

/**
 *  Send transaction status
 */
await walletConnector.sendTransactionStatus(transactionId, {
  success: true,
  txHash: '0xabcd...873'
})
```
