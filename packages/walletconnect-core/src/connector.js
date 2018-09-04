/* global fetch */

import crypto from 'crypto'
import { Buffer } from 'safe-buffer'
import Ajv from 'ajv'

import generateKey from './generateKey'
import parseStandardURI from './parseStandardURI'
import URLTransactionRequest from './URLTransactionRequest'

const AES_ALGORITHM = 'AES-256-CBC'
const HMAC_ALGORITHM = 'SHA256'

export default class Connector {
  constructor(options = {}) {
    const { bridgeUrl, sessionId, sharedKey, dappName, chainId } = options

    this.bridgeUrl = bridgeUrl
    this.sessionId = sessionId
    this.sharedKey = sharedKey
    this.dappName = dappName
    // 1 = mainnet
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

  get sharedKey() {
    if (this._sharedKey) {
      return this._sharedKey.toString('hex')
    }

    return null
  }

  set sharedKey(value) {
    if (this.sharedKey) {
      throw new Error('sharedKey already set')
    }

    if (!value) {
      return
    }

    const v = Buffer.from(value.toString('hex'), 'hex')
    this._sharedKey = v
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

  get typedDataSchema() {
    // From https://github.com/ethereum/EIPs/blob/master/EIPS/eip-712.md#specification-of-the-eth_signtypeddata-json-rpc
    return {
      type: 'object',
      properties: {
        types: {
          type: 'object',
          additionalProperties: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                type: { type: 'string', enum: this._solidityTypes }
              },
              required: ['name', 'type']
            }
          }
        },
        primaryType: { type: 'string' },
        domain: { type: 'object' },
        message: { type: 'object' }
      }
    }
  }

  async encryptMessage(typedData, customIv = null) {
    const ajv = new Ajv()
    const valid = ajv.validate(this.typedDataSchema, typedData)

    if (!valid) {
      throw new Error(
        'Data must follow the EIP712 standard. ' + ajv.errorsText()
      )
    }

    return this.encrypt(typedData, customIv)
  }

  async encrypt(data, customIv = null) {
    const key = this._sharedKey
    if (!key) {
      throw new Error(
        'Shared key is required. Please set `sharedKey` before using encryption'
      )
    }

    // use custom iv or generate one
    let rawIv = customIv
    if (!rawIv) {
      rawIv = await generateKey(128 / 8)
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
    const key = this._sharedKey
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

  // EIP681: http://eips.ethereum.org/EIPS/eip-681
  parseTransactionRequest(url) {
    const res = URLTransactionRequest.decode(url)
    if (res.chain_id !== this.chainId) {
      throw new Error('chain_id does not match')
    }

    return res
  }

  // EIP681: http://eips.ethereum.org/EIPS/eip-681
  // tx.target_address is mandatory
  stringifyTransactionRequest(tx) {
    // overwrite/add chain_id
    tx.chain_id = this.chainId
    return URLTransactionRequest.encode(tx)
  }

  // -- Private Methods ----------------------------------------------------- //

  //
  //  Format ERC-1328 URI Format
  //
  _formatURI() {
    const _sharedKey = Buffer.from(this.sharedKey, 'hex')
    const symKey = _sharedKey.toString('base64')
    const uri = `ethereum:wc-${this.sessionId}@1?name=${this.dappName}&bridge=${
      this.bridgeUrl
    }&symKey=${symKey}`
    return uri
  }

  //
  //  Parse ERC-1328 URI Format
  //
  _parseURI(string) {
    const standardURI = parseStandardURI(string)
    if (standardURI.prefix && standardURI.prefix === 'wc') {
      if (!standardURI.sessionID) {
        throw Error('Missing sessionID field')
      }

      if (!standardURI.bridge) {
        throw Error('Missing bridge field')
      }

      if (!standardURI.symKey) {
        throw Error('Missing symKey field')
      }

      const uri = {
        protocol: standardURI.protocol,
        version: standardURI.version,
        sessionID: standardURI.sessionID,
        bridgeUrl: standardURI.bridge,
        dappName: standardURI.name,
        sharedKey: Buffer.from(standardURI.symKey, 'base64').toString('hex')
      }
      return uri
    } else {
      throw new Error('URI doesn\'t follow ERC-1328 standard')
    }
  }

  //
  //  Fetch Bridge Payload
  //

  async _fetchBridge(url, headers = null, body = null) {
    const requestUrl = `${this.bridgeUrl}${url}`

    const config = {
      headers: {
        method: 'GET',
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    }

    if (headers) {
      config.headers = { ...config.headers, ...headers }
    }

    if (body) {
      config.body = JSON.stringify(body)
    }

    const res = await fetch(requestUrl, config)

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

  //
  // Get solidityTypes
  //

  get _solidityTypes() {
    const types = ['bool', 'address', 'int', 'uint', 'string', 'byte']
    const ints = Array.from(new Array(32)).map(
      (e, index) => `int${(index + 1) * 8}`
    )
    const uints = Array.from(new Array(32)).map(
      (e, index) => `uint${(index + 1) * 8}`
    )
    const bytes = Array.from(new Array(32)).map(
      (e, index) => `bytes${index + 1}`
    )

    return types
      .concat(ints)
      .concat(uints)
      .concat(bytes)
  }
}
