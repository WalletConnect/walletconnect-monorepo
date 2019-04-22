import {
  ICryptoLib,
  IEncryptionPayload,
  ISocketMessage,
  ISessionStatus,
  ISessionError,
  IInternalEvent,
  IJsonRpcResponseSuccess,
  IJsonRpcResponseError,
  IJsonRpcRequest,
  ITxData,
  IClientMeta,
  IEventEmitter,
  IParseURIResult,
  ISessionParams,
  IWalletConnectSession,
  IWalletConnectOptions
} from '@walletconnect/types'
import {
  parseTransactionData,
  convertArrayBufferToHex,
  convertHexToArrayBuffer,
  getMeta,
  payloadId,
  uuid,
  formatRpcError,
  parseWalletConnectUri,
  isHexStrict,
  convertUtf8ToHex
} from '@walletconnect/utils'

// -- typeChecks ----------------------------------------------------------- //

function isRpcRequest (object: any): object is IJsonRpcRequest {
  return 'method' in object
}

function isRpcResponseSuccess (object: any): object is IJsonRpcResponseSuccess {
  return 'result' in object
}

function isRpcResponseError (object: any): object is IJsonRpcResponseError {
  return 'error' in object
}

function isInternalEvent (object: any): object is IInternalEvent {
  return 'event' in object
}

function isWalletConnectSession (object: any): object is IWalletConnectSession {
  return 'bridge' in object
}

// -- localStorage --------------------------------------------------------- //

const storageId: string = 'walletconnect'
let storage: Storage | null = null

if (
  typeof window !== 'undefined' &&
  typeof window.localStorage !== 'undefined'
) {
  storage = window.localStorage
}

// -- Connector ------------------------------------------------------------ //

class Connector {
  private cryptoLib: ICryptoLib

  private protocol: string
  private version: number

  private _bridge: string
  private _key: ArrayBuffer | null
  private _nextKey: ArrayBuffer | null

  private _clientId: string
  private _clientMeta: IClientMeta | null
  private _peerId: string
  private _peerMeta: IClientMeta | null
  private _handshakeId: number
  private _handshakeTopic: string
  private _accounts: string[]
  private _chainId: number
  private _socket: WebSocket | null
  private _queue: ISocketMessage[]
  private _eventEmitters: IEventEmitter[]
  private _connected: boolean
  private _pingInterval: any

  // -- constructor ----------------------------------------------------- //

  constructor (
    cryptoLib: ICryptoLib,
    opts: IWalletConnectOptions,
    clientMeta?: IClientMeta
  ) {
    this.cryptoLib = cryptoLib

    this.protocol = 'wc'
    this.version = 1

    this._bridge = ''
    this._key = null
    this._nextKey = null

    this._clientId = ''
    this._clientMeta = null
    this._peerId = ''
    this._peerMeta = null
    this._handshakeId = 0
    this._handshakeTopic = ''
    this._accounts = []
    this._chainId = 0
    this._socket = null
    this._queue = []
    this._eventEmitters = []
    this._connected = false
    this._pingInterval = null

    if (
      typeof window !== 'undefined' &&
      typeof window.location !== 'undefined' &&
      window.location.protocol !== 'https:' &&
      window.location.hostname !== 'localhost'
    ) {
      throw new Error('HTTPS is required for non-localhost origins')
    }

    if (clientMeta) {
      this.clientMeta = clientMeta
    }

    if (!opts.bridge && !opts.uri && !opts.session) {
      throw new Error(
        'Missing one of two required parameters: bridge / uri / session'
      )
    }

    if (opts.bridge) {
      this.bridge = opts.bridge
    }

    if (opts.uri) {
      this.uri = opts.uri
      this._subscribeToSessionRequest()
    }

    const session = opts.session || this._getStorageSession()
    if (session) {
      this.session = session
    }

    if (this.handshakeId) {
      this._subscribeToSessionResponse(
        this.handshakeId,
        'Session request rejected'
      )
    }

    this._subscribeToInternalEvents()
    this._socketOpen()
  }

  // -- setters / getters ----------------------------------------------- //

  set bridge (value: string) {
    if (!value) {
      return
    }
    this._bridge = value
  }

  get bridge () {
    return this._bridge
  }

  set key (value: string) {
    if (!value) {
      return
    }
    const key: ArrayBuffer = convertHexToArrayBuffer(value)
    this._key = key
  }

