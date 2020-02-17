import Connector from '@walletconnect/core'
import { IWalletConnectOptions, INodeJSOptions } from '@walletconnect/types'
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
  }
}

export default NodeWalletConnect
