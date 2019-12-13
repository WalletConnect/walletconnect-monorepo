import EventEmitter from 'events'
import {
  payloadId,
  isJsonRpcSubscription,
  isJsonRpcResponseSuccess,
  isJsonRpcResponseError
} from '@walletconnect/utils'
import { IError, JsonRpc } from '@walletconnect/types'
import WalletConnectConnection from './connection'
import { ChannelProviderConfig, NewRpcMethodName, StorePair } from './types'

// -- types ---------------------------------------------------------------- //

interface IPromisesMap {
  [id: number]: { resolve: (res: any) => void; reject: (err: any) => void }
}

// -- ChannelProvider ---------------------------------------------------- //

class ChannelProvider extends EventEmitter {
  public connected: boolean = false
  public promises: IPromisesMap = {}
  public subscriptions: number[] = []
  public connection: WalletConnectConnection
  private _config: ChannelProviderConfig | undefined = undefined // tslint:disable-line:variable-name
  private _multisigAddress: string | undefined = undefined // tslint:disable-line:variable-name
  private _signerAddress: string | undefined = undefined // tslint:disable-line:variable-name

  constructor (connection: WalletConnectConnection) {
    super()
    this.connection = connection
  }
  public async onConnectionPayload (payload: JsonRpc) {
    const { id } = payload
    if (typeof id !== 'undefined') {
      if (this.promises[id]) {
        if (isJsonRpcResponseError(payload)) {
          this.promises[id].reject(payload.error)
        } else if (isJsonRpcResponseSuccess(payload)) {
          this.promises[id].resolve(payload.result)
        }
        delete this.promises[id]
      }
    } else if (isJsonRpcSubscription(payload)) {
      if (payload.method && payload.method.indexOf('_subscription') > -1) {
        // Emit subscription result
        this.emit(payload.params.subscription, payload.params.result)
        this.emit(payload.method, payload.params) // Latest EIP-1193
        this.emit('data', payload) // Backwards Compatibility
      }
    }
  }
  public enable () {
    return new Promise((resolve, reject) => {
      this.connection.on('close', () => {
        this.connected = false
        this.emit('close')
      })
      this.connection.on('payload', this.onConnectionPayload.bind(this))

      this.connection.on('connect', () => {
        try {
          this._send('chan_config')
            .then(config => {
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
  public _send (method?: string, params: any = {}) {
    if (!method || typeof method !== 'string') {
      throw new Error('Method is not a valid string.')
    }
    if (!(params instanceof Object)) {
      throw new Error('Params is not a valid object.')
    }
    const payload = { jsonrpc: '2.0', id: payloadId(), method, params }
    const promise: Promise<any> = new Promise((resolve, reject) => {
      this.promises[payload.id] = { resolve, reject }
    })
    this.connection.send(payload)
    return promise
  }
  public send = async (method: string, params: any = {}): Promise<any> => {
    let result
    console.log('[ChannelProvider]', '[send]', 'method', '=>', method)
    console.log('[ChannelProvider]', '[send]', 'params', '=>', params)
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
    console.log('[ChannelProvider]', '[send]', 'result', '=>', result)
    return result
  }

  public subscribe (type: string, method: string, params: any[] = []) {
    return this._send(type, [method, ...params]).then(id => {
      this.subscriptions.push(id)
      return id
    })
  }

  public unsubscribe (type: string, id: number) {
    return this._send(type, [id]).then(success => {
      if (success) {
        this.subscriptions = this.subscriptions.filter(_id => _id !== id) // Remove subscription
        this.removeAllListeners(String(id)) // Remove listeners
        return success
      }
    })
  }

  public isConnected () {
    // Backwards Compatibility
    return this.connected
  }
  public close () {
    this.connection.close()
    this.connected = false
    const error = new Error(
      `Provider closed, subscription lost, please subscribe again.`
    )
    this.subscriptions.forEach(id => this.emit(String(id), error)) // Send Error objects to any open subscriptions
    this.subscriptions = [] // Clear subscriptions
  }

  /// ///////////////
  /// // GETTERS / SETTERS
  get config (): ChannelProviderConfig | undefined {
    console.log(
      '[ChannelProvider]',
      '[get config()]',
      'this._config',
      '=>',
      this._config
    )
    return this._config
  }

  get multisigAddress (): string | undefined {
    const multisigAddress =
      this._multisigAddress ||
      (this._config ? this._config.multisigAddress : undefined)
    console.log(
      '[ChannelProvider]',
      '[get multisigAddress()]',
      'multisigAddress',
      '=>',
      multisigAddress
    )
    return multisigAddress
  }

  set multisigAddress (multisigAddress: string | undefined) {
    console.log(
      '[ChannelProvider]',
      '[set multisigAddress()]',
      'multisigAddress',
      '=>',
      multisigAddress
    )
    if (this._config) {
      this._config.multisigAddress = multisigAddress
    }
    this._multisigAddress = multisigAddress
  }

  get signerAddress (): string | undefined {
    console.log(
      '[ChannelProvider]',
      '[get signerAddress()]',
      'this._signerAddress',
      '=>',
      this._signerAddress
    )
    return this._signerAddress
  }

  set signerAddress (signerAddress: string | undefined) {
    console.log(
      '[ChannelProvider]',
      '[set signerAddress()]',
      'signerAddress',
      '=>',
      signerAddress
    )
    this._signerAddress = signerAddress
  }

  /// ////////////////////////////////////////////
  /// // LISTENER METHODS
  public on = (event: string, listener: (...args: any[]) => void): any => {
    this.connection.on(event, listener)
    return this.connection
  }

  public once = (event: string, listener: (...args: any[]) => void): any => {
    this.connection.once(event, listener)
    return this.connection
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

  public set = async (
    pairs: StorePair[],
    allowDelete?: Boolean
  ): Promise<void> => {
    return this._send(NewRpcMethodName.STORE_SET, {
      allowDelete,
      pairs
    })
  }

  public restoreState = async (path: string): Promise<void> => {
    return this._send(NewRpcMethodName.RESTORE_STATE, { path })
  }
}

export default ChannelProvider
