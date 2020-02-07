import { ISocketMessage, ITransportEvent } from '@walletconnect/types'

interface ISocketTransportOptions {
  bridge: string
  clientId: string
}

// -- SocketTransport ------------------------------------------------------ //

class SocketTransport {
  private _initiating: boolean
  private _bridge: string
  private _clientId: string
  private _socket: WebSocket | null
  private _queue: ISocketMessage[]
  private _events: ITransportEvent[] = []

  // -- constructor ----------------------------------------------------- //

  constructor (opts: ISocketTransportOptions) {
    this._initiating = false
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

  set readyState (value) {
    // empty
  }

  get readyState (): number {
    return this._socket ? this._socket.readyState : -1
  }

  set connecting (value) {
    // empty
  }

  get connecting (): boolean {
    return this.readyState === 0
  }

  set connected (value) {
    // empty
  }

  get connected (): boolean {
    return this.readyState === 1
  }

  set closing (value) {
    // empty
  }

  get closing (): boolean {
    return this.readyState === 2
  }

  set closed (value) {
    // empty
  }

  get closed (): boolean {
    return this.readyState === 3
  }

  // -- public ---------------------------------------------------------- //

  public open () {
    this._socketOpen()
  }

  public send (socketMessage: ISocketMessage): void {
    this._socketSend(socketMessage)
  }

  public close () {
    this._socketClose()
  }

  public on (event: string, callback: (payload: any) => void) {
    this._events.push({ event, callback })
  }

  // -- private ---------------------------------------------------------- //

  private _socketOpen (forceOpen?: boolean) {
    if ((typeof forceOpen !== 'undefined' && !forceOpen) || this._initiating) {
      return
    }

    this._initiating = true
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
      this._trigger('open')
      this._socketClose()
      this._initiating = false
      this._socket = socket
      this._pushQueue()
    }

    socket.onclose = () => {
      this._trigger('close')
      this._socketOpen(true)
    }
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

    if (this._socket && this.connected) {
      this._socket.send(message)
    } else {
      this._setToQueue(socketMessage)
      this._socketOpen()
    }
  }

  private async _socketReceive (event: MessageEvent) {
    let socketMessage: ISocketMessage

    try {
      socketMessage = JSON.parse(event.data)
    } catch (error) {
      return
    }

    if (this.connected) {
      this._trigger('message', socketMessage)
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

  private _trigger (eventName: string, payload?: any) {
    const events = this._events.filter(event => event.event === eventName)
    if (events && events.length) {
      events.forEach(event => event.callback(payload))
    }
  }
}

export default SocketTransport
