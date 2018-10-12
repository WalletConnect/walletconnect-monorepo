# WalletConnect Web3 Subprovider

This implements subprovider for walletconnect standard.

You can read more about WalletConnect standard here: http://walletconnect.org/

## Example

```js
import Web3 from 'web3'
import ProviderEngine from 'web3-provider-engine'
import RpcSubprovider from 'web3-provider-engine/subproviders/rpc'
import WalletConnectSubprovider from 'walletconnect-web3-subprovider'

const engine = new ProviderEngine()

engine.addProvider(
  new WalletConnectSubprovider({
    bridgeUrl: 'https://test-bridge.walletconnect.org', // Required
    dappName: 'INSERT_DAPP_NAME'                   // Required
  })
)
engine.addProvider(
  new RpcSubprovider({
    rpcUrl: 'http://localhost:8545'                // Required
  })
)
engine.start()

const web3 = new Web3(engine)
```
