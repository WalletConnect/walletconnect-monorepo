import {
  IConnector,
  ICryptoLib,
  ITransportLib,
  ITransportOpts,
  ISessionStorage,
  IEncryptionPayload,
  ISocketMessage,
  ISessionStatus,
  ISessionError,
  IJsonRpcResponseSuccess,
  IJsonRpcResponseError,
  IJsonRpcRequest,
  ITxData,
  IClientMeta,
  IParseURIResult,
  ISessionParams,
  IWalletConnectOptions,
  IUpdateChainParams,
  NetworkMonitor,
  IRequestOptions,
  IInternalRequestOptions,
  ICreateSessionOptions,
  IQRCodeModal,
  IPushSubscription,
  IPushServerOptions
} from '@walletconnect/types'
import {
  parsePersonalSign,
  parseTransactionData,
  convertArrayBufferToHex,
  convertHexToArrayBuffer,
  getMeta,
  payloadId,
  uuid,
  formatRpcError,
  parseWalletConnectUri,
  convertNumberToHex,
  isJsonRpcResponseSuccess,
  isJsonRpcResponseError,
  isSilentPayload,
  isEmptyArray
} from '@walletconnect/utils'
import {
  ERROR_SESSION_CONNECTED,
  ERROR_SESSION_DISCONNECTED,
  ERROR_SESSION_REJECTED,
  ERROR_MISSING_JSON_RPC,
  ERROR_MISSING_RESULT,
  ERROR_MISSING_ERROR,
  ERROR_MISSING_METHOD,
  ERROR_MISSING_ID,
  ERROR_INVALID_RESPONSE,
  ERROR_INVALID_URI,
  ERROR_MISSING_REQUIRED,
  ERROR_MISSING_TRANSPORT_PARAM
} from './errors'
import EventManager from './events'

interface IConnectorOpts {
  cryptoLib: ICryptoLib
  connectorOpts: IWalletConnectOptions
  transportOpts: ITransportOpts
  sessionStorage?: ISessionStorage | null
  clientMeta?: IClientMeta | null
  qrcodeModal?: IQRCodeModal | null
  pushServerOpts?: IPushServerOptions
  getNetMonitor?: () => NetworkMonitor
}

// -- Connector ------------------------------------------------------------ //

class Connector implements IConnector {
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
  private _networkId: number
  private _rpcUrl: string
  private _transport: ITransportLib
  private _eventManager: EventManager
  private _connected: boolean
  private _sessionStorage: ISessionStorage | null
  private _qrcodeModal: IQRCodeModal | null

  // -- constructor ----------------------------------------------------- //

  constructor(opts: IConnectorOpts) {
    this.cryptoLib = opts.cryptoLib

    this.protocol = 'wc'
    this.version = 1

    this._bridge = ''
    this._key = null
    this._nextKey = null

    this._clientId = ''
    this._clientMeta = getMeta() || opts.clientMeta || null
    this._peerId = ''
    this._peerMeta = null
    this._handshakeId = 0
    this._handshakeTopic = ''
    this._accounts = []
    this._chainId = 0
    this._networkId = 0
    this._rpcUrl = ''
    this._eventManager = new EventManager()
    this._connected = false
    this._sessionStorage = opts.sessionStorage || null
    this._qrcodeModal = opts.qrcodeModal || null

    if (
      !opts.connectorOpts.bridge &&
      !opts.connectorOpts.uri &&
      !opts.connectorOpts.session
    ) {
      throw new Error(ERROR_MISSING_REQUIRED)
    }

    if (opts.connectorOpts.bridge) {
      this.bridge = opts.connectorOpts.bridge
    }

    if (opts.connectorOpts.uri) {
      this.uri = opts.connectorOpts.uri
    }

    let session = opts.connectorOpts.session || null

    if (!session) {
      session = this._getStorageSession()
    }
    if (session) {
      this.session = session
    }

    if (this.handshakeId) {
      this._subscribeToSessionResponse(
        this.handshakeId,
        'Session request rejected'
      )
    }

    let transportParams = {}

    if (!isEmptyArray(opts.transportOpts.params)) {
      opts.transportOpts.params.forEach((param: string) => {
        if (opts[param]) {
          transportParams[param] = opts[param]
        } else {
          throw new Error(`${ERROR_MISSING_TRANSPORT_PARAM} ${param}`)
        }
      })
    }
    this._transport = opts.transportOpts.initTransport({
      ...transportParams,
      getNetMonitor: opts.getNetMonitor
    })

    if (opts.connectorOpts.uri) {
      this._subscribeToSessionRequest()
    }

    this._subscribeToInternalEvents()
    this._transport.open()
    if (opts.pushServerOpts) {
      this._registerPushServer(opts.pushServerOpts)
    }
  }

