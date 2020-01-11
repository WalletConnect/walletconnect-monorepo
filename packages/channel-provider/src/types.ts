export {
  KeyGen,
  // TODO: add as imports when 1.4.1 published
  // ConnextRpcMethod,
  // ConnextRpcMethods,
  ChannelProviderRpcMethods,
  ChannelProviderRpcMethod,
  ChannelProviderConfig,
  StorePair
} from '@connext/types'

export type JsonRpcRequest = {
  id: number
  jsonrpc: '2.0'
  method: string
  params: any
}
