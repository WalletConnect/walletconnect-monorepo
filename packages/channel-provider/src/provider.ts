import { IError } from '@walletconnect/types'
import { payloadId } from '@walletconnect/utils'
import EventEmitter from 'events'

import WalletConnectConnection from './connection'
import { ChannelProviderConfig, StorePair, ChannelProviderRpcMethod } from './types'

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
  // probably can remove the `| string` typing once 1.4.1 types package is
  // published, assuming no non-channel methods are sent to the `_send` fn
  public send = async (method: ChannelProviderRpcMethod | string, params: any = {}): Promise<any> => {
    let result
    switch (method) {
      case 'chan_storeSet':
        result = await this.set(params.pairs)
        break
      case 'chan_storeGet':
        result = await this.get(params.path)
        break
      case 'chan_nodeAuth':
        result = await this.signMessage(params.message)
        break
      case 'chan_config':
        result = this.config
        break
      case 'chan_restoreState':
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
    return this._send('chan_nodeAuth', { message })
  }

  /// ////////////////////////////////////////////
  /// // STORE METHODS

  public get = async (path: string): Promise<any> => {
    return this._send('chan_storeGet', {
      path
    })
  }

  public set = async (pairs: StorePair[], allowDelete?: Boolean): Promise<void> => {
    return this._send('chan_storeSet', {
      allowDelete,
      pairs
    })
  }

  public restoreState = async (path: string): Promise<void> => {
    return this._send('chan_restoreState', { path })
  }

  /// ////////////////////////////////////////////
  /// // PRIVATE METHODS

  // probably can remove the `| string` typing once 1.4.1 types package is
  // published, assuming no non-channel methods are sent to the `_send` fn
  // tslint:disable-next-line:function-name
  private async _send (method: ChannelProviderRpcMethod | string, params: any = {}): Promise<any> {
    const payload = { jsonrpc: '2.0', id: payloadId(), method, params }
    const { result } = await this.connection.send(payload)
    return result
  }
}

export default ChannelProvider
