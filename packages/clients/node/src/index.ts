import Connector from '@walletconnect/core'
import { IWalletConnectOptions, INodeJSOptions } from '@walletconnect/types'
import SocketTransport from '@walletconnect/socket-transport'
import * as cryptoLib from './nodeCrypto'
import { getNetMonitor } from './nodeNetMonitor'

// polyfill WebSocket for NodeJS
WebSocket = require('ws')

const transportOpts = {
  initTransport: (opts: any) => new SocketTransport(opts),
  params: ['bridge', 'clientId']
}

class NodeWalletConnect extends Connector {
  constructor (opts: IWalletConnectOptions, nodeJsOptions: INodeJSOptions) {
    super(
      cryptoLib,
      opts,
      transportOpts,
      null,
      getNetMonitor,
      nodeJsOptions.clientMeta
    )
  }
}

export default NodeWalletConnect
