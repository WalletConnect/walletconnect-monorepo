import { ISocketMessage } from '@walletconnect/types'

interface ISocketTransportOptions {
  bridge: string
  clientId: string
  callback: any
}

class SocketTransport {
  private _bridge: string
  private _socket: WebSocket | null
  private _queue: ISocketMessage[]
  private _pingInterval: any
  private _callback: any

  // -- constructor ----------------------------------------------------- //

  constructor (opts: ISocketTransportOptions) {
    this._bridge = ''
    this._socket = null
    this._queue = []
    this._pingInterval = null
    this._callback = () => {}

    if (opts.bridge && typeof opts.bridge !== 'string') {
      throw new Error('Missing or invalid bridge field')
    }

    this._bridge = opts.bridge

    if (opts.callback && typeof opts.callback !== 'function') {
      throw new Error('Missing or invalid callback field')
    }

    this._callback = opts.callback
  }

  // -- public ---------------------------------------------------------- //

  public open (queuedMessages?: ISocketMessage[]) {
    this._socketOpen(queuedMessages)
  }

  public send (socketMessage: ISocketMessage): void {
    if (this._socket && this._socket.readyState === 1) {
      this._socketSend(socketMessage)
    } else {
      this._setToQueue(socketMessage)
    }
  }

  public setToQueue (socketMessage: ISocketMessage): void {
    this._setToQueue(socketMessage)
  }

  public togglePing (): void {
    this._toggleSocketPing()
  }

  // -- private ---------------------------------------------------------- //

  private _socketOpen (queuedMessages?: ISocketMessage[]) {
    const bridge = this._bridge

    const url = bridge.startsWith('https')
      ? bridge.replace('https', 'wss')
      : bridge.startsWith('http')
        ? bridge.replace('http', 'ws')
        : bridge

    const socket = new WebSocket(url)

    socket.onmessage = (event: MessageEvent) => this._socketReceive(event)

    socket.onopen = () => {
      this._socket = socket

      if (queuedMessages && queuedMessages.length) {
        queuedMessages.forEach((msg: ISocketMessage) => this._setToQueue(msg))
      }

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
