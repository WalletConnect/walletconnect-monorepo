# WalletConnect SDK

WalletConnect SDK

For more details, read the [documentation](https://docs.walletconnect.org)

## Example

```javascript
import WalletConnect from "walletconnect";

//  Create WalletConnect SDK instance
const walletConnect = new WalletConnect();

//  Connect session (triggers QR Code modal)
const connector = await walletConnect.connect();

//  Get your desired provider

const web3Provider = await walletConnect.getWeb3Provider();

const starkwareProvider = await walletConnect.getStarkwareProvider();

const threeIdProvider = await walletConnect.getThreeIdProvider();
```
