// @ts-ignore
import EthereumProvider from 'ethereum-provider'
import WalletConnectConnection from './connection'
import { IWalletConnectConnectionOptions } from '@walletconnect/types'

function WalletConnectSubprovider (options: IWalletConnectConnectionOptions) {
  const connection = new WalletConnectConnection(options)
  const provider = new EthereumProvider(connection)
  return provider
}

export default WalletConnectSubprovider
