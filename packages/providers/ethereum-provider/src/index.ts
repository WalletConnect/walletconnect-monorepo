import EthereumProvider from "ethereum-provider";
import WCRpcConnection from "@walletconnect/rpc-connection";
import { IWCRpcConnectionOptions } from "@walletconnect/types";

class WalletConnectEthereumProvider extends EthereumProvider {
  constructor(opts?: IWCRpcConnectionOptions) {
    super(new WCRpcConnection(opts));
  }

  get isWalletConnect() {
    return true;
  }
}

export default WalletConnectEthereumProvider;
