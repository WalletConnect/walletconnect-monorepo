import ChannelProvider from './provider'
import WalletConnectConnection from './connection'
import { IWalletConnectConnectionOptions } from '@walletconnect/types'
class WalletConnectChannelProvider extends ChannelProvider {
  constructor (opts: IWalletConnectConnectionOptions) {
    const connection = new WalletConnectConnection(opts)
    super(connection)
  }
}

export default WalletConnectChannelProvider
