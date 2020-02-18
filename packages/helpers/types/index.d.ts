declare module '@walletconnect/types' {
  export interface IConnector {
    bridge: string
    key: string
    nextKey: string
    clientId: string
    peerId: string
    readonly clientMeta: IClientMeta | null
    peerMeta: IClientMeta | null
    handshakeTopic: string
    handshakeId: number
    uri: string
    chainId: number
    networkId: number
    accounts: string[]
    rpcUrl: string
    readonly connected: boolean
    readonly pending: boolean
    session: IWalletConnectSession

    on(
      event: string,
      callback: (error: Error | null, payload: any | null) => void
    ): void

    createSession(opts?: ICreateSessionOptions): Promise<void>
    approveSession(sessionStatus: ISessionStatus): void
    rejectSession(sessionError?: ISessionError): void
    updateSession(sessionStatus: ISessionStatus): void
    killSession(sessionError?: ISessionError): Promise<void>

    sendTransaction(tx: ITxData): Promise<any>
    signTransaction(tx: ITxData): Promise<any>
    signMessage(params: any[]): Promise<any>
    signPersonalMessage(params: any[]): Promise<any>
    signTypedData(params: any[]): Promise<any>
    updateChain(chainParams: IUpdateChainParams): Promise<any>

    sendCustomRequest(
      request: Partial<IJsonRpcRequest>,
      options?: IRequestOptions
    ): Promise<any>
    unsafeSend(
      request: IJsonRpcRequest,
      options?: IRequestOptions
    ): Promise<IJsonRpcResponseSuccess | IJsonRpcResponseError>

    approveRequest(response: Partial<IJsonRpcResponseSuccess>): void
    rejectRequest(response: Partial<IJsonRpcResponseError>): void
  }

  export interface ICryptoLib {
    generateKey: (length?: number) => Promise<ArrayBuffer>
    encrypt: (
      data: IJsonRpcRequest | IJsonRpcResponseSuccess | IJsonRpcResponseError,
      key: ArrayBuffer
    ) => Promise<IEncryptionPayload>
    decrypt: (
      payload: IEncryptionPayload,
      key: ArrayBuffer
    ) => Promise<
      IJsonRpcRequest | IJsonRpcResponseSuccess | IJsonRpcResponseError | null
    >
  }

  export interface ITransportLib {
    open: () => void
    send: (socketMessage: ISocketMessage) => void
    close: () => void
    on: (event: string, callback: (payload: any) => void) => void
  }

  export interface ITransportEvent {
    event: string
    callback: (payload: any) => void
  }

  export interface ISessionStorage {
    getSession: () => IWalletConnectSession | null
    setSession: (session: IWalletConnectSession) => IWalletConnectSession
    removeSession: () => void
  }

  export interface IEncryptionPayload {
    data: string
    hmac: string
    iv: string
  }

  export interface ISocketMessage {
    topic: string
    type: string
    payload: string
    silent: boolean
  }

  export interface ISessionStatus {
    chainId: number
    accounts: string[]
    networkId?: number
    rpcUrl?: string
  }

  export interface ISessionError {
    message?: string
  }

  export interface IInternalEvent {
    event: string
    params: any
  }

  export interface ICallTxData {
    to?: string
    value?: number | string
    gas?: number | string
    gasLimit?: number | string
    gasPrice?: number | string
    nonce?: number | string
    data?: string
  }

  export interface ITxData extends ICallTxData {
    from: string
  }

  export interface IJsonRpcResponseSuccess {
    id: number
    jsonrpc: string
    result: any
  }

  export interface IJsonRpcErrorMessage {
    code?: number
    message: string
  }

  export interface IJsonRpcResponseError {
    id: number
    jsonrpc: string
    error: IJsonRpcErrorMessage
  }

  export interface IJsonRpcRequest {
    id: number
    jsonrpc: string
    method: string
    params: any[]
  }

  export interface IJsonRpcSubscription {
    id: number
    jsonrpc: string
    method: string
    params: any
  }

  export type JsonRpc =
    | IJsonRpcRequest
    | IJsonRpcSubscription
    | IJsonRpcResponseSuccess
    | IJsonRpcResponseError

  export type IErrorCallback = (err: Error | null, data?: any) => void

  export type ICallback = () => void

  export interface IError extends Error {
    res?: any
    code?: any
  }

  export interface IClientMeta {
    description: string
    url: string
    icons: string[]
    name: string
  }

  export interface IEventEmitter {
    event: string
    callback: (error: Error | null, request: any | null) => void
  }

  export interface IRequiredParamsResult {
    handshakeTopic: string
    version: number
  }

  export interface IQueryParamsResult {
    bridge: string
    key: string
  }

  export interface IParseURIResult {
    protocol: string
    handshakeTopic: string
    version: number
    bridge: string
    key: string
  }

  export interface ISessionParams {
    approved: boolean
    chainId: number | null
    networkId: number | null
    accounts: string[] | null
    rpcUrl?: string | null
    peerId?: string | null
    peerMeta?: IClientMeta | null
  }

  export interface IWalletConnectSession {
    connected: boolean
    accounts: string[]
    chainId: number
    bridge: string
    key: string
    clientId: string
    clientMeta: IClientMeta | null
    peerId: string
    peerMeta: IClientMeta | null
    handshakeId: number
    handshakeTopic: string
  }

  export interface IWalletConnectOptions {
    bridge?: string
    uri?: string
    session?: IWalletConnectSession
  }

  export interface INodeJSOptions {
    clientMeta: IClientMeta
  }

  export interface IPushServerOptions {
    url: string
    type: string
    token: string
    peerMeta?: boolean
    language?: string
  }

  export interface INativeWalletOptions {
    clientMeta: IClientMeta
    push?: IPushServerOptions | null
  }

  export interface IPushSubscription {
    bridge: string
    topic: string
    type: string
    token: string
    peerName: string
    language: string
  }

  export interface IUpdateChainParams {
    chainId: number
    networkId: number
    rpcUrl: string
    nativeCurrency: {
      name: string
      symbol: string
    }
  }

  export interface IRPCMap {
    [chainId: number]: string
  }

  export interface IWCRpcConnectionOptions {
    bridge?: string
    qrcode?: boolean
    chainId?: number
  }

  export interface IWCEthRpcConnectionOptions extends IWCRpcConnectionOptions {
    rpc?: IRPCMap
    infuraId?: string
  }

  export interface IRequestOptions {
    forcePushNotification?: boolean
  }

  export interface IInternalRequestOptions extends IRequestOptions {
    topic: string
  }

  export interface ICreateSessionOptions {
    chainId?: number
  }

  export interface IWCRpcConnectionOptions {
    bridge?: string
    qrcode?: boolean
  }

  export interface IWCRpcConnection {
    bridge: string
    qrcode: boolean
    wc: IConnector | null
    connected: boolean
    closed: boolean

    openQRCode(): void
    create(chainId?: number): void
    onClose(): void
    open(): Promise<void>
    close(): Promise<void>
    onError(payload: any, message: string, code?: number): void
    sendPayload(payload: any): Promise<any>
    send(payload: any): Promise<any>
  export interface IMobileRegistryEntry {
    name: string
    color: string
    universalLink: string
    deepLink: string
    chromeIntent: string
  }
}
