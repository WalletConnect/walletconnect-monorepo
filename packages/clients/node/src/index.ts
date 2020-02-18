import Connector from '@walletconnect/core'
import { IWalletConnectOptions, INodeJSOptions } from '@walletconnect/types'
// import { logDeprecationWarning } from '@walletconnect/utils'
import * as cryptoLib from './nodeCrypto'

class NodeWalletConnect extends Connector {
  constructor (opts: IWalletConnectOptions, nodeJsOptions: INodeJSOptions) {
    super(
      cryptoLib,
      opts,
      null,
      null,
      opts.clientMeta || nodeJsOptions.clientMeta
    )
    // logDeprecationWarning()
  }
}

export default NodeWalletConnect
