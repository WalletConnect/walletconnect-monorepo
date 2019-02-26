import pkg from '../package.json'
import Web3ProviderEngine from 'web3-provider-engine'
import RpcSubprovider from 'web3-provider-engine/subproviders/rpc'
import CacheSubprovider from 'web3-provider-engine/subproviders/cache'
import FixtureSubprovider from 'web3-provider-engine/subproviders/fixture'
import FilterSubprovider from 'web3-provider-engine/subproviders/filters'
import NonceSubprovider from 'web3-provider-engine/subproviders/nonce-tracker'
import SubscriptionsSubprovider from 'web3-provider-engine/subproviders/subscriptions'
import WalletConnectSubprovider from '@walletconnect/web3-subprovider'

export default function (opts) {
  const engine = new Web3ProviderEngine()

  engine.addProvider(
    new FixtureSubprovider({
      web3_clientVersion: `WalletConnect/v${pkg.version}/javascript`,
      net_listening: true,
      eth_hashrate: '0x00',
      eth_mining: false,
      eth_syncing: true
    })
  )

  engine.addProvider(new CacheSubprovider())
  engine.addProvider(new SubscriptionsSubprovider())
  engine.addProvider(new FilterSubprovider())
  engine.addProvider(new NonceSubprovider())

  engine.addProvider(new RpcSubprovider({ rpcUrl: opts.rpcUrl }))

  engine.addProvider(new WalletConnectSubprovider({ bridge: opts.bridge }))

  engine.start()

  return engine
}
