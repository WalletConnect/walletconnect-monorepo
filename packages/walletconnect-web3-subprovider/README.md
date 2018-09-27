# WalletConnect Web3 Provider

This implements provider for walletconnect standard.

You can read more about WalletConnect standard here: http://walletconnect.org/

## Example

```js
import Web3 from 'web3'
import ProviderEngine from 'web3-provider-engine'
import RpcSubprovider from 'web3-provider-engine/subproviders/rpc'
import Subprovider from './subprovider'

const subprovider = new WalletConnectSubprovider(opts)
const rpcUrl = 'http://localhost:8545'
const engine = new ProviderEngine()

engine.addProvider(subprovider)
engine.addProvider(new RpcSubprovider({ rpcUrl }))
engine.start()

const web3 = new Web3(engine)
```
