import Connector from '@walletconnect/core'
import { IWalletConnectOptions, INodeJSOptions } from '@walletconnect/types'
import * as cryptoLib from './nodeCrypto'

// polyfill WebSocket for NodeJS
WebSocket = require('ws')

class NodeWalletConnect extends Connector {
  constructor (opts: IWalletConnectOptions, nodeJsOptions: INodeJSOptions) {
    super(cryptoLib, opts, null, null, nodeJsOptions.clientMeta)
  }
}

export default NodeWalletConnect
