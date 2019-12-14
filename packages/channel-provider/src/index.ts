import { IWalletConnectConnectionOptions } from '@walletconnect/types'

import WalletConnectConnection from './connection'
import ChannelProvider from './provider'

class WalletConnectChannelProvider extends ChannelProvider {
  constructor (opts?: IWalletConnectConnectionOptions) {
    const connection = new WalletConnectConnection(opts)
    super(connection)
  }
}

export default WalletConnectChannelProvider
