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

  const walletconnect = new WalletConnectSubprovider({
    bridgeUrl: 'https://bridge.walletconnect.org',
    dappName: 'INSERT_DAPP_NAME'
  })

  const rpc = new RpcSubprovider({ rpcUrl: 'http://localhost:8545' })

  engine.addProvider(walletconnect)
  engine.addProvider(rpc)
  engine.start()

  engine.walletconnect = walletconnect

  return engine
}
