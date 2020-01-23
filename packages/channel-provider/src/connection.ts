import WalletConnect from '@walletconnect/browser'
import WCQRCode from '@walletconnect/qrcode-modal'
import { IWalletConnectConnectionOptions } from '@walletconnect/types'
import EventEmitter from 'events'
import { IRpcConnection } from './types'

// -- WalletConnectConnection --------------------------------------------- //

class WalletConnectConnection extends EventEmitter implements IRpcConnection {
  public bridge: string = 'https://bridge.walletconnect.org'
  public qrcode: boolean = true
  public wc: WalletConnect | null = null
  public connected: boolean = false
  public closed: boolean = false

  constructor (opts?: IWalletConnectConnectionOptions) {
    super()
    this.bridge =
      opts && opts.bridge ? opts.bridge : 'https://bridge.walletconnect.org'
    this.qrcode = opts
      ? typeof opts.qrcode === 'undefined' || opts.qrcode !== false
      : true
    this.on('error', () => this.close())
  }

  public openQRCode (): void {
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

  public close (): void {
    if (this.wc) {
      this.wc.killSession()
    }
    this.onClose()
  }

  public error (payload: any, message: string, code: number = -1): void {
    this.emit('payload', {
      error: { message, code },
      id: payload.id,
      jsonrpc: payload.jsonrpc
    })
  }

  public async send (payload: any): Promise<any> {
    return new Promise(
      async (resolve, reject): Promise<void> => {
        if (this.wc && this.wc.connected) {
          const response = await this.wc.unsafeSend(payload)
          resolve(response)
        }
        const errorMsg = 'WalletConnect Not Connected'
        this.error(payload, errorMsg)
        reject(new Error(errorMsg))
      }
    )
  }
}

export default WalletConnectConnection