  // -- setters / getters ----------------------------------------------- //

  set bridge(value: string) {
    if (!value) {
      return
    }
    this._bridge = value
  }

  get bridge() {
    return this._bridge
  }

  set key(value: string) {
    if (!value) {
      return
    }
    const key: ArrayBuffer = convertHexToArrayBuffer(value)
    this._key = key
  }

  get key(): string {
    if (this._key) {
      const key: string = convertArrayBufferToHex(this._key, true)
      return key
    }
    return ''
  }

  set nextKey(value: string) {
    if (!value) {
      return
    }
    const nextKey: ArrayBuffer = convertHexToArrayBuffer(value)
    this._nextKey = nextKey
  }

  get nextKey(): string {
    if (this._nextKey) {
      const nextKey: string = convertArrayBufferToHex(this._nextKey)
      return nextKey
    }
    return ''
  }

  set clientId(value: string) {
    if (!value) {
      return
    }
    this._clientId = value
  }

  get clientId() {
    let clientId: string | null = this._clientId
    if (!clientId) {
      clientId = this._clientId = uuid()
    }

    return this._clientId
  }

  set peerId(value) {
    if (!value) {
      return
    }
    this._peerId = value
  }

  get peerId() {
    return this._peerId
  }

  set clientMeta(value) {
    // empty
  }

  get clientMeta() {
    let clientMeta: IClientMeta | null = this._clientMeta
    if (!clientMeta) {
      clientMeta = this._clientMeta = getMeta()
    }
    return clientMeta
  }

  set peerMeta(value) {
    this._peerMeta = value
  }

  get peerMeta() {
    const peerMeta: IClientMeta | null = this._peerMeta
    return peerMeta
  }

  set handshakeTopic(value) {
    if (!value) {
      return
    }
    this._handshakeTopic = value
  }

  get handshakeTopic() {
    return this._handshakeTopic
  }

  set handshakeId(value) {
    if (!value) {
      return
    }
    this._handshakeId = value
  }

  get handshakeId() {
    return this._handshakeId
  }

  get uri() {
    const _uri = this._formatUri()
    return _uri
  }

  set uri(value) {
    if (!value) {
      return
    }
    const { handshakeTopic, bridge, key } = this._parseUri(value)
    this.handshakeTopic = handshakeTopic
    this.bridge = bridge
    this.key = key
  }

  set chainId(value) {
    this._chainId = value
  }

  get chainId() {
    const chainId: number | null = this._chainId
    return chainId
  }

  set networkId(value) {
    this._networkId = value
  }

  get networkId() {
    const networkId: number | null = this._networkId
    return networkId
  }

  set accounts(value) {
    this._accounts = value
  }

  get accounts() {
    const accounts: string[] | null = this._accounts
    return accounts
  }

  set rpcUrl(value) {
    this._rpcUrl = value
  }

  get rpcUrl() {
    const rpcUrl: string | null = this._rpcUrl
    return rpcUrl
  }

  set connected(value) {
    // empty
  }

  get connected() {
    return this._connected
  }

  set pending(value) {
    // empty
  }

  get pending() {
    return !!this._handshakeTopic
  }

