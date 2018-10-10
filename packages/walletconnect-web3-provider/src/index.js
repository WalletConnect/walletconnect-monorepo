import ProviderEngine from 'web3-provider-engine'
import RpcSubprovider from 'web3-provider-engine/subproviders/rpc'
import WalletConnectSubprovider from 'walletconnect-web3-subprovider'

export default function(opts) {
  const bridgeUrl = opts.bridgeUrl || null
  if (!bridgeUrl || typeof bridgeUrl !== 'string') {
    throw new Error('Missing or Invalid bridgeUrl field')
  }

  const dappName = opts.dappName || null
  if (!dappName || typeof dappName !== 'string') {
    throw new Error('Missing or Invalid dappName field')
  }

  const rpcUrl = opts.rpcUrl || null
  if (!rpcUrl || typeof rpcUrl !== 'string') {
    throw new Error('Missing or Invalid rpcUrl field')
  }

  const engine = new ProviderEngine()

  const walletconnect = new WalletConnectSubprovider(opts)

  const rpc = new RpcSubprovider({ rpcUrl: opts.rpcUrl })

  engine.addProvider(walletconnect)
  engine.addProvider(rpc)
  engine.start()

  return engine
}
