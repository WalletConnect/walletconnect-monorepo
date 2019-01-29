import WalletConnect from '@walletconnect/browser'
import Subprovider from './subprovider'
import {
  ICallback,
  IWeb3Provider,
  IJsonRpcRequest,
  IErrorCallback,
  IJsonRpcCallback
} from '@walletconnect/types'

export default class WalletConnectSubprovider extends Subprovider {
  private _walletConnector: any

  constructor (opts: any) {
    super()

    this._walletConnector = new WalletConnect(opts)
  }

  set isWalletConnect (value) {}

  get isWalletConnect () {
    return true
  }

  set connected (value) {}

  get connected () {
    return this._walletConnector.connected
  }

  set uri (value) {}

  get uri () {
    return this._walletConnector.uri
  }

  set accounts (value) {}

  get accounts () {
    return this._walletConnector.accounts
  }

  async createSession () {
    const result = await this._walletConnector.createSession()
    return result
  }

  setEngine (engine: IWeb3Provider) {
    this.engine = engine
  }

  async handleRequest (
    payload: IJsonRpcRequest,
    next: ICallback,
    end: IErrorCallback
  ) {
    switch (payload.method) {
      case 'eth_accounts':
        end(null, this.accounts)
        return
      case 'eth_signTransaction':
      case 'eth_sendTransaction':
      case 'eth_sendRawTransaction':
      case 'eth_sign':
      case 'eth_signTypedData':
      case 'eth_signTypedData_v1':
      case 'eth_signTypedData_v3':
      case 'personal_sign':
        try {
          const result = await this._walletConnector._sendCallRequest(payload)
          end(null, result.result)
        } catch (err) {
          end(err)
        }
        return
      default:
        next()
    }
  }
  sendAsync (payload: IJsonRpcRequest, callback: IJsonRpcCallback) {
    const next = () => {
      const sendAsync = this.engine.sendAsync.bind(this)
      sendAsync(payload, callback)
    }
    const end = (err: Error | null, data?: any) => {
      return err ? callback(err) : callback(null, { ...payload, result: data })
    }
    this.handleRequest(payload, next, end)
  }
}
