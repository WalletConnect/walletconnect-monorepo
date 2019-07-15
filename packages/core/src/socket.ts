import { ISocketMessage, ITransportEvent } from '@walletconnect/types'

interface ISocketTransportOptions {
  bridge: string
  clientId: string
}

// -- SocketTransport ------------------------------------------------------ //

class SocketTransport {
  private _bridge: string
  private _clientId: string
  private _socket: WebSocket | null
  private _queue: ISocketMessage[]
  private _events: ITransportEvent[] = []

  // -- constructor ----------------------------------------------------- //

  constructor (opts: ISocketTransportOptions) {
    this._bridge = ''
    this._socket = null
    this._queue = []

    if (!opts.bridge || typeof opts.bridge !== 'string') {
      throw new Error('Missing or invalid bridge field')
    }

    this._bridge = opts.bridge

    if (!opts.clientId || typeof opts.clientId !== 'string') {
      throw new Error('Missing or invalid clientId field')
    }

    this._clientId = opts.clientId
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

  public close () {
    if (this._socket && this._socket.readyState === 1) {
      this._socket.close()
    }
  }

  public on (event: string, callback: (payload: any) => void) {
    this._events.push({ event, callback })
  }

  // -- private ---------------------------------------------------------- //

  private _socketOpen () {
    const bridge = this._bridge

    this._setToQueue({
      topic: `${this._clientId}`,
      type: 'sub',
      payload: '',
      silent: true
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
      return
    }

    if (this._socket && this._socket.readyState === 1) {
      const events = this._events.filter(event => event.event === 'message')
      if (events && events.length) {
        events.forEach(event => event.callback(socketMessage))
      }
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
}

export default SocketTransport
