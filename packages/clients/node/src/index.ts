import Connector from '@walletconnect/core'
import { IWalletConnectOptions, INodeJSOptions } from '@walletconnect/types'
import SocketTransport from '@walletconnect/socket-transport'
// import { logDeprecationWarning } from '@walletconnect/utils'
import * as cryptoLib from './nodeCrypto'
import { getNetMonitor } from './nodeNetMonitor'

const transportOpts = {
  initTransport: (opts: any) => new SocketTransport(opts),
  params: ['bridge', 'clientId']
}

class NodeWalletConnect extends Connector {
  constructor (
    connectorOpts: IWalletConnectOptions,
    nodeJsOptions: INodeJSOptions
  ) {
    super({
      cryptoLib,
      connectorOpts,
      clientMeta: connectorOpts.clientMeta || nodeJsOptions.clientMeta,
      transportOpts,
      getNetMonitor
    })
    // logDeprecationWarning()
  }
}

export default NodeWalletConnect
