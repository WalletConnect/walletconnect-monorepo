// TODO Refactor @walletconnect/core to only use WS when needed
WebSocket = require('ws')

import Connector from '@walletconnect/core'
import { IWalletConnectOptions } from '@walletconnect/types'
import * as cryptoLib from './nodeCrypto'

class WalletConnect extends Connector {
  constructor (opts: IWalletConnectOptions) {
    super(cryptoLib, opts)
  }
}

export default WalletConnect
