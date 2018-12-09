/* global fetch Buffer Promise */

import crypto from 'crypto'
import Listener from './listener'

const AES_ALGORITHM = 'AES-256-CBC'
const HMAC_ALGORITHM = 'SHA256'

export default class Connector {
  constructor(opts = {}) {
    const options = this.checkObject(opts, 'options')
    this.bridgeUrl = options.bridgeUrl
    this.sessionId = options.sessionId
    this.symKey = options.symKey
    this.chainId = options.chainId || 1
    this.expires = options.expires || null
    this.accounts = options.accounts || []
    this.dappData = options.dappData || null
    this.uri = options.uri || ''
    this.isConnected = false
    this.listeners = []
  }

  get isConnected() {
    return this._connected
  }

  set isConnected(value) {
    if (typeof value !== 'boolean') {
      throw new Error('isConnected must be a boolean')
    }

    this._connected = !!value
  }

  get bridgeUrl() {
    return this._bridgeUrl
  }

  set bridgeUrl(value) {
    if (!value) {
      return
    }

    this._bridgeUrl = value
  }

  get symKey() {
    if (this._symKey) {
      return this._symKey.toString('hex')
    }

    return null
  }

  set symKey(value) {
    if (!this.symKey && !value) {
      return
    }

    const v = Buffer.from(value, 'hex')
    this._symKey = v
  }

  get sessionId() {
    return this._sessionId
  }

  set sessionId(value) {
    if (!value) {
      return
    }

    this._sessionId = value
  }

  get uri() {
    return this._formatWalletConnectURI()
  }

  set uri(string) {
    if (!string || typeof string !== 'string') {
      return
    }
    const session = this._parseWalletConnectURI(string)
    this.bridgeUrl = session.bridgeUrl
    this.sessionId = session.sessionId
    this.symKey = session.symKey
  }

  async encrypt(data, customIv = null) {
    const key = this._symKey

    if (!key) {
      throw new Error(
        'Shared key is required. Please set `symKey` before using encryption'
      )
    }

    // use custom iv or generate one
    let rawIv = customIv
    if (!rawIv) {
      rawIv = await this.generateKey(128)
    }
    const iv = Buffer.from(rawIv)

    const actualContent = JSON.stringify({
      data: data
    })

    const encryptor = crypto.createCipheriv(AES_ALGORITHM, key, iv)
    encryptor.setEncoding('hex')
    encryptor.write(actualContent)
    encryptor.end()

    // get cipher text
    const cipher = encryptor.read()

    // ensure that both the IV and the cipher text is protected by the HMAC
    const hmac = crypto.createHmac(HMAC_ALGORITHM, key)
    hmac.update(cipher)
    hmac.update(iv.toString('hex'))

    return {
      data: cipher,
      hmac: hmac.digest('hex'),
      iv: iv.toString('hex')
    }
  }

  decrypt({ data, hmac, iv }) {
    const key = this._symKey
    const ivBuffer = Buffer.from(iv, 'hex')
    const hmacBuffer = Buffer.from(hmac, 'hex')

    const chmac = crypto.createHmac(HMAC_ALGORITHM, key)
    chmac.update(data)
    chmac.update(ivBuffer.toString('hex'))
    const chmacBuffer = Buffer.from(chmac.digest('hex'), 'hex')

    // compare buffers
    if (Buffer.compare(chmacBuffer, hmacBuffer) !== 0) {
      return null
    }

    const decryptor = crypto.createDecipheriv(AES_ALGORITHM, key, ivBuffer)
    const decryptedText = decryptor.update(data, 'hex', 'utf8')
    return JSON.parse(decryptedText + decryptor.final('utf8'))
  }

  //
  //  Generate Key (defaults to 256 bit)
  //
  async generateKey(s = 256) {
    const n = s / 8
    const b = crypto.randomBytes(n)
    const result = await b
    return result
  }

  // -- Private Methods ----------------------------------------------------- //

  //
  //  Format ERC-1328 - WalletConnect Standard URI Format
  //
  _formatWalletConnectURI() {
    const sessionId = this.sessionId || ''
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error('sessionId parameter is missing or invalid')
    }

