import WalletConnect from '@walletconnect/browser'
import HookedWalletSubprovider from 'web3-provider-engine/subproviders/hooked-wallet'

export default class WalletConnectSubprovider extends HookedWalletSubprovider {
  constructor (opts) {
    super({
      getAccounts: async cb => {
        const walletConnector = await this.getWalletConnector()
        const accounts = walletConnector.accounts
        if (accounts && accounts.length) {
          cb(null, accounts)
        }
        cb(new Error('Failed to get accounts'))
      },
      sendTransaction: async (txParams, cb) => {
        const walletConnector = await this.getWalletConnector()
        try {
          const result = await walletConnector.sendTransaction(txParams)
          cb(null, result)
        } catch (error) {
          cb(error)
        }
      },
      signTransaction: async (txParams, cb) => {
        const walletConnector = await this.getWalletConnector()
        try {
          const result = await walletConnector.signTransaction(txParams)
          cb(null, result)
        } catch (error) {
          cb(error)
        }
      },
      signMessage: async (msgParams, cb) => {
        const walletConnector = await this.getWalletConnector()
        try {
          const result = await walletConnector.signMessage(msgParams)
          cb(null, result)
        } catch (error) {
          cb(error)
        }
      },
      signPersonalMessage: async (msgParams, cb) => {
        const walletConnector = await this.getWalletConnector()
        try {
          const result = await walletConnector.signPersonalMessage(msgParams)
          cb(null, result)
        } catch (error) {
          cb(error)
        }
      },
      signTypedMessage: async (msgParams, cb) => {
        const walletConnector = await this.getWalletConnector()
        try {
          const result = await walletConnector.signTypedData(msgParams)
          cb(null, result)
        } catch (error) {
          cb(error)
        }
      },
      gasPrice: async cb => {
        cb(null, { result: '' })
      }
    })

    const bridge = opts.bridge || null

    if (!bridge || typeof bridge !== 'string') {
      throw new Error('Missing or Invalid bridge field')
    }

    this._walletConnector = new WalletConnect({ bridge })
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

  async getWalletConnector () {
    if (!this._walletConnector.connected) {
      await this._walletConnector.createSession()
    }
    return this._walletConnector
  }
}
