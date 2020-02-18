import EthereumProvider from './provider'
import WCRpcConnection from './connection'
import { IWCRpcConnectionOptions } from '@walletconnect/types'

class WalletConnectProvider extends EthereumProvider {
  constructor (opts: IWCRpcConnectionOptions) {
    const connection = new WCRpcConnection(opts)
    super(connection)
  }
}

export default WalletConnectProvider