    const version = '1'
    if (!version || typeof version !== 'string') {
      throw new Error('version parameter is missing or invalid')
    }

    const bridgeUrl = encodeURIComponent(this.bridgeUrl) || ''
    if (!bridgeUrl || typeof bridgeUrl !== 'string') {
      throw new Error('bridgeUrl parameter is missing or invalid')
    }

    const symKey = Buffer.from(this.symKey, 'hex').toString('base64') || ''
    if (!symKey || typeof symKey !== 'string') {
      throw new Error('symKey parameter is missing or invalid')
    }

    const uri = `ethereum:wc-${sessionId}@${version}?bridge=${bridgeUrl}&symKey=${symKey}`
    return uri
  }

  //
  //  Fetch Bridge Payload
  //

  async _fetchBridge(url, config = null, body = null) {
    const requestUrl = `${this.bridgeUrl}${url}`

    let _config = {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    }

    if (config) {
      _config = { ..._config, ...config }
    }

    if (body) {
      _config.body = JSON.stringify(body)
    }

    const res = await fetch(requestUrl, _config)

    // check for no content
    if (res.status === 204) {
      return null
    }

    // check for error message
    if (res.status >= 400) {
      throw new Error(res.statusText)
    }

    // get body
    let response = null

    const text = await res.text()
    if (text.length) {
      response = JSON.parse(text)
    }

    return response
  }

  //
  // Decrypt encryption payloads
  //

  _decryptPayload(data) {
    let decryptedData = data
    if (data.encryptionPayload) {
      const result = this.decrypt(data.encryptionPayload)
      if (result) {
        decryptedData = { ...decryptedData, ...result }
        delete decryptedData.encryptionPayload
      }
    }
    return decryptedData
  }

  //
  // Get encrypted remote data
  //

  async _getEncryptedData(url) {
    const response = await this._fetchBridge(url)

    if (!response) {
      return null
    }

    const { data } = response

    const decryptedData = this._decryptPayload(data)
    return decryptedData
  }

  //
  // Get multiple encrypted remote data
  //

  async _getMultipleEncryptedData(url) {
    const response = await this._fetchBridge(url)

    if (!response) {
      return null
    }

    const { data } = response

    let decryptedData

    if (Array.isArray(data)) {
      decryptedData = data.map(payload => this._decryptPayload(payload))
    } else if (typeof data === 'object') {
      decryptedData = {}
      Object.keys(data).forEach(key => {
        const payload = this._decryptPayload(data[key])
        decryptedData[key] = payload
      })
    }

    return decryptedData
  }

  toJSON() {
    return {
      bridgeUrl: this.bridgeUrl,
      sessionId: this.sessionId,
      symKey: this.symKey,
      chainId: this.chainId,
      expires: this.expires,
      dappData: this.dappData,
      accounts: this.accounts
    }
  }

  randomId() {
    // 13 time digits
    var datePart = new Date().getTime() * Math.pow(10, 3)
    // 3 random digits
    var extraPart = Math.floor(Math.random() * Math.pow(10, 3))
    // 16 digits
    return datePart + extraPart
  }

  checkObject(obj, name) {
    let result = {}

    if (obj) {
      if (typeof obj === 'object') {
        result = obj
      } else if (typeof obj === 'string') {
        try {
          obj = JSON.parse(obj)
        } catch (error) {
          throw new Error(`${name} object is invalid`)
        }
        result = obj
      }
    }

    return result
  }

  formatPayload(data) {
    let payload = this.checkObject(data, 'payload')

    payload.id = this.randomId()

    return {
      jsonrpc: '2.0',
      params: [],
      ...payload
    }
  }

  //
  //  Promisify listener
  //
  promisifyListener({ fn, interval, timeout }) {
    return new Promise((resolve, reject) => {
      const listener = new Listener({
        fn,
        cb: (err, result) => {
          if (err) {
            reject(err)
          }
          resolve(result)
        },
        interval,
        timeout
      })
      this.listeners.unshift(listener)
    })
  }

  //
  //  Stop last listener
  //
  stopLastListener() {
    const listener = this.listeners.shift()
    listener.stop()
    return true
  }
}
