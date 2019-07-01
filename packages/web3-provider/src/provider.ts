import EventEmitter from 'events'
import {
  payloadId,
  isJsonRpcSubscription,
  isJsonRpcRequest,
  isJsonRpcResponseSuccess,
  isJsonRpcResponseError
} from '@walletconnect/utils'
import { IJsonRpcRequest, IError, JsonRpc } from '@walletconnect/types'

// -- types ---------------------------------------------------------------- //

interface IPromisesMap {
  [id: number]: { resolve: (res: any) => void; reject: (err: any) => void }
}

interface IConnection extends EventEmitter {
  send: (payload: IJsonRpcRequest) => void
  close: () => void
}

// -- EthereumProvider ---------------------------------------------------- //

class EthereumProvider extends EventEmitter {
  public connected: boolean = false
  public promises: IPromisesMap = {}
  public subscriptions: number[] = []
  public connection: IConnection
  public accounts: string[] = []
  public coinbase: string = ''
  public attemptedNetworkSubscription: boolean = false
  public attemptedChainSubscription: boolean = false
  public attemptedAccountsSubscription: boolean = false

  constructor (connection: IConnection) {
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
      } else if (event === 'accountsChanged') {
        if (!this.attemptedAccountsSubscription && this.connected) {
          this.startAccountsSubscription()
        }
      }
    })
  }
  async onConnectionPayload (payload: JsonRpc) {
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
  async checkConnection () {
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
  async startNetworkSubscription () {
    this.attemptedNetworkSubscription = true
    try {
      let networkChanged = await this.subscribe(
        'eth_subscribe',
        'networkChanged'
      )
      this.on(networkChanged, netId => this.emit('networkChanged', netId))
    } catch (e) {
      console.warn('Unable to subscribe to networkChanged', e)
    }
  }
  async startChainSubscription () {
    this.attemptedChainSubscription = true
    try {
      let chainChanged = await this.subscribe('eth_subscribe', 'chainChanged')
      this.on(chainChanged, chainId => this.emit('chainChanged', chainId))
    } catch (e) {
      console.warn('Unable to subscribe to chainChanged', e)
    }
  }
  async startAccountsSubscription () {
    this.attemptedAccountsSubscription = true
    try {
      let accountsChanged = await this.subscribe(
        'eth_subscribe',
        'accountsChanged'
      )
      this.on(accountsChanged, accounts =>
        this.emit('accountsChanged', accounts)
      )
    } catch (e) {
      console.warn('Unable to subscribe to accountsChanged', e)
    }
  }
  enable () {
    return new Promise((resolve, reject) => {
      this._send('eth_accounts')
        .then((accounts: string[]) => {
          if (accounts.length > 0) {
            this.accounts = accounts
            this.coinbase = accounts[0]
            this.emit('enable')
            resolve(accounts)
          } else {
            const err: IError = new Error('User Denied Full Provider')
            err.code = 4001
            reject(err)
          }
        })
        .catch(reject)
    })
  }
  _send (method?: string, params: any[] = []) {
    if (!method || typeof method !== 'string') {
      throw new Error('Method is not a valid string.')
    }
    if (!(params instanceof Array)) {
      throw new Error('Params is not a valid array.')
    }
    const payload = { jsonrpc: '2.0', id: payloadId(), method, params }
    const promise: Promise<any> = new Promise((resolve, reject) => {
      this.promises[payload.id] = { resolve, reject }
    })
    this.connection.send(payload)
    return promise
  }
  send () {
    // Send can be clobbered, proxy sendPromise for backwards compatibility
    return this._send(...arguments)
  }
  _sendBatch (requests: JsonRpc[]) {
    return Promise.all(
      requests.map(payload => {
        if (isJsonRpcRequest(payload)) {
          this._send(payload.method, payload.params)
        }
      })
    )
  }
  subscribe (type: string, method: string, params: any[] = []) {
    return this._send(type, [method, ...params]).then(id => {
      this.subscriptions.push(id)
      return id
    })
  }
  unsubscribe (type: string, id: number) {
    return this._send(type, [id]).then(success => {
      if (success) {
        this.subscriptions = this.subscriptions.filter(_id => _id !== id) // Remove subscription
        this.removeAllListeners(String(id)) // Remove listeners
        return success
      }
    })
  }
  sendAsync (payload: JsonRpc, cb: any) {
    // Backwards Compatibility
    if (!cb || typeof cb !== 'function') {
      return cb(
        new Error('Invalid or undefined callback provided to sendAsync')
      )
    }
    if (!payload) return cb(new Error('Invalid Payload'))
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
  sendAsyncBatch (requests: JsonRpc[], cb: any) {
    return this._sendBatch(requests)
      .then(results => {
        let result = results.map((entry, index) => {
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
  isConnected () {
    // Backwards Compatibility
    return this.connected
  }
  close () {
    this.connection.close()
    this.connected = false
    let error = new Error(
      `Provider closed, subscription lost, please subscribe again.`
    )
    this.subscriptions.forEach(id => this.emit(String(id), error)) // Send Error objects to any open subscriptions
    this.subscriptions = [] // Clear subscriptions
  }
}

module.exports = EthereumProvider
