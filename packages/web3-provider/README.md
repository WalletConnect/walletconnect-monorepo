# WalletConnect Web3 Provider

Web3 Provider for WalletConnect

For more details, read the [documentation](https://docs.walletconnect.org)

## Example

```javascript
import Web3 from "web3";
import WalletConnectProvider from "walletconnect-web3-provider";

/**
 *  Create WalletConnect Provider (qrcode modal will be displayed automatically)
 */
const provider = new WalletConnectProvider({
  bridge: "https://test-bridge.walletconnect.org" // Required
});

/**
 *  Create Web3
 */
const web3 = new Web3(provider);

/**
 *  Get Accounts
 */
const accounts = await web3.eth.getAccounts();

/**
 * Send Transaction
 */
const txHash = await web3.eth.sendTransaction(tx);

/**
 * Sign Transaction
 */
const signedTx = await web3.eth.signTransaction(tx);

/**
 * Sign Message
 */
const signedMessage = await web3.eth.sign(msg);

/**
 * Sign Typed Data
 */
const signedTypedData = await web3.eth.signTypedData(msg);
```