  get session() {
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

  set session(value) {
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

  public on(
    event: string,
    callback: (error: Error | null, payload: any | null) => void
  ): void {
    const eventEmitter = {
      event,
      callback
    }
    this._eventManager.subscribe(eventEmitter)
  }

  public async createInstantRequest(
    instantRequest: Partial<IJsonRpcRequest>
  ): Promise<void> {
    this._key = await this._generateKey()

    const request: IJsonRpcRequest = this._formatRequest({
      method: 'wc_instantRequest',
      params: [
        {
          peerId: this.clientId,
          peerMeta: this.clientMeta,
          request: this._formatRequest(instantRequest)
        }
      ]
    })

    this.handshakeId = request.id
    this.handshakeTopic = uuid()

    if (this._qrcodeModal) {
      this._qrcodeModal.open(this.uri, () => {
        throw new Error('QR Code Modal closed')
      })
    }

    this._eventManager.trigger({
      event: 'display_uri',
      params: [{ uri: this.uri }]
    })

    const endInstantRequest = () => {
      this.killSession()
      if (this._qrcodeModal) {
        this._qrcodeModal.close()
      }
    }

    try {
      const result = await this._sendCallRequest(request)

      if (result) {
        endInstantRequest()
      }

      return result
    } catch (error) {
      endInstantRequest()
      throw error
    }
  }

  public connect(opts?: ICreateSessionOptions): Promise<ISessionStatus> {
    if (!this._qrcodeModal) {
      throw new Error('QR Code Modal not provided')
    }
    return new Promise(async (resolve, reject) => {
      if (!this.connected) {
        try {
          await this.createSession(opts)
          if (this._qrcodeModal) {
            this._qrcodeModal.open(this.uri, () => {
              reject(new Error('QR Code Modal closed'))
            })
          }
        } catch (error) {
          reject(error)
        }
      }

      this.on('connect', (error, payload) => {
        if (error) {
          return reject(error)
        }
        if (this._qrcodeModal) {
          this._qrcodeModal.close()
        }

        resolve(payload.params[0])
      })
    })
  }

  public async createSession(opts?: ICreateSessionOptions): Promise<void> {
    if (this._connected) {
      throw new Error(ERROR_SESSION_CONNECTED)
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

    this._sendSessionRequest(request, 'Session update rejected', {
      topic: this.handshakeTopic
    })

    this._eventManager.trigger({
      event: 'display_uri',
      params: [this.uri]
    })
  }

  public approveSession(sessionStatus: ISessionStatus) {
    if (this._connected) {
      throw new Error(ERROR_SESSION_CONNECTED)
    }

    this.chainId = sessionStatus.chainId
    this.accounts = sessionStatus.accounts
    this.networkId = sessionStatus.networkId || 0
    this.rpcUrl = sessionStatus.rpcUrl || ''

    const sessionParams: ISessionParams = {
      approved: true,
      chainId: this.chainId,
      networkId: this.networkId,
      accounts: this.accounts,
      rpcUrl: this.rpcUrl,
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
    this._eventManager.trigger({
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

  public rejectSession(sessionError?: ISessionError) {
    if (this._connected) {
      throw new Error(ERROR_SESSION_CONNECTED)
    }

    const message =
      sessionError && sessionError.message
        ? sessionError.message
        : ERROR_SESSION_REJECTED

    const response = this._formatResponse({
      id: this.handshakeId,
      error: { message }
    })

    this._sendResponse(response)

    this._connected = false
    this._eventManager.trigger({
      event: 'disconnect',
      params: [{ message }]
    })
    this._removeStorageSession()
  }

  public updateSession(sessionStatus: ISessionStatus) {
    if (!this._connected) {
      throw new Error(ERROR_SESSION_DISCONNECTED)
    }

    this.chainId = sessionStatus.chainId
    this.accounts = sessionStatus.accounts
    this.networkId = sessionStatus.networkId || 0
    this.rpcUrl = sessionStatus.rpcUrl || ''

    const sessionParams: ISessionParams = {
      approved: true,
      chainId: this.chainId,
      networkId: this.networkId,
      accounts: this.accounts,
      rpcUrl: this.rpcUrl
    }

    const request = this._formatRequest({
      method: 'wc_sessionUpdate',
      params: [sessionParams]
    })

    this._sendSessionRequest(request, 'Session update rejected')

    this._eventManager.trigger({
      event: 'session_update',
      params: [
        {
          chainId: this.chainId,
          accounts: this.accounts
        }
      ]
    })

    this._manageStorageSession()
  }

  public async killSession(sessionError?: ISessionError) {
    const message = sessionError ? sessionError.message : 'Session Disconnected'

    const sessionParams: ISessionParams = {
      approved: false,
      chainId: null,
      networkId: null,
      accounts: null
    }

    const request = this._formatRequest({
      method: 'wc_sessionUpdate',
      params: [sessionParams]
    })

    await this._sendRequest(request)

    this._handleSessionDisconnect(message)
  }

  public async sendTransaction(tx: ITxData) {
    if (!this._connected) {
      throw new Error(ERROR_SESSION_DISCONNECTED)
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

  public async signTransaction(tx: ITxData) {
    if (!this._connected) {
      throw new Error(ERROR_SESSION_DISCONNECTED)
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

  public async signMessage(params: any[]) {
    if (!this._connected) {
      throw new Error(ERROR_SESSION_DISCONNECTED)
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

  public async signPersonalMessage(params: any[]) {
    if (!this._connected) {
      throw new Error(ERROR_SESSION_DISCONNECTED)
    }

    params = parsePersonalSign(params)

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

  public async signTypedData(params: any[]) {
    if (!this._connected) {
      throw new Error(ERROR_SESSION_DISCONNECTED)
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

  public async updateChain(chainParams: IUpdateChainParams) {
    if (!this._connected) {
      throw new Error('Session currently disconnected')
    }

    const request = this._formatRequest({
      method: 'wallet_updateChain',
      params: [chainParams]
    })

    try {
      const result = await this._sendCallRequest(request)
      return result
    } catch (error) {
      throw error
    }
  }

  public unsafeSend(
    request: IJsonRpcRequest,
    options?: IRequestOptions
  ): Promise<IJsonRpcResponseSuccess | IJsonRpcResponseError> {
    this._sendRequest(request, options)

    return new Promise((resolve, reject) => {
      this._subscribeToResponse(
        request.id,
        (error: Error | null, payload: any | null) => {
          if (error) {
            reject(error)
            return
          }
          if (!payload) {
            throw new Error(ERROR_MISSING_JSON_RPC)
          }
          resolve(payload)
        }
      )
    })
  }

  public async sendCustomRequest(
    request: Partial<IJsonRpcRequest>,
    options?: IRequestOptions
  ) {
    if (!this._connected) {
      throw new Error(ERROR_SESSION_DISCONNECTED)
    }

    switch (request.method) {
      case 'eth_accounts':
        return this.accounts
      case 'eth_chainId':
        return convertNumberToHex(this.chainId)
      case 'eth_sendTransaction':
      case 'eth_signTransaction':
        if (request.params) {
          request.params[0] = parseTransactionData(request.params[0])
        }
        break
      case 'personal_sign':
        if (request.params) {
          request.params = parsePersonalSign(request.params)
        }
        break
      default:
        break
    }

    const formattedRequest = this._formatRequest(request)

    try {
      const result = await this._sendCallRequest(formattedRequest, options)
      return result
    } catch (error) {
      throw error
    }
  }

  public approveRequest(response: Partial<IJsonRpcResponseSuccess>) {
    if (isJsonRpcResponseSuccess(response)) {
      const formattedResponse = this._formatResponse(response)
      this._sendResponse(formattedResponse)
    } else {
      throw new Error(ERROR_MISSING_RESULT)
    }
  }

  public rejectRequest(response: Partial<IJsonRpcResponseError>) {
    if (isJsonRpcResponseError(response)) {
      const formattedResponse = this._formatResponse(response)
      this._sendResponse(formattedResponse)
    } else {
      throw new Error(ERROR_MISSING_ERROR)
    }
  }

  // -- private --------------------------------------------------------- //

  protected async _sendRequest(
    request: Partial<IJsonRpcRequest>,
    options?: Partial<IInternalRequestOptions>
  ) {
    const callRequest: IJsonRpcRequest = this._formatRequest(request)

    const encryptionPayload: IEncryptionPayload | null = await this._encrypt(
      callRequest
    )

    const topic: string =
      typeof options?.topic !== 'undefined' ? options.topic : this.peerId
    const payload: string = JSON.stringify(encryptionPayload)
    const silent =
      typeof options?.forcePushNotification !== 'undefined'
        ? !options.forcePushNotification
        : isSilentPayload(callRequest)

    this._transport.send(payload, topic, silent)
  }

  protected async _sendResponse(
    response: IJsonRpcResponseSuccess | IJsonRpcResponseError
  ) {
    const encryptionPayload: IEncryptionPayload | null = await this._encrypt(
      response
    )

    const topic: string = this.peerId
    const payload: string = JSON.stringify(encryptionPayload)
    const silent = true

    this._transport.send(payload, topic, silent)
  }

  protected async _sendSessionRequest(
    request: IJsonRpcRequest,
    errorMsg: string,
    options?: IInternalRequestOptions
  ) {
    this._sendRequest(request, options)
    this._subscribeToSessionResponse(request.id, errorMsg)
  }

  protected _sendCallRequest(
    request: IJsonRpcRequest,
    options?: IRequestOptions
  ): Promise<any> {
    this._sendRequest(request, options)
    return this._subscribeToCallResponse(request.id)
  }

  protected _formatRequest(request: Partial<IJsonRpcRequest>): IJsonRpcRequest {
    if (typeof request.method === 'undefined') {
      throw new Error(ERROR_MISSING_METHOD)
    }
    const formattedRequest: IJsonRpcRequest = {
      id: typeof request.id === 'undefined' ? payloadId() : request.id,
      jsonrpc: '2.0',
      method: request.method,
      params: typeof request.params === 'undefined' ? [] : request.params
    }
    return formattedRequest
  }

  protected _formatResponse(
    response: Partial<IJsonRpcResponseSuccess | IJsonRpcResponseError>
  ): IJsonRpcResponseSuccess | IJsonRpcResponseError {
    if (typeof response.id === 'undefined') {
      throw new Error(ERROR_MISSING_ID)
    }

    if (isJsonRpcResponseError(response)) {
      const error = formatRpcError(response.error)

      const errorResponse: IJsonRpcResponseError = {
        id: response.id,
        jsonrpc: '2.0',
        ...response,
        error
      }
      return errorResponse
    } else if (isJsonRpcResponseSuccess(response)) {
      const successResponse: IJsonRpcResponseSuccess = {
        id: response.id,
        jsonrpc: '2.0',
        ...response
      }

      return successResponse
    }

    throw new Error(ERROR_INVALID_RESPONSE)
  }

  private _handleSessionDisconnect(errorMsg?: string) {
    const message = errorMsg || 'Session Disconnected'
    if (this._connected) {
      this._connected = false
    }
    this._eventManager.trigger({
      event: 'disconnect',
      params: [{ message }]
    })
    this._removeStorageSession()
    this._transport.close()
  }

  private _handleSessionResponse(
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

          this._eventManager.trigger({
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

          this._eventManager.trigger({
            event: 'session_update',
            params: [
              {
                chainId: this.chainId,
                accounts: this.accounts
              }
            ]
          })
        }

        this._manageStorageSession()
      } else {
        this._handleSessionDisconnect(errorMsg)
      }
    } else {
      this._handleSessionDisconnect(errorMsg)
    }
  }

  private async _handleIncomingMessages(socketMessage: ISocketMessage) {
    const activeTopics = [this.clientId, this.handshakeTopic]

    if (!activeTopics.includes(socketMessage.topic)) {
      return
    }

    let encryptionPayload: IEncryptionPayload
    try {
      encryptionPayload = JSON.parse(socketMessage.payload)
    } catch (error) {
      return
    }

    const payload:
      | IJsonRpcRequest
      | IJsonRpcResponseSuccess
      | IJsonRpcResponseError
      | null = await this._decrypt(encryptionPayload)

    if (payload) {
      this._eventManager.trigger(payload)
    }
  }

  private _subscribeToSessionRequest() {
    if (this._transport.listen) {
      this._transport.listen(this.handshakeTopic)
    }
  }

  private _subscribeToResponse(
    id: number,
    callback: (error: Error | null, payload: any | null) => void
  ) {
    this.on(`response:${id}`, callback)
  }

  private _subscribeToSessionResponse(id: number, errorMsg: string) {
    this._subscribeToResponse(id, (error, payload) => {
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

  private _subscribeToCallResponse(id: number): Promise<any> {
    return new Promise((resolve, reject) => {
      this._subscribeToResponse(id, (error, payload) => {
        if (error) {
          reject(error)
          return
        }
        if (payload.result) {
          resolve(payload.result)
        } else if (payload.error && payload.error.message) {
          reject(new Error(payload.error.message))
        } else {
          reject(new Error(ERROR_INVALID_RESPONSE))
        }
      })
    })
  }

  private _subscribeToInternalEvents() {
    this._transport.on('message', (socketMessage: ISocketMessage) =>
      this._handleIncomingMessages(socketMessage)
    )

    this._transport.on('open', () =>
      this._eventManager.trigger({ event: 'transport_open', params: [] })
    )

    this._transport.on('close', () =>
      this._eventManager.trigger({ event: 'transport_close', params: [] })
    )

    this.on('wc_sessionRequest', (error, payload) => {
      if (error) {
        this._eventManager.trigger({
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
      this._eventManager.trigger(internalPayload)
    })

    this.on('wc_sessionUpdate', (error, payload) => {
      if (error) {
        this._handleSessionResponse(error.message)
      }
      this._handleSessionResponse('Session disconnected', payload.params[0])
    })
  }

  // -- uri ------------------------------------------------------------- //

  private _formatUri() {
    const protocol = this.protocol
    const handshakeTopic = this.handshakeTopic
    const version = this.version
    const bridge = encodeURIComponent(this.bridge)
    const key = this.key
    const uri = `${protocol}:${handshakeTopic}@${version}?bridge=${bridge}&key=${key}`
    return uri
  }

  private _parseUri(uri: string) {
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
      throw new Error(ERROR_INVALID_URI)
    }
  }

  // -- crypto ---------------------------------------------------------- //

  private async _generateKey(): Promise<ArrayBuffer | null> {
    if (this.cryptoLib) {
      const result = await this.cryptoLib.generateKey()
      return result
    }
    return null
  }

  private async _encrypt(
    data: IJsonRpcRequest | IJsonRpcResponseSuccess | IJsonRpcResponseError
  ): Promise<IEncryptionPayload | null> {
    const key: ArrayBuffer | null = this._key
    if (this.cryptoLib && key) {
      const result: IEncryptionPayload = await this.cryptoLib.encrypt(data, key)
      return result
    }
    return null
  }

  private async _decrypt(
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

  // -- sessionStorage --------------------------------------------------------- //

  private _getStorageSession() {
    let result = null
    if (this._sessionStorage) {
      result = this._sessionStorage.getSession()
    }
    return result
  }

  private _setStorageSession() {
    if (this._sessionStorage) {
      this._sessionStorage.setSession(this.session)
    }
  }

  private _removeStorageSession() {
    if (this._sessionStorage) {
      this._sessionStorage.removeSession()
    }
  }

  private _manageStorageSession() {
    if (this._connected) {
      this._setStorageSession()
    } else {
      this._removeStorageSession()
    }
  }

  // -- pushServer ------------------------------------------------------------- //

  private _registerPushServer(pushServerOpts: IPushServerOptions) {
    if (!pushServerOpts.url || typeof pushServerOpts.url !== 'string') {
      throw Error('Invalid or missing pushServerOpts.url parameter value')
    }

    if (!pushServerOpts.type || typeof pushServerOpts.type !== 'string') {
      throw Error('Invalid or missing pushServerOpts.type parameter value')
    }

    if (!pushServerOpts.token || typeof pushServerOpts.token !== 'string') {
      throw Error('Invalid or missing pushServerOpts.token parameter value')
    }

    const pushSubscription: IPushSubscription = {
      bridge: this.bridge,
      topic: this.clientId,
      type: pushServerOpts.type,
      token: pushServerOpts.token,
      peerName: '',
      language: pushServerOpts.language || ''
    }

    this.on('connect', async (error: Error | null, payload: any) => {
      if (error) {
        throw error
      }

      if (pushServerOpts.peerMeta) {
        const peerName = payload.params[0].peerMeta.name
        pushSubscription.peerName = peerName
      }

      try {
        const response = await fetch(`${pushServerOpts.url}/new`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(pushSubscription)
        })

        const json = await response.json()
        if (!json.success) {
          throw Error('Failed to register in Push Server')
        }
      } catch (error) {
        throw Error('Failed to register in Push Server')
      }
    })
  }
}
export default Connector
