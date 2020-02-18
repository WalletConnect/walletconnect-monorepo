import EventEmitter from 'events'
import WalletConnect from '@walletconnect/browser'
import WCQRCode from '@walletconnect/qrcode-modal'
import {
  IWCRpcConnection,
  IWCRpcConnectionOptions,
  IConnector
} from '@walletconnect/types'

class WCRpcConnection extends EventEmitter implements IWCRpcConnection {
  public bridge: string = 'https://bridge.walletconnect.org'
  public qrcode: boolean = true
  public chainId: number = 1

  public wc: IConnector | null = null
  public connected: boolean = false
  public closed: boolean = false

  constructor (opts?: IWCRpcConnectionOptions) {
    super()
    this.bridge = opts?.bridge || 'https://bridge.walletconnect.org'
    this.qrcode = typeof opts?.qrcode === 'undefined' || opts.qrcode !== false
    this.chainId = typeof opts?.chainId !== 'undefined' ? opts.chainId : 1
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

  public create (): void {
    try {
      this.wc = new WalletConnect({ bridge: this.bridge })
    } catch (e) {
      this.emit('error', e)
      return
    }

    if (!this.wc.connected) {
      this.wc
        .createSession({ chainId: this.chainId })
        .then(() => {
          if (this.qrcode) {
            this.openQRCode()
          }
        })
        .catch((e: Error) => this.emit('error', e))
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

  public onClose (): void {
    this.wc = null
    this.connected = false
    this.closed = true
    this.emit('close')
    this.removeAllListeners()
  }

  public open (): Promise<void> {
    return new Promise((resolve, reject): void => {
      this.on('error', err => {
        reject(err)
      })

      this.on('connect', () => {
        resolve()
      })

      this.create()
    })
  }

  public async close (): Promise<void> {
    if (this.wc) {
      this.wc.killSession()
    }
    this.onClose()
    return Promise.resolve()
  }

  public onError (payload: any, message: string, code: number = -1): void {
    this.emit('payload', {
      error: { message, code },
      id: payload.id,
      jsonrpc: payload.jsonrpc
    })
  }

  public async sendPayload (payload: any): Promise<any> {
    if (!this.wc || !this.wc.connected) {
      this.onError(payload, 'WalletConnect Not Connected')
      return
    }
    try {
      return this.wc.unsafeSend(payload)
    } catch (error) {
      this.onError(payload, error.message)
    }
  }

  public send (payload: any): Promise<any> {
    return this.sendPayload(payload)
  }
}

export default WCRpcConnection
