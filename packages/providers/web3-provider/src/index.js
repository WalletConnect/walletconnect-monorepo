import pkg from '../package.json'
import WalletConnect from '@walletconnect/browser'
import WalletConnectQRCodeModal from '@walletconnect/qrcode-modal'
import ProviderEngine from 'web3-provider-engine'
import CacheSubprovider from 'web3-provider-engine/subproviders/cache'
import FixtureSubprovider from 'web3-provider-engine/subproviders/fixture'
import FilterSubprovider from 'web3-provider-engine/subproviders/filters'
import HookedWalletSubprovider from 'web3-provider-engine/subproviders/hooked-wallet'
import NonceSubprovider from 'web3-provider-engine/subproviders/nonce-tracker'
import SubscriptionsSubprovider from 'web3-provider-engine/subproviders/subscriptions'
import HTTPConnection from './http'

class WalletConnectProvider extends ProviderEngine {
  constructor (opts) {
    super({ pollingInterval: opts.pollingInterval || 4000 })

    this.bridge = opts.bridge || 'https://bridge.walletconnect.org'

    this.qrcode = typeof opts.qrcode === 'undefined' || opts.qrcode !== false

    this.rpc = opts.rpc || null

    if (
      !this.rpc &&
      (!opts.infuraId ||
        typeof opts.infuraId !== 'string' ||
        !opts.infuraId.trim())
    ) {
      throw new Error('Missing one of the required parameters: rpc or infuraId')
    }

    this.infuraId = opts.infuraId || ''

    this.wc = new WalletConnect({ bridge: this.bridge })
    this.isConnecting = false
    this.connected = false
    this.isWalletConnect = true
    this.connectCallbacks = []
    this.accounts = []
    this.chainId = typeof opts.chainId !== 'undefined' ? opts.chainId : 1
    this.networkId = this.chainId
    this.rpcUrl = ''

    this.updateRpcUrl(this.chainId)

    this.addProvider(
      new FixtureSubprovider({
        eth_hashrate: '0x00',
        eth_mining: false,
        eth_syncing: true,
        net_listening: true,
        web3_clientVersion: `WalletConnect/v${pkg.version}/javascript`
      })
    )

    this.addProvider(new CacheSubprovider())

    this.addProvider(new SubscriptionsSubprovider())

    this.addProvider(new FilterSubprovider())

    this.addProvider(new NonceSubprovider())

    this.addProvider(
      new HookedWalletSubprovider({
        getAccounts: async cb => {
          try {
            const wc = await this.getWalletConnector()
            const accounts = wc.accounts
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
            const wc = await this.getWalletConnector()
            const result = await wc.signMessage([
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
            const wc = await this.getWalletConnector()
            const result = await wc.signPersonalMessage([
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
            const wc = await this.getWalletConnector()
            const result = await wc.signTransaction(txParams)
            cb(null, result)
          } catch (error) {
            cb(error)
          }
        },
        processTransaction: async (txParams, cb) => {
          try {
            const wc = await this.getWalletConnector()
            const result = await wc.sendTransaction(txParams)
            cb(null, result)
          } catch (error) {
            cb(error)
          }
        },
        processTypedMessage: async (msgParams, cb) => {
          try {
            const wc = await this.getWalletConnector()
            const result = await wc.signTypedData([
              msgParams.from,
              msgParams.data
            ])
            cb(null, result)
          } catch (error) {
            cb(error)
          }
        }
      })
    )

    this.addProvider({
      handleRequest: async (payload, next, end) => {
        try {
          const { result } = await this.handleRequest(payload)
          end(null, result)
        } catch (error) {
          end(error)
        }
      },
      setEngine: _ => _
    })
  }

  enable () {
    return new Promise(async (resolve, reject) => {
      try {
        const wc = await this.getWalletConnector()
        if (wc) {
          this.start()
          this.subscribeWalletConnector()
          resolve(wc.accounts)
        } else {
          return reject(new Error('Failed to connect to WalleConnect'))
        }
      } catch (error) {
        return reject(error)
      }
    })
  }

  async send (payload, callback) {
    // Web3 1.0 beta.38 (and above) calls `send` with method and parameters
    if (typeof payload === 'string') {
      return new Promise((resolve, reject) => {
        this.sendAsync(
          {
            id: 42,
            jsonrpc: '2.0',
            method: payload,
            params: callback || []
          },
          (error, response) => {
            if (error) {
              reject(error)
            } else {
              resolve(response.result)
            }
          }
        )
      })
    }

    // Web3 1.0 beta.37 (and below) uses `send` with a callback for async queries
    if (callback) {
      this.sendAsync(payload, callback)
      return
    }

    const res = await this.handleRequest(payload, callback)

    return res
  }

  onConnect (callback) {
    this.connectCallbacks.push(callback)
  }

  triggerConnect (result) {
    if (this.connectCallbacks && this.connectCallbacks.length) {
      this.connectCallbacks.forEach(callback => callback(result))
    }
  }

  async close () {
    const wc = await this.getWalletConnector({ disableSessionCreation: true })
    await wc.killSession()
    await this.stop()
    this.emit('close', 1000, 'Connection closed')
  }

  async handleRequest (payload) {
    let result = null

    try {
      const wc = await this.getWalletConnector()

      switch (payload.method) {
        case 'wc_killSession':
          await this.close()
          result = null
          break
        case 'eth_accounts':
          result = wc.accounts
          break

        case 'eth_coinbase':
          result = wc.accounts[0]
          break

        case 'eth_chainId':
          result = wc.chainId
          break

        case 'net_version':
          result = wc.networkId || wc.chainId
          break

        case 'eth_uninstallFilter':
          this.sendAsync(payload, _ => _)
          result = true
          break

        default:
          return this.handleOtherRequests(payload)
      }
    } catch (error) {
      this.emit('error', error)
      return
    }

    return this.formatResponse(payload, result)
  }

  formatResponse (payload, result) {
    return {
      id: payload.id,
      jsonrpc: payload.jsonrpc,
      result: result
    }
  }

  async handleOtherRequests (payload) {
    if (payload.method.startsWith('eth_')) {
      return this.handleReadRequests(payload)
    }
    const wc = await this.getWalletConnector()
    const result = await wc.sendCustomRequest(payload)
    return this.formatResponse(payload, result)
  }

  async handleReadRequests (payload) {
    if (!this.http) {
      this.emit('error', new Error('HTTP Connection not available'))
      return
    }
    return this.http.send(payload)
  }

  // disableSessionCreation - if true, getWalletConnector won't try to create a new session
  // in case the connector is disconnected
  getWalletConnector (opts = {}) {
    const { disableSessionCreation = false } = opts

    return new Promise((resolve, reject) => {
      const wc = this.wc

      if (this.isConnecting) {
        this.onConnect(x => resolve(x))
      } else if (!wc.connected && !disableSessionCreation) {
        this.isConnecting = true
        const sessionRequestOpions = this.chainId
          ? { chainId: this.chainId }
          : undefined
        wc.createSession(sessionRequestOpions)
          .then(() => {
            if (this.qrcode) {
              WalletConnectQRCodeModal.open(wc.uri, () => {
                reject(new Error('User closed WalletConnect modal'))
              })
            }
            wc.on('connect', (error, payload) => {
              if (this.qrcode) {
                WalletConnectQRCodeModal.close()
              }
              if (error) {
                this.isConnecting = false
                return reject(error)
              }
              this.isConnecting = false
              this.connected = true

              if (payload) {
                // Handle session update
                this.updateState(payload.params[0])
              }
              // Emit connect event
              this.emit('connect')

              this.triggerConnect(wc)
              resolve(wc)
            })
          })
          .catch(error => {
            this.isConnecting = false
            reject(error)
          })
      } else {
        if (!this.connected) {
          this.connected = true
          this.updateState(wc.session)
        }
        resolve(wc)
      }
    })
  }

  async subscribeWalletConnector () {
    const wc = await this.getWalletConnector()

    wc.on('disconnect', (error, payload) => {
      if (error) {
        this.emit('error', error)
        return
      }

      this.stop()
    })

    wc.on('session_update', (error, payload) => {
      if (error) {
        this.emit('error', error)
        return
      }

      // Handle session update
      this.updateState(payload.params[0])
    })
  }

  async updateState (sessionParams) {
    const { accounts, chainId, networkId, rpcUrl } = sessionParams

    // Check if accounts changed and trigger event
    if (!this.accounts || (accounts && this.accounts !== accounts)) {
      this.accounts = accounts
      this.emit('accountsChanged', accounts)
    }

    // Check if chainId changed and trigger event
    if (!this.chainId || (chainId && this.chainId !== chainId)) {
      this.chainId = chainId
      this.emit('chainChanged', chainId)
    }

    // Check if networkId changed and trigger event
    if (!this.networkId || (networkId && this.networkId !== networkId)) {
      this.networkId = networkId
      this.emit('networkChanged', networkId)
    }

    // Handle rpcUrl update
    this.updateRpcUrl(this.chainId, rpcUrl || '')
  }

  updateRpcUrl (chainId, rpcUrl = '') {
    const infuraNetworks = {
      1: 'mainnet',
      3: 'ropsten',
      4: 'rinkeby',
      5: 'goerli',
      42: 'kovan'
    }

    const network = infuraNetworks[chainId]

    if (!rpcUrl) {
      if (this.rpc && this.rpc[chainId]) {
        rpcUrl = this.rpc[chainId]
      } else if (network) {
        rpcUrl = `https://${network}.infura.io/v3/${this.infuraId}`
      }
    }

    if (rpcUrl) {
      // Update rpcUrl
      this.rpcUrl = rpcUrl
      // Handle http update
      this.updateHttpConnection()
    } else {
      this.emit(
        'error',
        new Error(`No RPC Url available for chainId: ${chainId}`)
      )
    }
  }

  updateHttpConnection () {
    if (this.rpcUrl) {
      this.http = new HTTPConnection(this.rpcUrl)
      this.http.on('payload', payload => this.emit('payload', payload))
      this.http.on('error', error => this.emit('error', error))
    }
  }
}

export default WalletConnectProvider
