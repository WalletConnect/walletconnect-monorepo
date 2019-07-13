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
  private _incoming: ISocketMessage[]
  private _callback: any

  // -- constructor ----------------------------------------------------- //

  constructor (opts: ISocketTransportOptions) {
    this._bridge = ''
    this._socket = null
    this._queue = []
    this._incoming = []
    this._callback = () => {
      // empty
    }

    if (!opts.bridge || typeof opts.bridge !== 'string') {
      throw new Error('Missing or invalid bridge field')
    }

    this._bridge = opts.bridge

    if (!opts.clientId || typeof opts.clientId !== 'string') {
      throw new Error('Missing or invalid clientId field')
    }

    this._clientId = opts.clientId

    if (!opts.callback || typeof opts.callback !== 'function') {
      throw new Error('Missing or invalid callback field')
    }

    this._callback = opts.callback
  }

  // -- public ---------------------------------------------------------- //

  public open () {
    this._socketOpen()
  }

  public send (socketMessage: ISocketMessage): void {
    if (this._socket && this._socket.readyState === 1) {
      this._socketSend(socketMessage)
    } else {
      this._setToQueue(socketMessage)
    }
  }

  public queue (socketMessage: ISocketMessage): void {
    this._setToQueue(socketMessage)
  }

  public pushIncoming () {
    this._pushIncoming()
  }

  public close () {
    if (this._socket && this._socket.readyState === 1) {
      this._socket.close()
    }
  }

  // -- private ---------------------------------------------------------- //

  private _socketOpen () {
    const bridge = this._bridge

    this.queue({
      topic: `${this._clientId}`,
      type: 'sub',
      payload: ''
    })

    const url = bridge.startsWith('https')
      ? bridge.replace('https', 'wss')
      : bridge.startsWith('http')
        ? bridge.replace('http', 'ws')
        : bridge

    const socket = new WebSocket(url)

    socket.onmessage = (event: MessageEvent) => this._socketReceive(event)

    socket.onopen = () => {
      this._socket = socket

      const queuedMessages = this._queue

      if (queuedMessages && queuedMessages.length) {
        queuedMessages.forEach((msg: ISocketMessage) => this._setToQueue(msg))
      }

      this._pushQueue()
    }
    socket.onclose = () => {
      this._socketOpen()
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

    if (event.data === 'ping') {
      if (this._socket && this._socket.readyState === 1) {
        this._socket.send('pong')
      }
      return
    }

    if (event.data === 'pong') {
      return
    }

    try {
      socketMessage = JSON.parse(event.data)
    } catch (error) {
      throw error
    }

    if (this._socket && this._socket.readyState === 1) {
      this._callback(socketMessage)
    } else {
      this._incoming.push(socketMessage)
    }
  }

  private _setToQueue (socketMessage: ISocketMessage) {
    this._queue.push(socketMessage)
  }

  private _pushQueue () {
    const queue = this._queue

    queue.forEach((socketMessage: ISocketMessage) =>
      this._socketSend(socketMessage)
    )

    this._queue = []
  }

  private _pushIncoming () {
    const incoming = this._incoming

    incoming.forEach((socketMessage: ISocketMessage) =>
      this._callback(socketMessage)
    )

    this._incoming = []
  }
}

export default SocketTransport
