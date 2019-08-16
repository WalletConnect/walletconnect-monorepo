import EventEmitter from 'events'
import { convertNumberToHex } from '@walletconnect/utils'
import WalletConnect from '@walletconnect/browser'
import WCQRCode from '@walletconnect/qrcode-modal'
import HTTPConnection from './http'
import {
  ISessionParams,
  IWalletConnectConnectionOptions
} from '@walletconnect/types'

// -- WalletConnectConnection --------------------------------------------- //

class WalletConnectConnection extends EventEmitter {
  public bridge: string = 'https://bridge.walletconnect.org'
  public qrcode: boolean = true
  public infuraId: string = ''
  public wc: WalletConnect | null = null
  public http: HTTPConnection | null = null
  public accounts: string[] = []
  public chainId: number = 1
  public networkId: number = 1
  public rpcUrl: string = ''
  public connected: boolean = false
  public closed: boolean = false

  constructor (opts: IWalletConnectConnectionOptions) {
    super()
    this.bridge = opts.bridge || 'https://bridge.walletconnect.org'
    this.qrcode = typeof opts.qrcode === 'undefined' || opts.qrcode !== false
    if (
      !opts.infuraId ||
      typeof opts.infuraId !== 'string' ||
      !opts.infuraId.trim()
    ) {
      throw new Error('Missing Infura App Id field')
    }
    this.infuraId = opts.infuraId
    this.on('error', () => this.close())
    setTimeout(() => this.create(), 0)
  }
  public openQRCode () {
    const uri = this.wc ? this.wc.uri : ''
    if (uri) {
      WCQRCode.open(uri, () => {
        this.emit('error', new Error('User close WalletConnect QR Code modal'))
      })
    }
  }
  public create () {
    try {
      this.wc = new WalletConnect({ bridge: this.bridge })
    } catch (e) {
      this.emit('error', e)
      return
    }

    if (!this.wc.connected) {
      // Create new session
      this.wc
        .createSession()
        .then(() => {
          if (this.qrcode) {
            this.openQRCode()
          }
        })
        .catch((e: Error) => this.emit('error', e))
    }

    this.wc.on('connect', (err: Error | null, payload: any) => {
      if (err) {
        this.emit('error', err)
        return
      }

      this.connected = true

      if (this.qrcode) {
        WCQRCode.close() // Close QR Code Modal
      }

      // Handle session update
      this.updateState(payload.params[0])

      // Emit connect event
      this.emit('connect')
    })

    this.wc.on('session_update', (err: Error | null, payload: any) => {
      if (err) {
        this.emit('error', err)
        return
      }

      // Handle session update
      this.updateState(payload.params[0])
    })
    this.wc.on('disconnect', (err: Error | null, payload: any) => {
      if (err) {
        this.emit('error', err)
        return
      }
      this.onClose()
    })
  }
  public onClose () {
    this.wc = null
    this.connected = false
    this.closed = true
    this.emit('close')
    this.removeAllListeners()
  }
  public close () {
    if (this.wc) {
      this.wc.killSession()
    }
    this.onClose()
  }
  public error (payload: any, message: string, code = -1) {
    this.emit('payload', {
      id: payload.id,
      jsonrpc: payload.jsonrpc,
      error: { message, code }
    })
  }
  public async send (payload: any) {
    if (this.wc && this.wc.connected) {
      if (payload.method.includes('chan_')) {
        const response = await this.wc.unsafeSend(payload)
        this.emit('payload', response)
      } else {
        if (this.http) {
          this.http.send(payload)
        } else {
          this.error(payload, 'HTTP Connection not available')
        }
      }
    } else {
      this.error(payload, 'Not connected')
    }
  }

  public async handleStateMethods (payload: any) {
    let result: any = null
    switch (payload.method) {
      case 'eth_accounts':
        result = this.accounts
        break
      case 'eth_chainId':
        result = convertNumberToHex(this.chainId)
        break

      case 'net_version':
        result = this.networkId
        break
      default:
        break
    }
    return {
      id: payload.id,
      jsonrpc: payload.jsonrpc,
      result
    }
  }

  public async updateState (sessionParams: ISessionParams) {
    const { accounts, chainId, networkId, rpcUrl } = sessionParams

    // Check if accounts changed and trigger event
    if (accounts && this.accounts !== accounts) {
      this.accounts = accounts
      this.emit('accountsChanged', accounts)
    }

    // Check if chainId changed and trigger event
    if (chainId && this.chainId !== chainId) {
      this.chainId = chainId
      this.emit('chainChanged', chainId)
    }

    // Check if networkId changed and trigger event
    if (networkId && this.networkId !== networkId) {
      this.networkId = networkId
      this.emit('networkChanged', networkId)
    }

    // Handle rpcUrl update
    this.updateRpcUrl(this.chainId, rpcUrl || '')
  }

  public updateRpcUrl (chainId: number, rpcUrl: string = '') {
    const infuraNetworks = {
      1: 'mainnet',
      3: 'ropsten',
      4: 'rinkeby',
      5: 'goerli',
      42: 'kovan'
    }
    const network = infuraNetworks[chainId]

    if (!rpcUrl && network) {
      rpcUrl = `https://${network}.infura.io/v3/${this.infuraId}`
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

  public updateHttpConnection = () => {
    if (this.rpcUrl) {
      this.http = new HTTPConnection(this.rpcUrl)
      this.http.on('payload', payload => this.emit('payload', payload))
      this.http.on('error', (error: Error) => this.emit('error', error))
    }
  }
}

export default WalletConnectConnection
