declare module '@walletconnect/types' {
  export interface ICryptoLib {
    generateKey: (length?: number) => Promise<ArrayBuffer>
    encrypt: (
      data: IJsonRpcRequest | IJsonRpcResponse,
      key: ArrayBuffer
    ) => Promise<IEncryptionPayload>
    decrypt: (
      payload: IEncryptionPayload,
      key: ArrayBuffer
    ) => Promise<IJsonRpcRequest | IJsonRpcResponse | null>
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

  export interface ITxData {
    from: string
    to: string
    nonce: string
    gasPrice: string
    gasLimit: string
    value: string
    data: string
  }

  export type IPartialRpcResponse = {
    id: number
    jsonrpc?: string
    result: any
  }

  export type IJsonRpcResponse = {
    id: number
    jsonrpc: string
    result: any
  }

  export type IPartialRpcRequest = {
    id?: number
    jsonrpc?: string
    method: string
    params: any[]
  }

  export type IJsonRpcRequest = {
    id: number
    jsonrpc: string
    method: string
    params: any[]
  }

  export type IJsonRpcCallback = (
    err: Error | null,
    result?: IJsonRpcResponse
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
    ssl: boolean
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
    message?: string | null
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
