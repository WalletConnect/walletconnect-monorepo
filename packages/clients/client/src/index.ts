import Connector from '@walletconnect/core'
import qrcodeModal from '@walletconnect/qrcode-modal'
import { IWalletConnectOptions, IPushServerOptions } from '@walletconnect/types'
import * as cryptoLib from './crypto'
import SessionStorage from './storage'
import { registerPushServer } from './push'

class WalletConnect extends Connector {
  constructor (opts: IWalletConnectOptions, pushOpts?: IPushServerOptions) {
    super(
      cryptoLib,
      { bridge: 'https://bridge.walletconnect.org', ...opts },
      null,
      opts.storage || new SessionStorage(),
      opts.clientMeta,
      qrcodeModal
    )
    if (pushOpts) {
      registerPushServer(this, pushOpts)
    }
  }
}

export default WalletConnect
