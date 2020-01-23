import { IWalletConnectConnectionOptions } from '@walletconnect/types'
import { ChannelProvider } from '@connext/channel-provider'

import WalletConnectConnection from './connection'

class WalletConnectChannelProvider extends ChannelProvider {
  constructor (opts?: IWalletConnectConnectionOptions) {
    const connection = new WalletConnectConnection(opts)
    super(connection)
  }
}

export default WalletConnectChannelProvider
