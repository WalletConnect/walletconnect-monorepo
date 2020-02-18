import Connector from '@walletconnect/core'
import { IWalletConnectOptions } from '@walletconnect/types'
// import { logDeprecationWarning } from '@walletconnect/utils'
import * as cryptoLib from './webCrypto'
import WebStorage from './webStorage'

class WalletConnect extends Connector {
  constructor (connectorOpts: IWalletConnectOptions) {
    super({
      cryptoLib,
      connectorOpts,
      sessionStorage: WebStorage,
      clientMeta: connectorOpts.clientMeta
    })
    // logDeprecationWarning()
  }
}

export default WalletConnect
