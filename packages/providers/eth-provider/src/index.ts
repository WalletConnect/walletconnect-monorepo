import EthereumProvider from "./provider";
import WCRpcConnection from "@walletconnect/rpc-connection";
import { IWCRpcConnectionOptions } from "@walletconnect/types";

class WalletConnectProvider extends EthereumProvider {
  constructor(opts?: IWCRpcConnectionOptions) {
    super(new WCRpcConnection(opts));
  }

  get isWalletConnect() {
    return true;
  }
}

export default WalletConnectProvider;
