import EventEmitter from 'events'
import WalletConnect from '@walletconnect/browser'
import WCQRCode from '@walletconnect/qrcode-modal'
import { IWalletConnectConnectionOptions } from '@walletconnect/types'

// -- WalletConnectConnection --------------------------------------------- //

class WalletConnectConnection extends EventEmitter {
  public bridge: string = 'https://bridge.walletconnect.org'
  public qrcode: boolean = true
  public wc: WalletConnect | null = null
  public connected: boolean = false
  public closed: boolean = false

  constructor (opts: IWalletConnectConnectionOptions) {
    super()
    this.bridge = opts.bridge || 'https://bridge.walletconnect.org'
    this.qrcode = typeof opts.qrcode === 'undefined' || opts.qrcode !== false
    this.on('error', () => this.close())
  }
  public openQRCode () {
    const uri = this.wc ? this.wc.uri : ''
    if (uri) {
      WCQRCode.open(uri, () => {
        this.emit('error', new Error('User close WalletConnect QR Code modal'))
      })
    }
  }
  public create () {
    try {
      this.wc = new WalletConnect({ bridge: this.bridge })
    } catch (e) {
      this.emit('error', e)
      return
    }

    if (!this.wc.connected) {
      // Create new session
      this.wc
        .createSession()
        .then(() => {
          if (this.qrcode) {
            this.openQRCode()
          }
        })
        .catch((e: Error) => this.emit('error', e))
    } else {
      this.connected = true
      this.emit('connect')
    }

    this.wc.on('connect', (err: Error | null, payload: any) => {
      if (err) {
        this.emit('error', err)
        return
      }

      this.connected = true

      if (this.qrcode) {
        WCQRCode.close() // Close QR Code Modal
      }

      // Emit connect event
      this.emit('connect')
    })

    this.wc.on('disconnect', (err: Error | null, payload: any) => {
      if (err) {
        this.emit('error', err)
        return
      }

      this.onClose()
    })
  }
  public onClose () {
    this.wc = null
    this.connected = false
    this.closed = true
    this.emit('close')
    this.removeAllListeners()
  }
  public close () {
    if (this.wc) {
      this.wc.killSession()
    }
    this.onClose()
  }
  public error (payload: any, message: string, code = -1) {
    this.emit('payload', {
      id: payload.id,
      jsonrpc: payload.jsonrpc,
      error: { message, code }
    })
  }
  public async send (payload: any) {
    if (this.wc && this.wc.connected) {
      if (payload.method.includes('chan_')) {
        const response = await this.wc.unsafeSend(payload)
        this.emit('payload', response)
      } else {
        this.error(payload, 'HTTP Connection not available')
      }
    } else {
      this.error(payload, 'Not connected')
    }
  }
}

export default WalletConnectConnection
