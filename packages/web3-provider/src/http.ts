import EventEmitter from 'events'
import { XMLHttpRequest } from 'xhr2-cookies'
import { uuid } from '@walletconnect/utils'
import { IError } from '@walletconnect/types'

// -- global -------------------------------------------------------------- //
const _window: any = window

const XHR =
  typeof _window !== 'undefined' &&
  typeof _window.XMLHttpRequest !== 'undefined'
    ? _window.XMLHttpRequest
    : XMLHttpRequest

// -- types --------------------------------------------------------------- //
type XHRPost = {
  method: string
  headers: {
    [key: string]: string
  }
  body: any
}

// -- HTTPConnection ------------------------------------------------------ //

class HTTPConnection extends EventEmitter {
  public closed: boolean
  public connected: boolean
  public subscriptions: boolean
  public status: string
  public url: string
  public pollId: string
  public post: XHRPost
  public subscriptionTimeout: any

  constructor (url: string) {
    super()
    this.closed = false
    this.connected = false
    this.subscriptions = false
    this.status = 'loading'
    this.url = url
    this.pollId = uuid()
    this.post = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: null
    }
    setTimeout(() => this.create(), 0)
  }
  public create (): void {
    if (!XHR) {
      this.emit('error', new Error('No HTTP transport available'))
      return
    }
    this.on('error', () => {
      if (this.connected) this.close()
    })
    this.init()
  }
  init () {
    this.send(
      { jsonrpc: '2.0', method: 'eth_syncing', params: [], id: 1 },
      (err: IError, response: any) => {
        if (err) {
          this.emit('error', err)
          return
        }
        this.send(
          {
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_pollSubscriptions',
            params: [this.pollId, 'immediate']
          },
          (err: IError, response: any) => {
            if (!err) {
              this.subscriptions = true
              this.pollSubscriptions()
            }
            this.connected = true
            this.emit('connect')
          }
        )
      }
    )
  }
  pollSubscriptions () {
    this.send(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_pollSubscriptions',
        params: [this.pollId]
      },
      (err: IError, result: any) => {
        if (err) {
          this.subscriptionTimeout = setTimeout(
            () => this.pollSubscriptions(),
            10000
          )
          this.emit('error', err)
        } else {
          if (!this.closed) {
            this.subscriptionTimeout = this.pollSubscriptions()
          }
          if (result) {
            result
              .map((p: any) => {
                let parse
                try {
                  parse = JSON.parse(p)
                } catch (e) {
                  parse = false
                }
                return parse
              })
              .filter((n: any) => n)
              .forEach((p: any) => this.emit('payload', p))
          }
        }
      }
    )
  }
  close () {
    this.closed = true
    this.emit('close')
    clearTimeout(this.subscriptionTimeout)
    this.removeAllListeners()
  }
  filterStatus (res: any) {
    if (res.status >= 200 && res.status < 300) return res
    let error: IError = new Error(res.statusText)
    error.res = res
    throw error.message
  }
  error (payload: any, message: string, code = -1) {
    this.emit('payload', {
      id: payload.id,
      jsonrpc: payload.jsonrpc,
      error: { message, code }
    })
  }
  send (payload: any, internal?: any) {
    if (this.closed) return this.error(payload, 'Not connected')
    if (payload.method === 'eth_subscribe') {
      if (this.subscriptions) {
        payload.pollId = this.pollId
      } else {
        return this.error(
          payload,
          'Subscriptions are not supported by this HTTP endpoint'
        )
      }
    }
    let xhr = new XHR()
    let responded = false
    let res = (err: IError, result?: any) => {
      if (!responded) {
        xhr.abort()
        responded = true
        if (internal) {
          internal(err, result)
        } else {
          let { id, jsonrpc } = payload
          let load = err
            ? { id, jsonrpc, error: { message: err.message, code: err.code } }
            : { id, jsonrpc, result }
          this.emit('payload', load)
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
          let response = JSON.parse(xhr.responseText)
          res(response.error, response.result)
        } catch (e) {
          res(e)
        }
      }
    }
    xhr.send(JSON.stringify(payload))
  }
}

export default HTTPConnection
