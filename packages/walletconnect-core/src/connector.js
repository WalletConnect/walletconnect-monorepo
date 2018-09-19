/* global fetch Buffer */

import crypto from 'crypto'
import ethParseUri from 'eth-parse-uri'

const AES_ALGORITHM = 'AES-256-CBC'
const HMAC_ALGORITHM = 'SHA256'

export default class Connector {
  constructor(options = {}) {
    const {
      bridgeUrl,
      sessionId,
      symKey,
      dappName,
      chainId,
      protocol
    } = options

    this.bridgeUrl = bridgeUrl
    this.sessionId = sessionId
    this.symKey = symKey
    this.dappName = dappName
    this.protocol = protocol || 'ethereum'
    this.chainId = chainId || 1
  }

  get bridgeUrl() {
    return this._bridgeUrl
  }

  set bridgeUrl(value) {
    if (this.bridgeUrl) {
      throw new Error('bridgeUrl already set')
    }

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
    if (this.symKey) {
      throw new Error('symKey already set')
    }

    if (!this.symKey && !value) {
      return
    }

    const v = Buffer.from(value.toString('hex'), 'hex')
    this._symKey = v
  }

  // getter for session id
  get sessionId() {
    return this._sessionId
  }

  // setter for sessionId
  set sessionId(value) {
    if (this.sessionId) {
      throw new Error('sessionId already set')
    }

    if (!value) {
      return
    }

    this._sessionId = value
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
    const encryptedData = encryptor.read()

    // ensure that both the IV and the cipher-text is protected by the HMAC
    const hmac = crypto.createHmac(HMAC_ALGORITHM, key)
    hmac.update(encryptedData)
    hmac.update(iv.toString('hex'))

    return {
      data: encryptedData,
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
    let uri = `${this.protocol}:pay-${tx.to}@${this.chainId}`

    if (tx.function_name) {
      uri += '/' + tx.function_name
    }

    if (tx.parameters) {
      let params = ''
      let keys = Object.keys(tx.parameters)
      while (keys.length) {
        let key = keys.pop()
        let val = tx.parameters[key]
        params += key + '=' + val.toString()
        if (keys.length) {
          params += '&'
        }
      }
      uri += '?' + params
    }

    return encodeURIComponent(uri)
  }

  //
  // Parse ERC-681 - Transaction Request Standard URI Format
  //
  parseTransactionRequest(string) {
    const result = ethParseUri(string)
    if (result.prefix && result.prefix === 'wc') {
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
    const symKey = Buffer.from(this.symKey, 'hex').toString('base64')
    const uri = `${this.protocol}:wc-${this.sessionId}@1?name=${
      this.dappName
    }&bridge=${this.bridgeUrl}&symKey=${symKey}`
    return encodeURIComponent(uri)
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
        // Accept: 'application/json',
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
    const response = await res.json()

    return response
  }

  //
  // Decrypt relayed payloads
  //

  _decryptPayload(data) {
    let decryptedData = data
    if (data.encryptionPayload) {
      decryptedData.data = this.decrypt(data.encryptionPayload).data
      delete decryptedData.encryptionPayload
    }
    return decryptedData
  }

  //
  // Get encrypted remote data
  //

  async _getEncryptedData(url) {
    const response = this._fetchBridge(url)

    const { data } = response

    const decryptedData = this._decryptPayload(data)
    return decryptedData
  }

  //
  // Get multiple encrypted remote data
  //

  async _getMultipleEncryptedData(url) {
    const response = this._fetchBridge(url)

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
}
