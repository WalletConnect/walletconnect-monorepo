import Web3ProviderEngine from 'web3-provider-engine'
import RpcSubprovider from 'web3-provider-engine/subproviders/rpc'
import WalletConnectSubprovider from '@walletconnect/web3-subprovider'

export default function (opts) {
  const bridge = opts.bridge || null
  if (!bridge || typeof bridge !== 'string') {
    throw new Error('Missing or Invalid bridge field')
  }

  const rpcUrl = opts.rpcUrl || null
  if (!rpcUrl || typeof rpcUrl !== 'string') {
    throw new Error('Missing or Invalid rpcUrl field')
  }

  const engine = new Web3ProviderEngine()

  const walletconnect = new WalletConnectSubprovider(opts)

  const rpc = new RpcSubprovider({ rpcUrl: opts.rpcUrl })

  engine.addProvider(walletconnect)
  engine.addProvider(rpc)
  engine.start()

  return engine
}
