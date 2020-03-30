import EthereumProvider from "./provider";
import WCRpcConnection from "@walletconnect/rpc-connection";
import { IWCRpcConnectionOptions } from "@walletconnect/types";

class WalletConnectProvider extends EthereumProvider {
  constructor(opts: IWCRpcConnectionOptions) {
    const connection = new WCRpcConnection(opts);
    super(connection);
  }

  get isWalletConnect() {
    return true;
  }
}

export default WalletConnectProvider;
