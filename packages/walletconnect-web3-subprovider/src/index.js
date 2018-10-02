import WalletConnect from 'walletconnect'

export default class WalletConnectSubprovider {
  constructor(opts) {
    const bridgeUrl = opts.bridgeUrl || null
    if (!bridgeUrl || typeof bridgeUrl !== 'string') {
      throw new Error('Missing or Invalid bridgeUrl field')
    }

    const dappName = opts.dappName || null
    if (!dappName || typeof dappName !== 'string') {
      throw new Error('Missing or Invalid dappName field')
    }

    this.webConnector = new WalletConnect(opts)
    this.initSession()
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
    return this.webConnector.isConnected
  }

  set uri(value) {
    return
  }

  get uri() {
    return this.webConnector.uri
  }

  set accounts(value) {
    return
  }

  get accounts() {
    return this.webConnector.accounts
  }

  setEngine(engine) {
    const self = this
    self.engine = engine
    engine.on('block', function(block) {
      self.currentBlock = block
    })
  }

  emitPayload(payload, cb) {
    const self = this
    const _payload = this.webConnector.createPayload(payload)
    self.engine.sendAsync(_payload, cb)
  }

  async initSession() {
    const session = await this.webConnector.initSession()
    return session
  }

  async getAccounts() {
    const accounts = await this.walletconnect.getAccounts()
    return accounts
  }

  async listenSessionStatus() {
    const result = await this.webConnector.listenSessionStatus()
    return result
  }

  handleRequest(payload, next, end) {
    this.provider.sendAsync(payload, function(err, response) {
      if (err) return end(err)
      if (response.error) return end(new Error(response.error.message))
      end(null, response.result)
    })
    const supportedMethods = [
      'eth_accounts',
      'eth_signTransaction',
      'eth_sendTransaction',
      'eth_sendRawTransaction',
      'eth_sign',
      'eth_signTypedData',
      'personal_sign'
    ]
    if (this.webConnector.isConnected) {
      if (payload.method === 'eth_accounts') {
        this.getAccounts()
          .then(accounts => {
            end(null, accounts)
          })
          .catch(err => end(err))
      } else if (supportedMethods.includes(payload.method)) {
        this.webConnector
          .createCall(payload)
          .then(result => end(null, result))
          .catch(err => end(err))
      } else {
        next(payload)
      }
    } else {
      throw new Error('WalletConnect connection is not established')
    }
  }
}
