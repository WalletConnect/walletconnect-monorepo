import Connector from '@walletconnect/core'
import {
  IWalletConnectOptions,
  INativeWalletOptions
} from '@walletconnect/types'
import SocketTransport from '@walletconnect/socket-transport'
// import { logDeprecationWarning } from '@walletconnect/utils'
import * as cryptoLib from './rnCrypto'
import { getNetMonitor } from './rnNetMonitor'

const transportOpts = {
  initTransport: (opts: any) => new SocketTransport(opts),
  params: ['bridge', 'clientId']
}

class RNWalletConnect extends Connector {
  constructor (
    connectorOpts: IWalletConnectOptions,
    walletOptions: INativeWalletOptions
  ) {
    super({
      cryptoLib,
      connectorOpts,
      clientMeta: connectorOpts.clientMeta || walletOptions.clientMeta,
      pushServerOpts: walletOptions.push || undefined,
      transportOpts,
      getNetMonitor
    })
    // logDeprecationWarning()
  }
}

export default RNWalletConnect
