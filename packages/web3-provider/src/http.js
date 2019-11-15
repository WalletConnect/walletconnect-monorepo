import EventEmitter from 'events'
import { XMLHttpRequest } from 'xhr2-cookies'

// -- global -------------------------------------------------------------- //
const wwindow = window

const XHR =
  typeof wwindow !== 'undefined' &&
  typeof wwindow.XMLHttpRequest !== 'undefined'
    ? wwindow.XMLHttpRequest
    : XMLHttpRequest

// -- HTTPConnection ------------------------------------------------------ //

class HTTPConnection extends EventEmitter {
  constructor (url) {
    super()
    this.url = url
    this.post = {
      body: null,
      headers: { 'Content-Type': 'application/json' },
      method: 'POST'
    }
  }

  formatError (payload, message, code = -1) {
    return {
      error: { message, code },
      id: payload.id,
      jsonrpc: payload.jsonrpc
    }
  }

  send (payload, internal) {
    return new Promise(resolve => {
      if (payload.method === 'eth_subscribe') {
        const error = this.formatError(
          payload,
          'Subscriptions are not supported by this HTTP endpoint'
        )
        return resolve(error)
      }
      const xhr = new XHR()

      let responded = false

      const res = (err, result) => {
        if (!responded) {
          xhr.abort()
          responded = true
          if (internal) {
            internal(err, result)
          } else {
            const { id, jsonrpc } = payload
            const response = err
              ? { id, jsonrpc, error: { message: err.message, code: err.code } }
              : { id, jsonrpc, result }
            resolve(response)
          }
        }
      }

      try {
        this.post.body = JSON.stringify(payload)
      } catch (e) {
        return res(e)
      }

      xhr.open('POST', this.url, true)
      xhr.timeout = 60 * 1000
      xhr.onerror = res
      xhr.ontimeout = res
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          try {
            const response = JSON.parse(xhr.responseText)
            res(response.error, response.result)
          } catch (e) {
            res(e)
          }
        }
      }
      xhr.send(JSON.stringify(payload))
    })
  }
}

export default HTTPConnection
