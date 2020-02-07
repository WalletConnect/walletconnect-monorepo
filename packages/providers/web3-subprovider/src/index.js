import WalletConnect from '@walletconnect/browser'
import WalletConnectQRCodeModal from '@walletconnect/qrcode-modal'
import HookedWalletSubprovider from 'web3-provider-engine/subproviders/hooked-wallet'

export default class WalletConnectSubprovider extends HookedWalletSubprovider {
  constructor (opts) {
    super({
      getAccounts: async cb => {
        try {
          const walletConnector = await this.getWalletConnector()
          const accounts = walletConnector.accounts
          if (accounts && accounts.length) {
            cb(null, accounts)
          } else {
            cb(new Error('Failed to get accounts'))
          }
        } catch (error) {
          cb(error)
        }
      },
      processMessage: async (msgParams, cb) => {
        try {
          const walletConnector = await this.getWalletConnector()
          const result = await walletConnector.signMessage([
            msgParams.from,
            msgParams.data
          ])
          cb(null, result)
        } catch (error) {
          cb(error)
        }
      },
      processPersonalMessage: async (msgParams, cb) => {
        try {
          const walletConnector = await this.getWalletConnector()
          const result = await walletConnector.signPersonalMessage([
            msgParams.data,
            msgParams.from
          ])
          cb(null, result)
        } catch (error) {
          cb(error)
        }
      },
      processSignTransaction: async (txParams, cb) => {
        try {
          const walletConnector = await this.getWalletConnector()
          const result = await walletConnector.signTransaction(txParams)
          cb(null, result)
        } catch (error) {
          cb(error)
        }
      },
      processTransaction: async (txParams, cb) => {
        try {
          const walletConnector = await this.getWalletConnector()
          const result = await walletConnector.sendTransaction(txParams)
          cb(null, result)
        } catch (error) {
          cb(error)
        }
      },
      processTypedMessage: async (msgParams, cb) => {
        try {
          const walletConnector = await this.getWalletConnector()
          const result = await walletConnector.signTypedData([
            msgParams.from,
            msgParams.data
          ])
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

    this.chainId = typeof opts.chainId !== 'undefined' ? opts.chainId : 1

    this.isConnecting = false

    this.connectCallbacks = []
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

  onConnect (callback) {
    this.connectCallbacks.push(callback)
  }

  triggerConnect (result) {
    if (this.connectCallbacks && this.connectCallbacks.length) {
      this.connectCallbacks.forEach(callback => callback(result))
    }
  }

  getWalletConnector () {
    return new Promise((resolve, reject) => {
      const walletConnector = this._walletConnector

      if (this.isConnecting) {
        this.onConnect(_walletConnector => resolve(_walletConnector))
      } else if (!walletConnector.connected) {
        this.isConnecting = true
        const sessionRequestOpions = this.chainId
          ? { chainId: this.chainId }
          : undefined
        walletConnector
          .createSession(sessionRequestOpions)
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
              this.isConnecting = false
              this.triggerConnect(walletConnector)
              resolve(walletConnector)
            })
          })
          .catch(error => {
            this.isConnecting = false
            reject(error)
          })
      } else {
        resolve(walletConnector)
      }
    })
  }
}
