import ProviderEngine from 'web3-provider-engine'
import RpcSubprovider from 'web3-provider-engine/subproviders/rpc'
import Subprovider from './subprovider'

export const WalletConnectSubprovider = Subprovider

class WalletConnectProvider {
  constructor(opts) {
    const rpcUrl = opts.rpcUrl || 'http://localhost:8545'
    const engine = new ProviderEngine()
    const subprovider = new WalletConnectSubprovider(opts)
    engine.addProvider(subprovider)
    engine.addProvider(new RpcSubprovider({ rpcUrl }))
    engine.start()
  }
}

export default WalletConnectProvider
