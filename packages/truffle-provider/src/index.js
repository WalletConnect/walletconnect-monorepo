const ProviderEngine = require('web3-provider-engine')
const FiltersSubprovider = require('web3-provider-engine/subproviders/filters')
const RpcSubprovider = require('web3-provider-engine/subproviders/rpc')
const NonceSubprovider = require('web3-provider-engine/subproviders/nonce-tracker')
const WalletConnectSubprovider = require('./subprovider')

const DefaultOptions = {
  bridge: 'https://bridge.walletconnect.org',
  shareNonce: true
}

const singletonNonceSubProvider = new NonceSubprovider()

function WalletConnectProvider (opts) {
  const options = { ...DefaultOptions, ...opts }
  const { bridge, rpcUrl, shareNonce } = options

  if (!bridge) {
    throw new Error(`Bridge URL missing, non-empty string expected, got "${bridge}"`)
  }

  if (!rpcUrl) {
    throw new Error(`RPC URL missing, non-empty string expected, got "${rpcUrl}"`)
  }

  this.engine = new ProviderEngine()

  this.engine.addProvider(new FiltersSubprovider())
  shareNonce
    ? this.engine.addProvider(singletonNonceSubProvider)
    : this.engine.addProvider(new NonceSubprovider())

  this.engine.addProvider(new WalletConnectSubprovider({ bridge }))
  this.engine.addProvider(new RpcSubprovider({ rpcUrl }))

  this.engine.start()
}

WalletConnectProvider.prototype.sendAsync = function () {
  this.engine.sendAsync.apply(this.engine, arguments)
}

WalletConnectProvider.prototype.send = function () {
  return this.engine.send.apply(this.engine, arguments)
}

module.exports = WalletConnectProvider
