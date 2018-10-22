import WalletConnect from 'walletconnect'
import Subprovider from './subprovider'

export default class WalletConnectSubprovider extends Subprovider {
  constructor(opts) {
    super()

    this._walletconnect = new WalletConnect(opts)
    this.session = this.initSession()
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
    return this._getUri()
  }

  async _getUri() {
    await this.session
    return this._walletconnect.uri
  }

  set accounts(value) {
    return
  }

  get accounts() {
    return this._walletconnect.accounts
  }

  async initSession() {
    return this._walletconnect.initSession()
  }

  async listenSessionStatus(interval=800, timeout=30000) {
    await this.session
    return this._walletconnect.listenSessionStatus(interval, timeout)
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
        try {
          const accounts = await this._walletconnect.getAccounts()
            end(null, accounts)
          } catch (err) {
            end(null, [])
          }
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
      const sendAsync = this._walletconnect.sendAsync.bind(this)
      sendAsync(payload, callback)
    }
    const end = (err, data) => {
      return err ? callback(err) : callback(null, { ...payload, result: data })
    }
    this.handleRequest(payload, next, end)
  }
}
