import Connector from '@walletconnect/core'
import qrcodeModal from '@walletconnect/qrcode-modal'
import SocketTransport from '@walletconnect/socket-transport'
import { IWalletConnectOptions, IPushServerOptions } from '@walletconnect/types'
import * as cryptoLib from './crypto'
import SessionStorage from './storage'
import { registerPushServer } from './push'

import * as netMonitor from './netMonitor'

const transportOpts = {
  initTransport: (opts: any) => new SocketTransport(opts),
  params: ['bridge', 'clientId']
}

const getNetMonitor =
  typeof window !== 'undefined' ? netMonitor.getNetMonitor : undefined

class WalletConnect extends Connector {
  constructor (opts: IWalletConnectOptions, pushOpts?: IPushServerOptions) {
    super(
      cryptoLib,
      { bridge: 'https://bridge.walletconnect.org', ...opts },
      transportOpts,
      opts.storage || new SessionStorage(),
      opts.clientMeta,
      qrcodeModal,
      getNetMonitor
    )
    if (pushOpts) {
      registerPushServer(this, pushOpts)
    }
  }
}

export default WalletConnect
