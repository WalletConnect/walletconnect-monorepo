# WalletConnect Channel Provider

Channel Provider for WalletConnect

For more details, read the [documentation](https://docs.walletconnect.org)

## Example

```javascript
import * as connext from "@connext/client";
import WalletConnectChannelProvider from "@walletconnect/channel-provider";

/**
 *  Create WalletConnect Provider (qrcode modal will be displayed automatically)
 */
const channelProvider = new WalletConnectChannelProvider();

/**
 *  Create a channel
 */
const channel: Channel = await connext.connect({
  channelProvider,
  nodeUrl: "<INSERT_NODE_URL>",
  store
});

/**
 *  Deposit
 */
channel.deposit({
  amount: "0x3abc", // represented as bignumber
  assetId: AddressZero // Use the AddressZero constant from ethers.js to represent ETH, or enter the token address
});

/**
 * Exchange
 */
await channel.exchange({
  amount: "0x3abc" // in Wei, represented as bignumber
  toAssetId: "0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359" // Dai
  fromAssetId: AddressZero // ETH
})


/**
 * Transfer
 */
await channel.transfer({
  recipient: "xpub1abcdef"  //counterparty's xPub
  meta: "Metadata for transfer"
  amount: "0x3abc" // in Wei, represented as bignumber
  assetId: AddressZero // represents ETH
})


/**
 * Withdrawing
 */
await channel.withdraw({
  recipient: // defaults to signer xpub but can be changed to withdraw to any recipient
  amount: "0x3abc" // in Wei, represented as bignumber
  assetId: AddressZero
})
```
