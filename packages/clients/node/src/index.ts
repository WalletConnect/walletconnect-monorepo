import Connector from '@walletconnect/core'
import { IWalletConnectOptions, INodeJSOptions } from '@walletconnect/types'
// import { logDeprecationWarning } from '@walletconnect/utils'
import * as cryptoLib from './nodeCrypto'

class NodeWalletConnect extends Connector {
  constructor (
    connectorOpts: IWalletConnectOptions,
    nodeJsOptions: INodeJSOptions
  ) {
    super({
      cryptoLib,
      connectorOpts,
      clientMeta: connectorOpts.clientMeta || nodeJsOptions.clientMeta
    })
    // logDeprecationWarning()
  }
}

export default NodeWalletConnect
