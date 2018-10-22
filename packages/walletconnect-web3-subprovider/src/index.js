import WalletConnect from 'walletconnect'
import Subprovider from './subprovider'

export default class WalletConnectSubprovider extends Subprovider {
  constructor(opts) {
    super()

    this._walletconnect = new WalletConnect(opts)
  }

  set isWalletConnect(value) {
    return
  }

  get isWalletConnect() {
    return true
  }

  set isConnected(value) {
    return
  }

  get isConnected() {
    return this._walletconnect.isConnected
  }

  set uri(value) {
    return
  }

  get uri() {
    return this._walletconnect.uri
  }

  set accounts(value) {
    return
  }

  get accounts() {
    return this._walletconnect.accounts
  }

  async initSession() {
    const result = await this._walletconnect.initSession()
    return result
  }

  async listenSessionStatus() {
    const result = await this._walletconnect.listenSessionStatus()
    return result
  }

  stopLastListener() {
    const result = this._walletconnect.stopLastListener()
    return result
  }


  setEngine(engine) {
    this.engine = engine
    this.engine.walletconnect = this
    this.engine.isWalletConnect = this.isWalletConnect
  }

  async handleRequest(payload, next, end) {
    switch (payload.method) {
      case 'eth_accounts':
        end(null, this.accounts)
        return
      case 'eth_signTransaction':
      case 'eth_sendTransaction':
      case 'eth_sendRawTransaction':
      case 'eth_sign':
      case 'eth_signTypedData':
      case 'eth_signTypedData_v3':
      case 'personal_sign':
        try {
          const result = await this._walletconnect.createCallRequest(payload)
          end(null, result)
        } catch (err) {
          end(err)
        }
        return
      default:
        next()
        return
    }
  }
  sendAsync(payload, callback) {
    const next = () => {
      const sendAsync = this.engine.sendAsync.bind(this)
      sendAsync(payload, callback)
    }
    const end = (err, data) => {
      return err ? callback(err) : callback(null, { ...payload, result: data })
    }
    this.handleRequest(payload, next, end)
  }
}
