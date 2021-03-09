# WalletConnect SDK

WalletConnect SDK

For more details, read the [documentation](https://docs.walletconnect.org)

## Example

```javascript
import WalletConnect from "walletconnect";

//  Create WalletConnect SDK instance
const wc = new WalletConnect();

//  Connect session (triggers QR Code modal)
const connector = await wc.connect();

//  Get your desired provider

const web3Provider = await wc.getWeb3Provider({
  infuraId: "<INSERT_INFURA_APP_ID>",
});

const channelProvider = await wc.getChannelProvider();

const starkwareProvider = await wc.getStarkwareProvider({
  contractAddress: "<INSERT_CONTRACT_ADDRESS>",
});

const threeIdProvider = await wc.getThreeIdProvider();
```