  get key (): string {
    if (this._key) {
      const key: string = convertArrayBufferToHex(this._key)
      return key
    }
    return ''
  }

  set nextKey (value: string) {
    if (!value) {
      return
    }
    const nextKey: ArrayBuffer = convertHexToArrayBuffer(value)
    this._nextKey = nextKey
  }

  get nextKey (): string {
    if (this._nextKey) {
      const nextKey: string = convertArrayBufferToHex(this._nextKey)
      return nextKey
    }
    return ''
  }

  set clientId (value: string) {
    if (!value) {
      return
    }
    this._clientId = value
  }

  get clientId () {
    let clientId: string | null = this._clientId
    if (!clientId) {
      clientId = this._clientId = uuid()
    }

    return this._clientId
  }

  set peerId (value) {
    if (!value) {
      return
    }
    this._peerId = value
  }

  get peerId () {
    return this._peerId
  }

  set clientMeta (value) {
    // empty
  }

  get clientMeta () {
    let clientMeta: IClientMeta | null = this._clientMeta
    if (!clientMeta) {
      clientMeta = this._clientMeta = getMeta()
    }
    return clientMeta
  }

  set peerMeta (value) {
    this._peerMeta = value
  }

  get peerMeta () {
    const peerMeta: IClientMeta | null = this._peerMeta
    return peerMeta
  }

  set handshakeTopic (value) {
    if (!value) {
      return
    }
    this._handshakeTopic = value
  }

  get handshakeTopic () {
    return this._handshakeTopic
  }

  set handshakeId (value) {
    if (!value) {
      return
    }
    this._handshakeId = value
  }

  get handshakeId () {
    return this._handshakeId
  }

  get uri () {
    const _uri = this._formatUri()
    return _uri
  }

  set uri (value) {
    if (!value) {
      return
    }
    const { handshakeTopic, bridge, key } = this._parseUri(value)
    this.handshakeTopic = handshakeTopic
    this.bridge = bridge
    this.key = key
  }

  set chainId (value) {
    this._chainId = value
  }

  get chainId () {
    const chainId: number | null = this._chainId
    return chainId
  }

  set accounts (value) {
    this._accounts = value
  }

  get accounts () {
    const accounts: string[] | null = this._accounts
    return accounts
  }

  set connected (value) {
    // empty
  }

  get connected () {
    return this._connected
  }

  set pending (value) {
    // empty
  }

  get pending () {
    return !!this._handshakeTopic
  }

  get session () {
    return {
      connected: this.connected,
      accounts: this.accounts,
      chainId: this.chainId,
      bridge: this.bridge,
      key: this.key,
      clientId: this.clientId,
      clientMeta: this.clientMeta,
      peerId: this.peerId,
      peerMeta: this.peerMeta,
      handshakeId: this.handshakeId,
      handshakeTopic: this.handshakeTopic
    }
  }

  set session (value) {
    if (!value) {
      return
    }
    this._connected = value.connected
    this.accounts = value.accounts
    this.chainId = value.chainId
    this.bridge = value.bridge
    this.key = value.key
    this.clientId = value.clientId
    this.clientMeta = value.clientMeta
    this.peerId = value.peerId
    this.peerMeta = value.peerMeta
    this.handshakeId = value.handshakeId
    this.handshakeTopic = value.handshakeTopic
  }

  // -- public ---------------------------------------------------------- //

  public on (
    event: string,
    callback: (error: Error | null, payload: any | null) => void
  ): void {
    const eventEmitter = {
      event,
      callback
    }
    this._eventEmitters.push(eventEmitter)
  }

  public async createSession (opts?: { chainId: number }): Promise<void> {
    if (this._connected) {
      throw new Error('Session currently connected')
    }

    if (this.pending) {
      return
    }

    this._key = await this._generateKey()

    const request: IJsonRpcRequest = this._formatRequest({
      method: 'wc_sessionRequest',
      params: [
        {
          peerId: this.clientId,
          peerMeta: this.clientMeta,
          chainId: opts && opts.chainId ? opts.chainId : null
        }
      ]
    })

    this.handshakeId = request.id
    this.handshakeTopic = uuid()

    this._sendSessionRequest(
      request,
      'Session update rejected',
      this.handshakeTopic
    )
  }

