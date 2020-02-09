import WalletConnectSubprovider from '@walletconnect/web3-subprovider'

import ProviderEngine from 'web3-provider-engine'

const FiltersSubprovider = require('web3-provider-engine/subproviders/filters')
const RpcSubprovider = require('web3-provider-engine/subproviders/rpc')
const NonceSubprovider = require('web3-provider-engine/subproviders/nonce-tracker')

const DefaultOptions = {
  bridge: 'https://bridge.walletconnect.org',
  shareNonce: true
}

const singletonNonceSubProvider = new NonceSubprovider()

// eslint-disable-next-line
const isNode = new Function(
  'try {return this===global;}catch(e){return false;}'
)

class WalletConnectProvider extends ProviderEngine {
  constructor (opts?: any) {
    super({ ...DefaultOptions, ...opts })
    const options = { ...DefaultOptions, ...opts }
    const { bridge, rpcUrl, shareNonce } = options

    if (!bridge) {
      throw new Error(
        `Bridge URL missing, non-empty string expected, got "${bridge}"`
      )
    }

    if (!rpcUrl) {
      throw new Error(
        `RPC URL missing, non-empty string expected, got "${rpcUrl}"`
      )
    }

    this.addProvider(new FiltersSubprovider())
    shareNonce
      ? this.addProvider(singletonNonceSubProvider)
      : this.addProvider(new NonceSubprovider())

    this.addProvider(new WalletConnectSubprovider({ bridge, isNode: isNode() }))
    this.addProvider(new RpcSubprovider({ rpcUrl }))

    this.start()
  }
}

export default WalletConnectProvider
