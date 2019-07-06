import WalletConnect from '@walletconnect/browser'
import WalletConnectQRCodeModal from '@walletconnect/qrcode-modal'
import HookedWalletSubprovider from 'web3-provider-engine/subproviders/hooked-wallet'

export default class WalletConnectSubprovider extends HookedWalletSubprovider {
  constructor (opts) {
    super({
      getAccounts: async cb => {
        const walletConnector = await this.getWalletConnector()
        const accounts = walletConnector.accounts
        if (accounts && accounts.length) {
          cb(null, accounts)
        } else {
          cb(new Error('Failed to get accounts'))
        }
      },
      processTransaction: async (txParams, cb) => {
        const walletConnector = await this.getWalletConnector()
        try {
          const result = await walletConnector.sendTransaction(txParams)
          cb(null, result)
        } catch (error) {
          cb(error)
        }
      },
      processSignTransaction: async (txParams, cb) => {
        const walletConnector = await this.getWalletConnector()
        try {
          const result = await walletConnector.signTransaction(txParams)
          cb(null, result)
        } catch (error) {
          cb(error)
        }
      },
      processMessage: async (msgParams, cb) => {
        const walletConnector = await this.getWalletConnector()
        try {
          const result = await walletConnector.signMessage(msgParams)
          cb(null, result)
        } catch (error) {
          cb(error)
        }
      },
      processPersonalMessage: async (msgParams, cb) => {
        const walletConnector = await this.getWalletConnector()
        try {
          const result = await walletConnector.signPersonalMessage(msgParams)
          cb(null, result)
        } catch (error) {
          cb(error)
        }
      },
      processTypedMessage: async (msgParams, cb) => {
        const walletConnector = await this.getWalletConnector()
        try {
          const result = await walletConnector.signTypedData(msgParams)
          cb(null, result)
        } catch (error) {
          cb(error)
        }
      }
    })

    this.qrcode = typeof opts.qrcode === 'undefined' || opts.qrcode !== false

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

  getWalletConnector () {
    return new Promise((resolve, reject) => {
      const walletConnector = this._walletConnector

      console.log('[getWalletConnector] walletConnector', walletConnector)

      if (!walletConnector.connected) {
        walletConnector
          .createSession()
          .then(() => {
            if (this.qrcode) {
              WalletConnectQRCodeModal.open(walletConnector.uri, () => {
                reject(new Error('User closed WalletConnect modal'))
              })
            }
            walletConnector.on('connect', () => {
              if (this.qrcode) {
                WalletConnectQRCodeModal.close()
              }
              resolve(walletConnector)
            })
          })
          .catch(error => reject(error))
        return
      }

      resolve(walletConnector)
    })
  }
}