  public approveSession (sessionStatus: ISessionStatus) {
    if (this._connected) {
      throw new Error('Session currently connected')
    }

    this.chainId = sessionStatus.chainId
    this.accounts = sessionStatus.accounts

    const sessionParams: ISessionParams = {
      approved: true,
      chainId: this.chainId,
      accounts: this.accounts,
      peerId: this.clientId,
      peerMeta: this.clientMeta
    }

    const response = {
      id: this.handshakeId,
      jsonrpc: '2.0',
      result: sessionParams
    }

    this._sendResponse(response)

    this._connected = true
    this._triggerEvents({
      event: 'connect',
      params: [
        {
          peerId: this.peerId,
          peerMeta: this.peerMeta,
          chainId: this.chainId,
          accounts: this.accounts
        }
      ]
    })
    if (this._connected) {
      this._setStorageSession()
    }
  }

  public rejectSession (sessionError?: ISessionError) {
    if (this._connected) {
      throw new Error('Session currently connected')
    }

    const message =
      sessionError && sessionError.message
        ? sessionError.message
        : 'Session Rejected'

    const response = this._formatResponse({
      id: this.handshakeId,
      error: { message }
    })

    this._sendResponse(response)

    this._connected = false
    this._triggerEvents({
      event: 'disconnect',
      params: [{ message }]
    })
    this._removeStorageSession()
  }

  public updateSession (sessionStatus: ISessionStatus) {
    if (!this._connected) {
      throw new Error('Session currently disconnected')
    }

    this.chainId = sessionStatus.chainId
    this.accounts = sessionStatus.accounts

    const sessionParams: ISessionParams = {
      approved: true,
      chainId: this.chainId,
      accounts: this.accounts
    }

    const request = this._formatRequest({
      method: 'wc_sessionUpdate',
      params: [sessionParams]
    })

    this._sendSessionRequest(request, 'Session update rejected')

    this._triggerEvents({
      event: 'session_update',
      params: [
        {
          chainId: this.chainId,
          accounts: this.accounts
        }
      ]
    })
    if (this._connected) {
      this._setStorageSession()
    } else {
      this._removeStorageSession()
    }
  }

  public killSession (sessionError?: ISessionError) {
    const message = sessionError ? sessionError.message : 'Session Disconnected'

    const sessionParams: ISessionParams = {
      approved: false,
      chainId: null,
      accounts: null
    }

    const request = this._formatRequest({
      method: 'wc_sessionUpdate',
      params: [sessionParams]
    })

    this._sendSessionRequest(request, 'Failed to kill Session')

    this._handleSessionDisconnect(message)
  }

  public async sendTransaction (tx: ITxData) {
    if (!this._connected) {
      throw new Error('Session currently disconnected')
    }

    const parsedTx = parseTransactionData(tx)

    const request = this._formatRequest({
      method: 'eth_sendTransaction',
      params: [parsedTx]
    })

    try {
      const result = await this._sendCallRequest(request)
      return result
    } catch (error) {
      throw error
    }
  }

  public async signTransaction (tx: ITxData) {
    if (!this._connected) {
      throw new Error('Session currently disconnected')
    }

    const parsedTx = parseTransactionData(tx)

    const request = this._formatRequest({
      method: 'eth_signTransaction',
      params: [parsedTx]
    })

    try {
      const result = await this._sendCallRequest(request)
      return result
    } catch (error) {
      throw error
    }
  }

  public async signMessage (params: any[]) {
    if (!this._connected) {
      throw new Error('Session currently disconnected')
    }

    const request = this._formatRequest({
      method: 'eth_sign',
      params
    })

    try {
      const result = await this._sendCallRequest(request)
      return result
    } catch (error) {
      throw error
    }
  }

  public async signPersonalMessage (params: any[]) {
    if (!this._connected) {
      throw new Error('Session currently disconnected')
    }

    if (!isHexStrict(params[1])) {
      params[1] = convertUtf8ToHex(params[1])
    }

    const request = this._formatRequest({
      method: 'personal_sign',
      params
    })

    try {
      const result = await this._sendCallRequest(request)
      return result
    } catch (error) {
      throw error
    }
  }

  public async signTypedData (params: any[]) {
    if (!this._connected) {
      throw new Error('Session currently disconnected')
    }

    const request = this._formatRequest({
      method: 'eth_signTypedData',
      params
    })

    try {
      const result = await this._sendCallRequest(request)
      return result
    } catch (error) {
      throw error
    }
  }

