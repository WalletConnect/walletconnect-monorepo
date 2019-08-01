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

export default function WalletConnectProvider (opts) {
  const qrcode = typeof opts.qrcode === 'undefined' || opts.qrcode !== false

  const bridge = opts.bridge || null

  if (!bridge || typeof bridge !== 'string') {
    throw new Error('Missing or Invalid bridge field')
  }

  const wc = new WalletConnect({ bridge })

  wc.on('disconnect', (error, payload) => {
    if (error) {
      throw error
    }

    engine.stop()
  })

  const engine = new ProviderEngine()

  engine.isConnecting = false

  engine.connectCallbacks = []

  function onConnect (callback) {
    engine.connectCallbacks.push(callback)
  }

  function triggerConnect (result) {
    if (engine.connectCallbacks && engine.connectCallbacks.length) {
      engine.connectCallbacks.forEach(callback => callback(result))
    }
  }

  async function handleRequest (payload) {
    let result = null
    try {
      const walletConnector = await engine.getWalletConnector()

      switch (payload.method) {
        case 'wc_killSession':
          await walletConnector.killSession()
          await engine.stop()
          result = null
          break
        case 'eth_accounts':
          result = walletConnector.accounts
          break

        case 'eth_coinbase':
          result = walletConnector.accounts[0]
          break

        case 'eth_chainId':
          result = walletConnector.chainId
          break

        case 'net_version':
          result = walletConnector.networkId || walletConnector.chainId
          break

        case 'eth_uninstallFilter':
          engine.sendAsync(payload, _ => _)
          result = true
          break

        default:
          result = await walletConnector.sendCustomRequest(payload)
          break
      }
    } catch (error) {
      throw error
    }

    return {
      id: payload.id,
      jsonrpc: payload.jsonrpc,
      result: result
    }
  }

  engine.wc = wc

  engine.send = async (payload, callback) => {
    // Web3 1.0 beta.38 (and above) calls `send` with method and parameters
    if (typeof payload === 'string') {
      return new Promise((resolve, reject) => {
        engine.sendAsync(
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
      engine.sendAsync(payload, callback)
      return
    }

    const res = await handleRequest(payload, callback)

    return res
  }

  engine.addProvider(
    new FixtureSubprovider({
      eth_hashrate: '0x00',
      eth_mining: false,
      eth_syncing: true,
      net_listening: true,
      web3_clientVersion: `WalletConnect/v${pkg.version}/javascript`
    })
  )

  engine.addProvider(new CacheSubprovider())
  engine.addProvider(new SubscriptionsSubprovider())
  engine.addProvider(new FilterSubprovider())
  engine.addProvider(new NonceSubprovider())

  engine.addProvider(
    new HookedWalletSubprovider({
      getAccounts: async cb => {
        try {
          const walletConnector = await engine.getWalletConnector()
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
          const walletConnector = await engine.getWalletConnector()
          const result = await walletConnector.signMessage(msgParams)
          cb(null, result)
        } catch (error) {
          cb(error)
        }
      },
      processPersonalMessage: async (msgParams, cb) => {
        try {
          const walletConnector = await engine.getWalletConnector()
          const result = await walletConnector.signPersonalMessage(msgParams)
          cb(null, result)
        } catch (error) {
          cb(error)
        }
      },
      processSignTransaction: async (txParams, cb) => {
        try {
          const walletConnector = await engine.getWalletConnector()
          const result = await walletConnector.signTransaction(txParams)
          cb(null, result)
        } catch (error) {
          cb(error)
        }
      },
      processTransaction: async (txParams, cb) => {
        try {
          const walletConnector = await engine.getWalletConnector()
          const result = await walletConnector.sendTransaction(txParams)
          cb(null, result)
        } catch (error) {
          cb(error)
        }
      },
      processTypedMessage: async (msgParams, cb) => {
        try {
          const walletConnector = await engine.getWalletConnector()
          const result = await walletConnector.signTypedData(msgParams)
          cb(null, result)
        } catch (error) {
          cb(error)
        }
      }
    })
  )

  engine.addProvider({
    handleRequest: async (payload, next, end) => {
      try {
        const { result } = await handleRequest(payload)
        end(null, result)
      } catch (error) {
        end(error)
      }
    },
    setEngine: _ => _
  })

  engine.enable = () =>
    new Promise((resolve, reject) => {
      engine.sendAsync({ method: 'eth_accounts' }, (error, response) => {
        if (error) {
          reject(error)
        } else {
          resolve(response.result)
        }
      })
    })

  engine.getWalletConnector = () => {
    return new Promise((resolve, reject) => {
      const walletConnector = engine.wc

      if (engine.isConnecting) {
        onConnect(x => resolve(x))
      } else if (!walletConnector.connected) {
        engine.isConnecting = true
        walletConnector
          .createSession()
          .then(() => {
            if (qrcode) {
              WalletConnectQRCodeModal.open(walletConnector.uri, () => {
                reject(new Error('User closed WalletConnect modal'))
              })
            }
            walletConnector.on('connect', () => {
              if (qrcode) {
                WalletConnectQRCodeModal.close()
              }
              engine.isConnecting = false
              triggerConnect(walletConnector)
              resolve(walletConnector)
            })
          })
          .catch(error => {
            engine.isConnecting = false
            reject(error)
          })
      } else {
        resolve(walletConnector)
      }
    })
  }

  engine.isWalletConnect = true

  engine.start()

  return engine
}
