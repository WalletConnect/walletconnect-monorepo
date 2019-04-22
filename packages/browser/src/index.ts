import Connector from '@walletconnect/core'
import { IWalletConnectOptions } from '@walletconnect/types'
import * as cryptoLib from './webCrypto'

class WalletConnect extends Connector {
  constructor (opts: IWalletConnectOptions) {
    super(cryptoLib, opts)
  }
}

export default WalletConnect
