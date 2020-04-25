import ThreeIdProvider from "3id-provider";
import WCRpcConnection from "@walletconnect/rpc-connection";
import { IWCRpcConnectionOptions } from "@walletconnect/types";

class WalletConnectThreeIdProvider extends ThreeIdProvider {
  constructor(opts?: IWCRpcConnectionOptions) {
    super(new WCRpcConnection(opts));
  }

  get isWalletConnect() {
    return true;
  }
}

export default WalletConnectThreeIdProvider;
