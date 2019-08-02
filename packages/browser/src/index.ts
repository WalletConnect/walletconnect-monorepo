import Connector from '@walletconnect/core'
import { IWalletConnectOptions } from '@walletconnect/types'
import SocketTransport from '@walletconnect/socket-transport'
import * as cryptoLib from './webCrypto'
import WebStorage from './webStorage'

class WalletConnect extends Connector {
  constructor (opts: IWalletConnectOptions) {
    super(
      cryptoLib,
      opts,
      {
        transport: SocketTransport,
        params: ['bridge', 'clientId']
      },
      WebStorage
    )
  }
}

export default WalletConnect
