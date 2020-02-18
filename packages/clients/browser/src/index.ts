import Connector from '@walletconnect/core'
import { IWalletConnectOptions } from '@walletconnect/types'
// import { logDeprecationWarning } from '@walletconnect/utils'
import * as cryptoLib from './webCrypto'
import WebStorage from './webStorage'

class WalletConnect extends Connector {
  constructor (opts: IWalletConnectOptions) {
    super(cryptoLib, opts, null, WebStorage, opts.clientMeta)
    // logDeprecationWarning()
  }
}

export default WalletConnect
