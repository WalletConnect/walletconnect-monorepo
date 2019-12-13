export type ChannelProviderConfig = {
  freeBalanceAddress: string
  multisigAddress?: string // may not be deployed yet
  natsClusterId?: string
  natsToken?: string
  nodeUrl: string
  signerAddress: string
  userPublicIdentifier: string
}

export type StorePair = {
  path: string
  value: any
}

export type KeyGen = (index: string) => Promise<string>

export enum NewRpcMethodName {
  STORE_SET = 'chan_storeSet',
  STORE_GET = 'chan_storeGet',
  NODE_AUTH = 'chan_nodeAuth',
  CONFIG = 'chan_config',
  RESTORE_STATE = 'chan_restoreState',
  GET_STATE_CHANNEL = 'chan_getStateChannel'
}
