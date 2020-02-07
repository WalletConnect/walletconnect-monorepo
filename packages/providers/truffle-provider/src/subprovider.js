const WalletConnectQRCodeModal = require('@walletconnect/qrcode-modal').default
const HookedWalletSubprovider = require('web3-provider-engine/subproviders/hooked-wallet')

const WalletConnect = require('@walletconnect/node')

// eslint-disable-next-line
const isNode = new Function('try {return this===global;}catch(e){return false;}')

class WalletConnectSubprovider extends HookedWalletSubprovider {
  constructor (opts) {
    super({
      getAccounts: async (cb) => {
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
      signTransaction: (txParams, cb) => {
        return new Promise((resolve) => {
          this.getWalletConnector()
            .then(walletConnector => {
              return walletConnector.signTransaction(txParams)
            })
            .then(result => {
              resolve(cb(null, result))
            })
            .catch(error => {
              resolve(cb(error))
            })
        })
      },
      signMessage: (params, cb) => {
        return new Promise((resolve) => {
          this.getWalletConnector()
            .then(walletConnector => {
              const { from, data } = params
              return walletConnector.signMessage([from, data])
            })
            .then(result => {
              resolve(cb(null, result))
            })
            .catch(error => {
              resolve(cb(error))
            })
        })
      },
      signPersonalMessage: (params, cb) => {
        return new Promise((resolve) => {
          this.getWalletConnector()
            .then(walletConnector => {
              const { from, data } = params
              return walletConnector.signPersonalMessage([data, from])
            })
            .then(result => {
              resolve(cb(null, result))
            })
            .catch(error => {
              resolve(cb(error))
            })
        })
      },
      signTypedMessage: (params, cb) => {
        return new Promise((resolve) => {
          this.getWalletConnector()
            .then(walletConnector => {
              const { from, data } = params
              return walletConnector.signTypedData([from, data])
            })
            .then(result => {
              resolve(cb(null, result))
            })
            .catch(error => {
              resolve(cb(error))
            })
        })
      }
    })

    this.qrcode = typeof opts.qrcode === 'undefined' || opts.qrcode !== false

    this.bridge = opts.bridge || null

    if (!this.bridge || typeof this.bridge !== 'string') {
      throw new Error('Missing or Invalid bridge field')
    }

    this._walletConnector = new WalletConnect({ bridge: this.bridge })
    this._walletConnector._clientMeta = {
      name: 'wallet-connect-provider',
      description: 'WalletConnect provider',
      url: '#',
      icons: ['https://walletconnect.org/walletconnect-logo.png']
    }

    this.chainId = typeof opts.chainId !== 'undefined' ? opts.chainId : 1

    this.isConnecting = false

    this.connectCallbacks = []
  }

  set isWalletConnect (value) { }

  get isWalletConnect () {
    return true
  }

  set connected (value) { }

  get connected () {
    return this._walletConnector.connected
  }

  set uri (value) { }

  get uri () {
    return this._walletConnector.uri
  }

  set accounts (value) { }

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
              if (isNode()) {
                console.log('\nURI', '==>', walletConnector.uri)
              }
              WalletConnectQRCodeModal.open(walletConnector.uri, () => {
                reject(new Error('User closed WalletConnect modal'))
              }, isNode())
            }

            walletConnector.on('connect', () => {
              if (this.qrcode) {
                WalletConnectQRCodeModal.close(isNode())
              }
              this.isConnecting = false
              this.triggerConnect(walletConnector)
              resolve(walletConnector)
            })

            walletConnector.on('disconnect', () => {
              if (walletConnector.connected) {
                walletConnector.killSession()
                walletConnector.connected = false
              }
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

module.exports = WalletConnectSubprovider
