declare module '@walletconnect/types' {
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
  }

  export interface ISessionStatus {
    chainId: number
    accounts: string[]
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

  export type IJsonRpcCallback = (
    err: Error | null,
    result?: IJsonRpcResponseSuccess
  ) => void

  export interface IWeb3Provider {
    sendAsync(payload: IJsonRpcRequest, callback: IJsonRpcCallback): void
  }

  export type IErrorCallback = (err: Error | null, data?: any) => void

  export type ICallback = () => void

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
    accounts: string[] | null
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
}
