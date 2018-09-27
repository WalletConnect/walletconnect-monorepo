import WalletConnect from 'walletconnect'
import Subprovider from 'web3-provider-engine/subproviders/subprovider'
import { toggleQRCode } from './qrcode'

class WalletConnectSubprovider extends Subprovider {
  constructor(opts) {
    super()

    const bridgeUrl = opts.bridgeUrl || null
    if (!bridgeUrl || typeof bridgeUrl !== 'string') {
      throw new Error('Missing or Invalid bridgeUrl field')
    }

    const dappName = opts.dappName || null
    if (!dappName || typeof dappName !== 'string') {
      throw new Error('Missing or Invalid dappName field')
    }

    this.bridgeUrl = bridgeUrl
    this.dappName = dappName
    this.isWalletConnect = true

    this.webConnector = new WalletConnect({
      bridgeUrl: this.bridgeUrl,
      dappName: this.dappName
    })
  }

  async initSession() {
    let accounts = null

    const session = await this.webConnector.initSession()

    if (session.new) {
      const { uri } = session

      await toggleQRCode(uri)

      const sessionStatus = await this.webConnector.listenSessionStatus()

      accounts = sessionStatus.data
    } else {
      accounts = session.accounts
    }

    return accounts
  }

  handleRequest(payload, next, end) {
    this.provider.sendAsync(payload, function(err, response) {
      if (err) return end(err)
      if (response.error) return end(new Error(response.error.message))
      end(null, response.result)
    })
    const supportedMethods = [
      'eth_sendTransaction',
      'eth_sendRawTransaction',
      'eth_sign',
      'eth_signTypedData',
      'personal_sign'
    ]
    if (payload.method === 'eth_accounts') {
      this.initSession()
        .then(accounts => end(null, accounts))
        .catch(err => end(err))
    } else if (supportedMethods.includes(payload.method)) {
      if (this.webConnector) {
        this.webConnector
          .createCall(payload)
          .then(result => end(null, result))
          .catch(err => end(err))
      } else {
        throw new Error('WalletConnect connection is not established')
      }
    } else {
      next(payload)
    }
  }
}

export default WalletConnectSubprovider