  public async sendCustomRequest (request: Partial<IJsonRpcRequest>) {
    if (!this._connected) {
      throw new Error('Session currently disconnected')
    }

    const formattedRequest = this._formatRequest(request)

    try {
      const result = await this._sendCallRequest(formattedRequest)
      return result
    } catch (error) {
      throw error
    }
  }

  public approveRequest (response: Partial<IJsonRpcResponseSuccess>) {
    if (isRpcResponseSuccess(response)) {
      const formattedResponse = this._formatResponse(response)
      this._sendResponse(formattedResponse)
    } else {
      throw new Error('JSON-RPC success response must include "result" field')
    }
  }

  public rejectRequest (response: Partial<IJsonRpcResponseError>) {
    if (isRpcResponseError(response)) {
      const formattedResponse = this._formatResponse(response)
      this._sendResponse(formattedResponse)
    } else {
      throw new Error('JSON-RPC error response must include "error" field')
    }
  }

  // -- private --------------------------------------------------------- //

  private async _sendRequest (
    request: Partial<IJsonRpcRequest>,
    _topic?: string
  ) {
    const callRequest: IJsonRpcRequest = this._formatRequest(request)

    const encryptionPayload: IEncryptionPayload | null = await this._encrypt(
      callRequest
    )

    const topic: string = _topic || this.peerId
    const payload: string = JSON.stringify(encryptionPayload)

    const socketMessage: ISocketMessage = {
      topic,
      type: 'pub',
      payload
    }

    if (this._socket && this._socket.readyState === 1) {
      this._socketSend(socketMessage)
    } else {
      this._setToQueue(socketMessage)
    }
  }

  private async _sendResponse (
    response: IJsonRpcResponseSuccess | IJsonRpcResponseError
  ) {
    const encryptionPayload: IEncryptionPayload | null = await this._encrypt(
      response
    )

    const topic: string = this.peerId
    const payload: string = JSON.stringify(encryptionPayload)

    const socketMessage: ISocketMessage = {
      topic,
      type: 'pub',
      payload
    }

    if (this._socket && this._socket.readyState === 1) {
      this._socketSend(socketMessage)
    } else {
      this._setToQueue(socketMessage)
    }
  }

  private async _sendSessionRequest (
    request: IJsonRpcRequest,
    errorMsg: string,
    _topic?: string
  ) {
    this._sendRequest(request, _topic)
    this._subscribeToSessionResponse(request.id, errorMsg)
  }

  private _sendCallRequest (request: IJsonRpcRequest): Promise<any> {
    this._sendRequest(request)
    return this._subscribeToCallResponse(request.id)
  }

  private _formatRequest (request: Partial<IJsonRpcRequest>): IJsonRpcRequest {
    if (typeof request.method === 'undefined') {
      throw new Error('JSON RPC request must have valid "method" value')
    }
    const formattedRequest: IJsonRpcRequest = {
      id: typeof request.id === 'undefined' ? payloadId() : request.id,
      jsonrpc: '2.0',
      method: request.method,
      params: typeof request.params === 'undefined' ? [] : request.params
    }
    return formattedRequest
  }

  private _formatResponse (
    response: Partial<IJsonRpcResponseSuccess | IJsonRpcResponseError>
  ): IJsonRpcResponseSuccess | IJsonRpcResponseError {
    if (typeof response.id === 'undefined') {
      throw new Error('JSON RPC request must have valid "id" value')
    }

    if (isRpcResponseError(response)) {
      const error = formatRpcError(response.error)

      const formattedResponseError: IJsonRpcResponseError = {
        jsonrpc: '2.0',
        ...response,
        error
      }
      return formattedResponseError
    } else if (isRpcResponseSuccess(response)) {
      const formattedResponseSuccess: IJsonRpcResponseSuccess = {
        jsonrpc: '2.0',
        ...response
      }

      return formattedResponseSuccess
    }

    throw new Error('JSON RPC response format is invalid')
  }

  private _handleSessionDisconnect (errorMsg?: string) {
    const message = errorMsg || 'Session Disconnected'
    if (this._connected) {
      this._connected = false
      this._triggerEvents({
        event: 'disconnect',
        params: [{ message }]
      })
    }
    this._removeStorageSession()
    this._toggleSocketPing()
  }

