/* global fetch Buffer Promise */

import crypto from 'crypto'
import ethParseUri from 'eth-parse-uri'
import Listener from './listener'

const AES_ALGORITHM = 'AES-256-CBC'
const HMAC_ALGORITHM = 'SHA256'

export default class Connector {
  constructor(opts = {}) {
    const options = this.checkObject(opts, 'options')
    this.bridgeUrl = options.bridgeUrl
    this.sessionId = options.sessionId
    this.symKey = options.symKey
    this.dappName = options.dappName
    this.protocol = options.protocol || 'ethereum'
    this.chainId = options.chainId || 1
    this.expires = options.expires || null
    this.accounts = options.accounts || []
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
    this.protocol = session.protocol
    this.bridgeUrl = session.bridgeUrl
    this.sessionId = session.sessionId
    this.symKey = session.symKey
    this.dappName = session.dappName
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

  //
  //  Format ERC-681 - Transaction Request Standard URI Format
  //
  formatTransactionRequest(tx) {
    const protocol = this.protocol
    const targetAddress = tx.to
    const chainId = this.chainId
    let uri = `${protocol}:pay-${targetAddress}@${chainId}`

    if (tx.functionName) {
      uri += '/' + tx.functionName
    }

    if (tx.parameters) {
      let params = ''
      let keys = Object.keys(tx.parameters)
      while (keys.length) {
        let key = keys.pop()
        let val = tx.parameters[key].toString()
        params += key + '=' + encodeURIComponent(val)
        if (keys.length) {
          params += '&'
        }
      }
      uri += '?' + params
    }

    return uri
  }

  //
  // Parse ERC-681 - Transaction Request Standard URI Format
  //
  parseTransactionRequest(string) {
    const result = ethParseUri(string)
    if (result.prefix && result.prefix === 'pay') {
      if (result.chainId !== this.chainId) {
        throw new Error('chainId does not match')
      }

      if (result.protocol !== this.protocol) {
        throw new Error('Protocol does not match')
      }

      return result
    } else {
      throw new Error('URI string doesn\'t follow ERC-681 standard')
    }
  }

  // -- Private Methods ----------------------------------------------------- //

  //
  //  Format ERC-1328 - WalletConnect Standard URI Format
  //
  _formatWalletConnectURI() {
    const protocol = this.protocol || ''
    if (!protocol || typeof protocol !== 'string') {
      throw new Error('protocol parameter is missing or invalid')
    }

    const sessionId = this.sessionId || ''
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error('sessionId parameter is missing or invalid')
    }

    const version = '1'
    if (!version || typeof version !== 'string') {
      throw new Error('version parameter is missing or invalid')
    }

    const name = encodeURIComponent(this.dappName) || ''
    if (!name || typeof name !== 'string') {
      throw new Error('name parameter is missing or invalid')
    }

    const bridgeUrl = encodeURIComponent(this.bridgeUrl) || ''
    if (!bridgeUrl || typeof bridgeUrl !== 'string') {
      throw new Error('bridgeUrl parameter is missing or invalid')
    }

    const symKey = Buffer.from(this.symKey, 'hex').toString('base64') || ''
    if (!symKey || typeof symKey !== 'string') {
      throw new Error('symKey parameter is missing or invalid')
    }

    const uri = `${protocol}:wc-${sessionId}@${version}?name=${name}&bridge=${bridgeUrl}&symKey=${symKey}`
    return uri
  }

  //
  //  Parse ERC-1328 - WalletConnect Standard URI Format
  //
  _parseWalletConnectURI(string) {
    const result = ethParseUri(string)
    if (result.prefix && result.prefix === 'wc') {
      if (!result.sessionId) {
        throw Error('Missing sessionId field')
      }

      if (!result.bridge) {
        throw Error('Missing bridge url field')
      }

      if (!result.symKey) {
        throw Error('Missing symKey field')
      }

      if (!result.name) {
        throw Error('Missing dapp name field')
      }

      if (result.protocol !== this.protocol) {
        throw new Error('Protocol does not match')
      }

      const symKey = Buffer.from(result.symKey, 'base64')

      const session = {
        protocol: result.protocol,
        version: result.version,
        sessionId: result.sessionId,
        bridgeUrl: result.bridge,
        dappName: result.name,
        symKey: symKey
      }
      return session
    } else {
      throw new Error('URI string doesn\'t follow ERC-1328 standard')
    }
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
      dappName: this.dappName,
      protocol: this.protocol,
      expires: this.expires,
      accounts: this.accounts,
      uri: this.uri
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
    let result = null

    const throwError = () => {
      throw new Error(`${name} object is invalid`)
    }

    if (obj) {
      if (typeof obj === 'object') {
        if (Object.keys(obj).length) {
          result = obj
        }
      } else if (typeof obj === 'string') {
        try {
          obj = JSON.parse(obj)
        } catch (error) {
          throwError()
        }
        if (Object.keys(obj).length) {
          result = obj
        }
      }
    }

    if (!result) {
      throwError()
    }

    return result
  }

  formatPayload(data) {
    let payload = this.checkObject(data, 'payload')

    if (payload.id) {
      delete payload.id
    }

    return {
      id: this.randomId(),
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
