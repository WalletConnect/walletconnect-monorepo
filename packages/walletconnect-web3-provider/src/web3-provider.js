import { WebConnector } from 'walletconnect'

let XMLHttpRequest = null
let localStorage = null
if (typeof window !== 'undefined' && window.XMLHttpRequest) {
  XMLHttpRequest = window.XMLHttpRequest
} else {
  throw new Error('XMLHttpRequest not found')
}

if (typeof window !== 'undefined' && window.localStorage) {
  localStorage = window.localStorage
}

function getCallback(payload, cb) {
  return function(err, result) {
    const obj = {}
    const keys = ['id', 'jsonrpc']
    keys.forEach(key => {
      obj[key] = payload[key]
    })
    obj.result = result
    cb(err, obj)
  }
}

export default class WalletConnectProvider {
  constructor({
    host = 'http://localhost:8545',
    timeout = 0,
    user,
    password,
    headers,
    webconnector,
    bridgeURL = 'https://bridge.walletconnect.org',
    dappName = 'Unknown DApp'
  }) {
    this.host = host
    this.timeout = timeout
    this.user = user
    this.password = password
    this.headers = headers
    this.dappName = dappName

    // set webconnector
    this.webconnector = webconnector
    this.bridgeURL = bridgeURL

    // sessionPromise
    this.sessionPromise = null
    this._accounts = []
  }

  /**
   * Should be called to prepare new XMLHttpRequest
   *
   * @method prepareRequest
   * @param {Boolean} true if request should be async
   * @return {XMLHttpRequest} object
   */
  prepareRequest(isAsync = true) {
    const request = new XMLHttpRequest()
    request.open('POST', this.host, isAsync)
    if (this.user && this.password) {
      const authString = Buffer.from(this.user + ':' + this.password).toString(
        'base64'
      )
      request.setRequestHeader('Authorization', `Basic ${authString}`)
    }
    request.setRequestHeader('Content-Type', 'application/json')

    // set headers
    if (this.headers) {
      this.headers.forEach(header => {
        request.setRequestHeader(header.name, header.value)
      })
    }

    return request
  }

  /**
   * Should be called to make sync request
   *
   * @method send
   * @param {Object} payload
   * @return {Object} result
   */
  send(payload = {}) {
    let request = this.prepareRequest(false)

    try {
      request.send(JSON.stringify(payload))
    } catch (error) {
      throw new Error(`Invalid connection ${this.host}`)
    }

    let result = request.responseText
    try {
      result = JSON.parse(result)
    } catch (e) {
      throw new Error(`Invalid response ${request.responseText}`)
    }

    return result
  }

  createWebconnector() {
    let sessionId, sharedKey, address
    if (localStorage) {
      sessionId = localStorage.getItem('sessionId')
      sharedKey = localStorage.getItem('sharedKey')
      address = localStorage.getItem('address')
    }

    // create WebConnector
    const webconnector = new WebConnector(this.bridgeURL, {
      sessionId: sessionId,
      sharedKey: sharedKey,
      dappName: this.dappName
    })

    // session id, shared key and address
    if (sessionId && sharedKey && address) {
      // set webconnector object
      this.webconnector = webconnector

      return Promise.resolve({ address: address })
    }

    // create new session
    return webconnector.createSession().then(obj => {
      // show QR code for walletconnect compatible app
      const event = new window.CustomEvent('walletconnect:session', {
        detail: JSON.stringify(obj)
      })
      window.dispatchEvent(event)

      // start listening session status
      return new Promise((resolve, reject) => {
        // setup listener
        let sessionListener = null
        function closeSession() {
          if (sessionListener) {
            sessionListener.stop()
          }

          sessionListener = null
        }

        // start listening close event or data event
        window.addEventListener('walletconnect:dismissed', e => {
          // close session
          closeSession()

          // throw new
          reject(
            new Error('Walletconnect session: User denied session creation')
          )
        })

        sessionListener = webconnector.listenSessionStatus((err, result) => {
          // set webconnector object
          this.webconnector = webconnector
          // emit session created event
          const event = new window.CustomEvent(
            'walletconnect:session:created',
            {
              detail: JSON.stringify({ ...obj, ...result })
            }
          )
          window.dispatchEvent(event)

          // close session
          closeSession()

          if (err) {
            reject(err)
          } else {
            // session id and shared key
            if (localStorage) {
              localStorage.setItem('sessionId', obj.sessionId)
              localStorage.setItem('sharedKey', obj.sharedKey)
              localStorage.setItem('address', result.address)
            }
            resolve(result)
          }
        })
      })
    })
  }

  _sendAsync(payload, callback) {
    const request = this.prepareRequest(true)
    request.onreadystatechange = () => {
      if (request.readyState === 4 && request.timeout !== 1) {
        let result = request.responseText
        let error = null

        try {
          result = JSON.parse(result)
        } catch (e) {
          error = new Error(`Invalid response ${request.responseText}`)
        }

        callback(error, result)
      }
    }

    request.ontimeout = () => {
      callback(new Error(`Connection timeout ${this.timeout}`))
    }

    try {
      request.send(JSON.stringify(payload))
    } catch (error) {
      callback(new Error(`Invalid connection ${this.host}`))
    }
  }

  /**
   * Should be used to make async request
   *
   * @method sendAsync
   * @param {Object} payload
   * @param {Function} callback triggered on end with (err, result)
   */
  sendAsync(payload, callback) {
    let p = Promise.resolve()
    if (!this.webconnector) {
      if (!this.sessionPromise) {
        // create WebConnector
        this.sessionPromise = this.createWebconnector()
        this.sessionPromise.then(data => {
          if (
            data.address &&
            this._accounts.indexOf(data.address.toLowerCase()) === -1
          ) {
            this._accounts.push(data.address.toLowerCase())
          }
        })
      }
      p = this.sessionPromise
    }

    // sign transactions and data
    if (payload.method === 'eth_signTypedData') {
      return p
        .then(() => {
          return this.webconnector.createTransaction(payload)
        })
        .then(({ transactionId }) => {
          this.webconnector.listenTransactionStatus(
            transactionId,
            getCallback(payload, callback)
          )
        })
        .catch(getCallback(payload, callback))
    } else if (payload.method === 'eth_sendTransaction') {
      return p
        .then(() => {
          return this.webconnector.createTransaction(payload)
        })
        .then(({ transactionId }) => {
          this.webconnector.listenTransactionStatus(
            transactionId,
            (err, data) => {
              if (err) {
                getCallback(payload, callback)(err, null)
              } else {
                this._sendAsync(
                  {
                    id: payload.id,
                    jsonrpc: payload.jsonrpc,
                    method: 'eth_sendRawTransaction',
                    params: [data]
                  },
                  callback
                )
              }
            }
          )
        })
        .catch(getCallback(payload, callback))
    } else if (payload.method === 'eth_accounts') {
      // call accounts
      return p
        .then(() => {
          getCallback(payload, callback)(null, this._accounts)
        })
        .catch(getCallback(payload, callback))
    }

    // normal call
    p.then(() => {
      this._sendAsync(payload, callback)
    }).catch(error => {
      callback(new Error(`Invalid connection ${error}`))
    })
  }

  /**
   * Synchronously tries to make Http request
   *
   * @method isConnected
   * @return {Boolean} returns true if request haven't failed. Otherwise false
   */
  isConnected() {
    if (this.webconnector) {
      return true
    }

    return false
  }
}
