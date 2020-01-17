import EventEmitter from 'events'

import {
  ChannelProviderRpcMethod,
  ChannelProviderConfig,
  JsonRpcRequest,
  StorePair
} from './types'

export interface IChannelProvider extends EventEmitter {
  /// /////////////////////////////////////
  // Properties

  connected: boolean
  connection: IRpcConnection
  _config: ChannelProviderConfig | undefined
  _multisigAddress: string | undefined
  _signerAddress: string | undefined

  /// /////////////////////////////////////
  // Methods

  enable(): Promise<ChannelProviderConfig>
  send(method: ChannelProviderRpcMethod | string, params: any): Promise<any>
  close(): void

  /// ////////////////////////////////
  // GETTERS / SETTERS
  isSigner: boolean
  config: ChannelProviderConfig | undefined
  multisigAddress: string | undefined
  signerAddress: string | undefined

  /// ////////////////////////////////
  // LISTENER METHODS
  on(event: string, listener: (...args: any[]) => void): any
  once(event: string, listener: (...args: any[]) => void): any

  /// ////////////////////////////////
  // SIGNING METHODS
  signMessage(message: string): Promise<string>

  /// ////////////////////////////////
  // STORE METHODS
  get(path: string): Promise<any>
  set(pairs: StorePair[], allowDelete?: Boolean): Promise<void>
  restoreState(path: string): Promise<void>

  /// ////////////////////////////////
  // PRIVATE METHODS
  _send(method: ChannelProviderRpcMethod | string, params: any): Promise<any>
}

export interface IRpcConnection extends EventEmitter {
  /// /////////////////////////////////////
  // Properties
  connected: boolean

  /// /////////////////////////////////////
  // Methods
  send(payload: JsonRpcRequest): Promise<any>
  open(): void
  close(): void
}
