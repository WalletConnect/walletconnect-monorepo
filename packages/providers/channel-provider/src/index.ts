import { IWalletConnectConnectionOptions } from '@walletconnect/types'
// TODO: Replace local provider with imported provider
import { ChannelProvider } from './provider'
// import { ChannelProvider } from '@connext/channel-provider'
import WalletConnectConnection from './connection'

class WalletConnectChannelProvider extends ChannelProvider {
  public isWalletConnect: boolean

  constructor (opts?: IWalletConnectConnectionOptions) {
    const connection = new WalletConnectConnection(opts)
    super(connection)
    this.isWalletConnect = true
  }
}

export default WalletConnectChannelProvider
