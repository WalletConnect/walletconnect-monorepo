import { IWCRpcConnectionOptions } from '@walletconnect/types'
import WCRpcConnection from '@walletconnect/rpc-connection'
import { ChannelProvider } from '@connext/channel-provider'

class WalletConnectChannelProvider extends ChannelProvider {
  public isWalletConnect: boolean

  constructor (opts?: IWCRpcConnectionOptions) {
    const connection = new WCRpcConnection(opts)
    super(connection)
    this.isWalletConnect = true
  }
}

export default WalletConnectChannelProvider
