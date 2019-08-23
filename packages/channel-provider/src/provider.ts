import EventEmitter from 'events'
import {
  payloadId,
  isJsonRpcSubscription,
  isJsonRpcRequest,
  isJsonRpcResponseSuccess,
  isJsonRpcResponseError
} from '@walletconnect/utils'
import { IError, JsonRpc } from '@walletconnect/types'
import WalletConnectConnection from './connection'

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
  public attemptedNetworkSubscription: boolean = false
  public attemptedChainSubscription: boolean = false
  public attemptedAccountsSubscription: boolean = false
  public config: any

  constructor (connection: WalletConnectConnection) {
    super()
    this.connection = connection
    this.connection.on('connect', () => this.checkConnection())
    this.connection.on('close', () => this.emit('close'))
    this.connection.on('payload', this.onConnectionPayload)
    this.on('newListener', (event, listener) => {
      if (event === 'networkChanged') {
        if (!this.attemptedNetworkSubscription && this.connected) {
          this.startNetworkSubscription()
        }
      } else if (event === 'chainChanged') {
        if (!this.attemptedChainSubscription && this.connected) {
          this.startChainSubscription()
        }
      } else if (event === 'accountsChanged') {
        if (!this.attemptedAccountsSubscription && this.connected) {
          this.startAccountsSubscription()
        }
      }
    })
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
  public async checkConnection () {
    try {
      this.emit('connect', await this._send('net_version'))
      this.connected = true

      if (
        this.listenerCount('networkChanged') &&
        !this.attemptedNetworkSubscription
      ) {
        this.startNetworkSubscription()
      }

      if (
        this.listenerCount('chainChanged') &&
        !this.attemptedAccountsSubscription
      ) {
        this.startAccountsSubscription()
      }

      if (
        this.listenerCount('accountsChanged') &&
        !this.attemptedAccountsSubscription
      ) {
        this.startAccountsSubscription()
      }
    } catch (e) {
      this.connected = false
    }
  }
  public async startNetworkSubscription () {
    this.attemptedNetworkSubscription = true
    try {
      const networkChanged = await this.subscribe(
        'eth_subscribe',
        'networkChanged'
      )
      this.on(networkChanged, netId => this.emit('networkChanged', netId))
    } catch (e) {
      console.warn('Unable to subscribe to networkChanged', e) // tslint:disable-line
    }
  }
  public async startChainSubscription () {
    this.attemptedChainSubscription = true
    try {
      const chainChanged = await this.subscribe('eth_subscribe', 'chainChanged')
      this.on(chainChanged, chainId => this.emit('chainChanged', chainId))
    } catch (e) {
      console.warn('Unable to subscribe to chainChanged', e) // tslint:disable-line
    }
  }
  public async startAccountsSubscription () {
    this.attemptedAccountsSubscription = true
    try {
      const accountsChanged = await this.subscribe(
        'eth_subscribe',
        'accountsChanged'
      )
      this.on(accountsChanged, accounts =>
        this.emit('accountsChanged', accounts)
      )
    } catch (e) {
      console.warn('Unable to subscribe to accountsChanged', e) // tslint:disable-line
    }
  }
  public enable () {
    return new Promise((resolve, reject) => {
      this._send('chan_config')
        .then(config => {
          if (config.length > 0) {
            this.config = config
            resolve(config)
          } else {
            const err: IError = new Error('User Denied Channel Config')
            err.code = 4001
            reject(err)
          }
        })
        .catch(reject)
    })
  }
  public _send (method?: string, params?: any) {
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
  public send () {
    // Send can be clobbered, proxy sendPromise for backwards compatibility
    return this._send(...(arguments as any))
  }
  public _sendBatch (requests: JsonRpc[]) {
    return Promise.all(
      requests.map(payload => {
        if (isJsonRpcRequest(payload)) {
          this._send(payload.method, payload.params)
        }
      })
    )
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
  public sendAsync (payload: JsonRpc, cb: any) {
    // Backwards Compatibility
    if (!cb || typeof cb !== 'function') {
      return cb(
        new Error('Invalid or undefined callback provided to sendAsync')
      )
    }
    if (!payload) {
      return cb(new Error('Invalid Payload'))
    }
    // sendAsync can be called with an array for batch requests used by web3.js 0.x
    // this is not part of EIP-1193's backwards compatibility but we still want to support it
    if (payload instanceof Array) {
      return this.sendAsyncBatch(payload, cb)
    } else if (isJsonRpcRequest(payload)) {
      return this._send(payload.method, payload.params)
        .then(result => {
          cb(null, { id: payload.id, jsonrpc: payload.jsonrpc, result })
        })
        .catch(err => {
          cb(err)
        })
    }
  }
  public sendAsyncBatch (requests: JsonRpc[], cb: any) {
    return this._sendBatch(requests)
      .then(results => {
        const result = results.map((entry, index) => {
          return {
            id: requests[index].id,
            jsonrpc: requests[index].jsonrpc,
            result: entry
          }
        })
        cb(null, result)
      })
      .catch(err => {
        cb(err)
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
}

export default ChannelProvider
