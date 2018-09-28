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

    this.webConnector = new WalletConnect(opts)
  }

  async initSession() {
    const session = await this.webConnector.initSession()
    return session
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
    if (this.webConnector.sessionId) {
      const accounts = this.webConnector.accounts
      if (payload.method === 'eth_accounts' && accounts.length) {
        end(null, accounts)
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
