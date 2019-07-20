import { ISocketMessage, ITransportEvent } from '@walletconnect/types'

interface ISocketTransportOptions {
  bridge: string
  clientId: string
}

// -- SocketTransport ------------------------------------------------------ //

class SocketTransport {
  private _initiating: boolean
  private _bridge: string
  private _socket: WebSocket | null
  private _nextSocket: WebSocket | null
  private _queue: ISocketMessage[]
  private _events: ITransportEvent[] = []
  private _subscriptions: string[] = []

  // -- constructor ----------------------------------------------------- //

  constructor (opts: ISocketTransportOptions) {
    this._initiating = false
    this._bridge = ''
    this._socket = null
    this._nextSocket = null
    this._queue = []

    if (!opts.bridge || typeof opts.bridge !== 'string') {
      throw new Error('Missing or invalid bridge field')
    }

    this._bridge = opts.bridge

    if (!opts.clientId || typeof opts.clientId !== 'string') {
      throw new Error('Missing or invalid clientId field')
    }

    this._subscriptions.push(opts.clientId)

    window.addEventListener('online', () => this._socketCreate())
  }

  // -- public ---------------------------------------------------------- //

  public open () {
    this._socketCreate()
  }

  public send (message: string, topic?: string, silent?: boolean): void {
    if (!topic || typeof topic !== 'string') {
      throw new Error('Missing or invalid topic field')
    }

    this._socketSend({
      topic: topic,
      type: 'pub',
      payload: message,
      silent: !!silent
    })
  }

  public close () {
    this._socketClose()
  }

  public on (event: string, callback: (payload: any) => void) {
    this._events.push({ event, callback })
  }

  public subscribeTo (topic: string) {
    this._socketSend({
      topic: topic,
      type: 'sub',
      payload: '',
      silent: true
    })
  }

  // -- private ---------------------------------------------------------- //

  private _socketCreate () {
    if (this._initiating) {
      return
    }

    this._initiating = true
    const bridge = this._bridge

    const url = bridge.startsWith('https')
      ? bridge.replace('https', 'wss')
      : bridge.startsWith('http')
        ? bridge.replace('http', 'ws')
        : bridge

    this._nextSocket = new WebSocket(url)

    this._nextSocket.onmessage = (event: MessageEvent) =>
      this._socketReceive(event)

    this._nextSocket.onopen = () => this._socketOpen()
  }

  private _socketOpen () {
    this._socketClose()
    this._initiating = false
    this._socket = this._nextSocket
    this._nextSocket = null
    this._queueSubscriptions()
    this._pushQueue()
  }

  private _queueSubscriptions () {
    const subscriptions = this._subscriptions

    subscriptions.forEach((topic: string) =>
      this._queue.push({
        topic: topic,
        type: 'sub',
        payload: '',
        silent: true
      })
    )

    this._subscriptions = []
  }

  private _socketClose () {
    if (this._socket) {
      this._socket.onclose = () => {
        // empty
      }
      this._socket.close()
    }
  }

  private _socketSend (socketMessage: ISocketMessage) {
    const message: string = JSON.stringify(socketMessage)

    if (this._socket && this._socket.readyState === 1) {
      this._socket.send(message)
    } else {
      this._setToQueue(socketMessage)
      this._socketCreate()
    }
  }

  private async _socketReceive (event: MessageEvent) {
    let socketMessage: ISocketMessage

    try {
      socketMessage = JSON.parse(event.data)
    } catch (error) {
      return
    }

    this._socketSend({
      topic: socketMessage.topic,
      type: 'ack',
      payload: '',
      silent: true
    })

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
