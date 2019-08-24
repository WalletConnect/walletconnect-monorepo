import Connector from '@walletconnect/core'
import { IWalletConnectOptions } from '@walletconnect/types'
import * as cryptoLib from './webCrypto'
import WebStorage from './webStorage'
import { getNetMonitor } from './webNetMonitor'

class WalletConnect extends Connector {
  constructor (opts: IWalletConnectOptions) {
    super(cryptoLib, opts, null, WebStorage, getNetMonitor)
  }
}

export default WalletConnect
