import Connector from '@walletconnect/core'
import { IWalletConnectOptions } from '@walletconnect/types'
import SocketTransport from '@walletconnect/socket-transport'
// import { logDeprecationWarning } from '@walletconnect/utils'
import * as cryptoLib from './webCrypto'
import WebStorage from './webStorage'
import { getNetMonitor } from './webNetMonitor'

const transportOpts = {
  initTransport: (opts: any) => new SocketTransport(opts),
  params: ['bridge', 'clientId']
}

class WalletConnect extends Connector {
  constructor (opts: IWalletConnectOptions) {
    super(
      cryptoLib,
      opts,
      transportOpts,
      WebStorage,
      opts.clientMeta,
      null,
      getNetMonitor
    )
    // logDeprecationWarning()
  }
}

export default WalletConnect