  private _handleSessionResponse (
    errorMsg: string,
    sessionParams?: ISessionParams
  ) {
    if (sessionParams) {
      if (sessionParams.approved) {
        if (!this._connected) {
          this._connected = true

          if (sessionParams.chainId) {
            this.chainId = sessionParams.chainId
          }

          if (sessionParams.accounts) {
            this.accounts = sessionParams.accounts
          }

          if (sessionParams.peerId && !this.peerId) {
            this.peerId = sessionParams.peerId
          }

          if (sessionParams.peerMeta && !this.peerMeta) {
            this.peerMeta = sessionParams.peerMeta
          }

          this._triggerEvents({
            event: 'connect',
            params: [
              {
                peerId: this.peerId,
                peerMeta: this.peerMeta,
                chainId: this.chainId,
                accounts: this.accounts
              }
            ]
          })
        } else {
          if (sessionParams.chainId) {
            this.chainId = sessionParams.chainId
          }
          if (sessionParams.accounts) {
            this.accounts = sessionParams.accounts
          }

          this._triggerEvents({
            event: 'session_update',
            params: [
              {
                chainId: this.chainId,
                accounts: this.accounts
              }
            ]
          })
        }
        if (this._connected) {
          this._setStorageSession()
        } else {
          this._removeStorageSession()
        }
      } else {
        this._handleSessionDisconnect(errorMsg)
      }
    } else {
      this._handleSessionDisconnect(errorMsg)
    }
  }

  private _subscribeToSessionRequest () {
    this._setToQueue({
      topic: `${this.handshakeTopic}`,
      type: 'sub',
      payload: ''
    })
  }

  private _subscribeToSessionResponse (id: number, errorMsg: string) {
    this.on(`response:${id}`, (error, payload) => {
      if (error) {
        this._handleSessionResponse(error.message)
        return
      }
      if (payload.result) {
        this._handleSessionResponse(errorMsg, payload.result)
      } else if (payload.error && payload.error.message) {
        this._handleSessionResponse(payload.error.message)
      } else {
        this._handleSessionResponse(errorMsg)
      }
    })
  }

  private _subscribeToCallResponse (id: number): Promise<any> {
    return new Promise((resolve, reject) => {
      this.on(`response:${id}`, (error, payload) => {
        if (error) {
          reject(error)
          return
        }
        if (payload.result) {
          resolve(payload.result)
        } else if (payload.error && payload.error.message) {
          reject(new Error(payload.error.message))
        } else {
          reject(new Error('Invalid JSON RPC response format received'))
        }
      })
    })
  }

  private _subscribeToInternalEvents () {
    this.on('wc_sessionRequest', (error, payload) => {
      if (error) {
        this._triggerEvents({
          event: 'error',
          params: [
            {
              code: 'SESSION_REQUEST_ERROR',
              message: error.toString()
            }
          ]
        })
      }
      this.handshakeId = payload.id
      this.peerId = payload.params[0].peerId
      this.peerMeta = payload.params[0].peerMeta

      const internalPayload = {
        ...payload,
        method: 'session_request'
      }
      this._triggerEvents(internalPayload)
    })

    this.on('wc_sessionUpdate', (error, payload) => {
      if (error) {
        this._handleSessionResponse(error.message)
      }
      this._handleSessionResponse('Session disconnected', payload.params[0])
    })
  }

  private _triggerEvents (
    payload:
    | IJsonRpcRequest
    | IJsonRpcResponseSuccess
    | IJsonRpcResponseError
    | IInternalEvent
  ): void {
    let eventEmitters: IEventEmitter[] = []
    let event: string

    if (isRpcRequest(payload)) {
      event = payload.method
    } else if (isRpcResponseSuccess(payload) || isRpcResponseError(payload)) {
      event = `response:${payload.id}`
    } else if (isInternalEvent(payload)) {
      event = payload.event
    } else {
      event = ''
    }

    if (event) {
      eventEmitters = this._eventEmitters.filter(
        (eventEmitter: IEventEmitter) => eventEmitter.event === event
      )
    }

    const reservedEvents = [
      'wc_sessionRequest',
      'wc_sessionUpdate',
      'wc_exchangeKey',
      'session_request',
      'session_update',
      'exchange_key',
      'connect',
      'disconnect'
    ]

    if (
      (!eventEmitters || !eventEmitters.length) &&
      !reservedEvents.includes(event)
    ) {
      eventEmitters = this._eventEmitters.filter(
        (eventEmitter: IEventEmitter) => eventEmitter.event === 'call_request'
      )
    }

    eventEmitters.forEach((eventEmitter: IEventEmitter) => {
      if (isRpcResponseError(payload)) {
        const error = new Error(payload.error.message)
        eventEmitter.callback(error, null)
      } else {
        eventEmitter.callback(null, payload)
      }
    })
  }

