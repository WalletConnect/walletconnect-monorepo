import { ISocketMessage } from '@walletconnect/types'

interface ISocketTransportOptions {
  bridge: string
  clientId: string
  callback: any
}

// -- SocketTransport ------------------------------------------------------ //

class SocketTransport {
  private _bridge: string
  private _clientId: string
  private _socket: WebSocket | null
  private _queue: ISocketMessage[]
  private _pingInterval: any
  private _callback: any

  constructor (opts: ISocketTransportOptions) {
    this._bridge = ''
    this._clientId = ''
    this._socket = null
    this._queue = []
    this._pingInterval = null
    this._callback = () => {}

    if (opts.bridge && typeof opts.bridge !== 'string') {
      throw new Error('Missing or invalid bridge field')
    }

    this._bridge = opts.bridge

    if (opts.clientId && typeof opts.clientId !== 'string') {
      throw new Error('Missing or invalid clientId field')
    }

    this._clientId = opts.clientId

    if (opts.callback && typeof opts.callback !== 'function') {
      throw new Error('Missing or invalid callback field')
    }

    this._callback = opts.callback
  }

  set bridge (value: string) {
    if (!value) {
      return
    }
    this._bridge = value
  }

  get bridge () {
    return this._bridge
  }

  set clientId (value: string) {
    if (!value) {
      return
    }
    this._clientId = value
  }

  get clientId () {
    return this._clientId
  }

  public open () {
    this._socketOpen()
  }

  public send (socketMessage: ISocketMessage) {
    if (this._socket && this._socket.readyState === 1) {
      this._socketSend(socketMessage)
    } else {
      this._setToQueue(socketMessage)
    }
  }

  public setToQueue (socketMessage: ISocketMessage) {
    this._setToQueue(socketMessage)
  }

  public togglePing () {
    this._toggleSocketPing()
  }

  private _socketOpen () {
    const bridge = this.bridge

    const url = bridge.startsWith('https')
      ? bridge.replace('https', 'wss')
      : bridge.startsWith('http')
        ? bridge.replace('http', 'ws')
        : bridge

    const socket = new WebSocket(url)

    socket.onmessage = (event: MessageEvent) => this._socketReceive(event)

    socket.onopen = () => {
      this._socket = socket

      this._setToQueue({
        topic: `${this.clientId}`,
        type: 'sub',
        payload: ''
      })

      this._dispatchQueue()
      this._toggleSocketPing()
    }
  }

  private _toggleSocketPing () {
    if (this._socket && this._socket.readyState === 1) {
      this._pingInterval = setInterval(
        () => {
          if (this._socket) {
            this._socket.send('ping')
          }
        },
        10000 // 10 seconds
      )
    } else {
      clearInterval(this._pingInterval)
    }
  }

  private _socketSend (socketMessage: ISocketMessage) {
    if (!this._socket) {
      throw new Error('Missing socket: required for sending message')
    }

    const message: string = JSON.stringify(socketMessage)

    if (this._socket && this._socket.readyState === 1) {
      this._socket.send(message)
    } else {
      this._setToQueue(socketMessage)
      this._socketOpen()
    }
  }

  private async _socketReceive (event: MessageEvent) {
    let socketMessage: ISocketMessage

    if (event.data === 'pong') {
      return
    }

    try {
      socketMessage = JSON.parse(event.data)
    } catch (error) {
      throw error
    }

    this._callback(socketMessage)
  }

  private _setToQueue (socketMessage: ISocketMessage) {
    this._queue.push(socketMessage)
  }

  private _dispatchQueue () {
    const queue = this._queue

    queue.forEach((socketMessage: ISocketMessage) =>
      this._socketSend(socketMessage)
    )

    this._queue = []
  }
}

export default SocketTransport
