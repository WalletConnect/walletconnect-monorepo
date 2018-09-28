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

    this.isWalletConnect = true

    this.walletConnect = new WalletConnect(opts)
    this.initSession()
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
    const _payload = this.walletConnect.createPayload(payload)
    self.engine.sendAsync(_payload, cb)
  }

  async initSession() {
    const session = await this.walletConnect.initSession()
    return session
  }

  async getAccounts() {
    const accounts = await this.walletconnect.getAccounts()
    return accounts
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
    if (this.walletConnect.connected) {
      if (payload.method === 'eth_accounts') {
        this.getAccounts()
        .then(accounts => {
          end(null, accounts)
        })
        .catch(err => end(err))
      } else if (supportedMethods.includes(payload.method)) {
        this.walletConnect
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
