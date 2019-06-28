// @ts-ignore
import EthereumProvider from 'ethereum-provider'
import WalletConnectConnection from './connection'
import { IWalletConnectConnectionOptions } from '@walletconnect/types'

export default (options: IWalletConnectConnectionOptions) => {
  const connection = new WalletConnectConnection(options)
  const provider = new EthereumProvider(connection)
  return provider
}
