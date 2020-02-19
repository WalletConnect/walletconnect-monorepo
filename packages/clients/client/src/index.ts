import Connector from '@walletconnect/core'
import qrcodeModal from '@walletconnect/qrcode-modal'
import { IWalletConnectOptions, IPushServerOptions } from '@walletconnect/types'
import * as cryptoLib from './crypto'
import SessionStorage from './storage'

class WalletConnect extends Connector {
  constructor (
    connectorOpts: IWalletConnectOptions,
    pushServerOpts?: IPushServerOptions
  ) {
    super({
      cryptoLib,
      connectorOpts,
      sessionStorage: connectorOpts.storage || new SessionStorage(),
      qrcodeModal,
      pushServerOpts
    })
  }
}

export default WalletConnect
