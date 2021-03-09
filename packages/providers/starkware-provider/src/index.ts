import WCRpcConnection from "@walletconnect/rpc-connection";
import { IWalletConnectStarkwareProviderOptions } from "@walletconnect/types";
import StarkwareProvider from "starkware-provider";

class WalletConnectStarkwareProvider extends StarkwareProvider {
  constructor(opts: IWalletConnectStarkwareProviderOptions) {
    const connection = new WCRpcConnection(opts);
    super(connection as any, opts.contractAddress);
  }

  get isWalletConnect() {
    return true;
  }
}

export default WalletConnectStarkwareProvider;