  // -- keyManager ------------------------------------------------------- //

  // TODO: Refactor with new exchange key flow

  // -- websocket ------------------------------------------------------- //

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
          if (this._socket && this._socket.readyState === 1) {
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
      if (this._connected) {
        this._setToQueue(socketMessage)
        this._socketOpen()
      }
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

    const activeTopics = [this.clientId, this.handshakeTopic]
    if (!activeTopics.includes(socketMessage.topic)) {
      return
    }

    let encryptionPayload: IEncryptionPayload
    try {
      encryptionPayload = JSON.parse(socketMessage.payload)
    } catch (error) {
      throw error
    }

    const payload:
    | IJsonRpcRequest
    | IJsonRpcResponseSuccess
    | IJsonRpcResponseError
    | null = await this._decrypt(encryptionPayload)

    if (payload) {
      this._triggerEvents(payload)
    }
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

  // -- uri ------------------------------------------------------------- //

  private _formatUri () {
    const protocol = this.protocol
    const handshakeTopic = this.handshakeTopic
    const version = this.version
    const bridge = encodeURIComponent(this.bridge)
    const key = this.key
    const uri = `${protocol}:${handshakeTopic}@${version}?bridge=${bridge}&key=${key}`
    return uri
  }

  private _parseUri (uri: string) {
    const result: IParseURIResult = parseWalletConnectUri(uri)

    if (result.protocol === this.protocol) {
      if (!result.handshakeTopic) {
        throw Error('Invalid or missing handshakeTopic parameter value')
      }
      const handshakeTopic = result.handshakeTopic

      if (!result.bridge) {
        throw Error('Invalid or missing bridge url parameter value')
      }
      const bridge = decodeURIComponent(result.bridge)

      if (!result.key) {
        throw Error('Invalid or missing kkey parameter value')
      }
      const key = result.key

      return { handshakeTopic, bridge, key }
    } else {
      throw new Error("URI format doesn't follow Connector protocol")
    }
  }

  // -- crypto ---------------------------------------------------------- //

  private async _generateKey (): Promise<ArrayBuffer | null> {
    if (this.cryptoLib) {
      const result = await this.cryptoLib.generateKey()
      return result
    }
    return null
  }

  private async _encrypt (
    data: IJsonRpcRequest | IJsonRpcResponseSuccess | IJsonRpcResponseError
  ): Promise<IEncryptionPayload | null> {
    const key: ArrayBuffer | null = this._key
    if (this.cryptoLib && key) {
      const result: IEncryptionPayload = await this.cryptoLib.encrypt(data, key)
      return result
    }
    return null
  }

  private async _decrypt (
    payload: IEncryptionPayload
  ): Promise<
    IJsonRpcRequest | IJsonRpcResponseSuccess | IJsonRpcResponseError | null
  > {
    const key: ArrayBuffer | null = this._key
    if (this.cryptoLib && key) {
      const result:
      | IJsonRpcRequest
      | IJsonRpcResponseSuccess
      | IJsonRpcResponseError
      | null = await this.cryptoLib.decrypt(payload, key)
      return result
    }
    return null
  }

  // -- storage --------------------------------------------------------- //

  private _getStorageSession (): IWalletConnectSession | null {
    let session = null
    let local = null
    if (storage) {
      local = storage.getItem(storageId)
    }
    if (local && typeof local === 'string') {
      try {
        const json = JSON.parse(local)
        if (isWalletConnectSession(json)) {
          session = json
        }
      } catch (error) {
        throw error
      }
    }
    return session
  }

  private _setStorageSession (): IWalletConnectSession {
    const session: IWalletConnectSession = this.session
    const local: string = JSON.stringify(session)
    if (storage) {
      storage.setItem(storageId, local)
    }
    return session
  }

  private _removeStorageSession (): void {
    if (storage) {
      storage.removeItem(storageId)
    }
  }
}

export default Connector
