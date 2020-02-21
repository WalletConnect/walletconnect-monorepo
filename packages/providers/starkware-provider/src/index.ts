import StarkwareProvider from "./provider";
import WCRpcConnection from "@walletconnect/rpc-connection";
import { IWCRpcConnectionOptions } from "@walletconnect/types";

class WalletConnectStarkwareProvider extends StarkwareProvider {
  constructor(opts: IWCRpcConnectionOptions) {
    const connection = new WCRpcConnection(opts);
    super(connection);
  }
}

export default WalletConnectStarkwareProvider;
