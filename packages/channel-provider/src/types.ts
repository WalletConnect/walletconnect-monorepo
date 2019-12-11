export {
  ChannelRouterConfig,
  Node as CFCoreTypes,
  RpcConnection
} from '@connext/types'

export enum NewRpcMethodName {
  STORE_SET = 'chan_storeSet',
  STORE_GET = 'chan_storeGet',
  NODE_AUTH = 'chan_nodeAuth',
  CONFIG = 'chan_config',
  RESTORE_STATE = 'chan_restoreState',
  GET_STATE_CHANNEL = 'chan_getStateChannel'
}
