import { IError } from '@walletconnect/types'
import { payloadId } from '@walletconnect/utils'
import EventEmitter from 'events'

import WalletConnectConnection from './connection'
import { ChannelProviderConfig, NewRpcMethodName, StorePair } from './types'

class ChannelProvider extends EventEmitter {
  public connected: boolean = false
  public connection: WalletConnectConnection

  // tslint:disable-next-line:variable-name
  private _config: ChannelProviderConfig | undefined = undefined
  private _multisigAddress: string | undefined = undefined // tslint:disable-line:variable-name
  private _signerAddress: string | undefined = undefined // tslint:disable-line:variable-name

  constructor (connection: WalletConnectConnection) {
    super()
    this.connection = connection
  }

  public enable (): Promise<ChannelProviderConfig> {
    return new Promise((resolve, reject): void => {
      this.connection.on('close', () => {
        this.connected = false
        this.emit('close')
      })

      this.connection.on('connect', () => {
        try {
          this._send('chan_config')
            .then((config: ChannelProviderConfig): void => {
              if (Object.keys(config).length > 0) {
                this.connected = true
                this._config = config
                this._multisigAddress = config.multisigAddress
                this._signerAddress = config.signerAddress
                this.emit('connect')
                resolve(config)
              } else {
                const err: IError = new Error('User Denied Channel Config')
                err.code = 4001
                this.connected = false
                this.connection.close()
                reject(err)
              }
            })
            .catch(reject)
        } catch (e) {
          this.connected = false
          this.connection.close()
          reject(e)
        }
      })

      this.connection.create()
    })
  }
  public send = async (method: string, params: any = {}): Promise<any> => {
    let result
    switch (method) {
      case NewRpcMethodName.STORE_SET:
        result = await this.set(params.pairs)
        break
      case NewRpcMethodName.STORE_GET:
        result = await this.get(params.path)
        break
      case NewRpcMethodName.NODE_AUTH:
        result = await this.signMessage(params.message)
        break
      case NewRpcMethodName.CONFIG:
        result = this.config
        break
      case NewRpcMethodName.RESTORE_STATE:
        result = await this.restoreState(params.path)
        break
      default:
        result = await this._send(method, params)
        break
    }
    return result
  }

  public close (): void {
    this.connection.close()
    this.connected = false
  }

  /// ///////////////
  /// // GETTERS / SETTERS

  get config (): ChannelProviderConfig | undefined {
    return this._config
  }

  get multisigAddress (): string | undefined {
    const multisigAddress =
      this._multisigAddress || (this._config ? this._config.multisigAddress : undefined)
    return multisigAddress
  }

  set multisigAddress (multisigAddress: string | undefined) {
    if (this._config) {
      this._config.multisigAddress = multisigAddress
    }
    this._multisigAddress = multisigAddress
  }

  get signerAddress (): string | undefined {
    return this._signerAddress
  }

  set signerAddress (signerAddress: string | undefined) {
    this._signerAddress = signerAddress
  }

  /// ////////////////////////////////////////////
  /// // LISTENER METHODS

  public on = (event: string, listener: (...args: any[]) => void): any => {
    // dumb clients don't require listeners
  }

  public once = (event: string, listener: (...args: any[]) => void): any => {
    // dumb clients don't require listeners
  }

  /// ////////////////////////////////////////////
  /// // SIGNING METHODS

  public signMessage = async (message: string): Promise<string> => {
    return this._send(NewRpcMethodName.NODE_AUTH as any, { message })
  }

  /// ////////////////////////////////////////////
  /// // STORE METHODS

  public get = async (path: string): Promise<any> => {
    return this._send(NewRpcMethodName.STORE_GET, {
      path
    })
  }

  public set = async (pairs: StorePair[], allowDelete?: Boolean): Promise<void> => {
    return this._send(NewRpcMethodName.STORE_SET, {
      allowDelete,
      pairs
    })
  }

  public restoreState = async (path: string): Promise<void> => {
    return this._send(NewRpcMethodName.RESTORE_STATE, { path })
  }

  /// ////////////////////////////////////////////
  /// // PRIVATE METHODS

  // tslint:disable-next-line:function-name
  private async _send (method: string, params: any = {}): Promise<any> {
    const payload = { jsonrpc: '2.0', id: payloadId(), method, params }
    const { result } = await this.connection.send(payload)
    return result
  }
}

export default ChannelProvider
