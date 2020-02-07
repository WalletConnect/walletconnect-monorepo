import EthereumProvider from './provider'
import WalletConnectConnection from './connection'
import { IWalletConnectConnectionOptions } from '@walletconnect/types'

class WalletConnectProvider extends EthereumProvider {
  constructor (opts: IWalletConnectConnectionOptions) {
    const connection = new WalletConnectConnection(opts)
    super(connection)
  }
}

export default WalletConnectProvider
