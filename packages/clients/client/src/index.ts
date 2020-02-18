import Connector from '@walletconnect/core'
import qrcodeModal from '@walletconnect/qrcode-modal'
import SocketTransport from '@walletconnect/socket-transport'
import { IWalletConnectOptions, IPushServerOptions } from '@walletconnect/types'
import * as cryptoLib from './crypto'
import SessionStorage from './storage'

import * as netMonitor from './netMonitor'

const transportOpts = {
  initTransport: (opts: any) => new SocketTransport(opts),
  params: ['bridge', 'clientId']
}

const getNetMonitor =
  typeof window !== 'undefined' ? netMonitor.getNetMonitor : undefined

class WalletConnect extends Connector {
  constructor (
    connectorOpts: IWalletConnectOptions,
    pushServerOpts?: IPushServerOptions
  ) {
    super({
      cryptoLib,
      connectorOpts: {
        bridge: 'https://bridge.walletconnect.org',
        ...connectorOpts
      },
      sessionStorage: connectorOpts.storage || new SessionStorage(),
      qrcodeModal,
      pushServerOpts,
      transportOpts,
      getNetMonitor
    })
  }
}

export default WalletConnect
