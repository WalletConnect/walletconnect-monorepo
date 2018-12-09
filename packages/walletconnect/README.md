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
import WalletConnect from "walletconnect";

/**
 *  Create a walletConnect
 */
const walletConnect = new WalletConnect({
  bridgeUrl: "https://test-bridge.walletconnect.org" // Required
});

/**
 *  Initiate WalletConnect session
 */
await walletConnect.initSession();

/**
 *  Check if connection is already established
 */
if (walletConnect.isConnected) {
  // If yes, get accounts
  const accounts = walletConnect.accounts;
} else {
  // If not, prompt the user to scan the QR code
  const uri = walletConnect.uri;

  // Listen for session confirmation from wallet
  await walletConnect.listenSessionStatus();

  // Get accounts after session status is resolved
  accounts = walletConnect.accounts;
}

/**
 * Get chainId
 */
const chainId = walletConnect.chainId;

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
  const result = await walletConnect.sendTransaction(tx);
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
  const result = await walletConnect.signMessage(msgParams);
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
  const result = await walletConnect.signTypedData(msgParams);
} catch (error) {
  // Rejected signing
  console.error(error);
}
```
