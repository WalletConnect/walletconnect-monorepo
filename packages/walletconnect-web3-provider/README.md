# WalletConnect Web3 Provider

This implements provider for walletconnect standard.

You can read more about WalletConnect standard here: http://walletconnect.org/

## Example

```js
import Web3 from 'web3'
import WalletConnectProvider from 'walletconnect-web3-provider'

const provider = new WalletConnectProvider({
  bridgeUrl: 'https://bridge.walletconnect.org',   // Required
  dappName: 'INSERT_DAPP_NAME',                   // Required
  rpcUrl:'http://localhost:8545'                 // Required
}

const web3 = new Web3(provider)
```
