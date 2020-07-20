import StarkwareProvider from "starkware-provider";
import WCRpcConnection from "@walletconnect/rpc-connection";
import { IWalletConnectStarkwareProviderOptions } from "@walletconnect/types";

export * from "starkware-provider";

class WalletConnectStarkwareProvider extends StarkwareProvider {
  constructor(opts: IWalletConnectStarkwareProviderOptions) {
    const connection = new WCRpcConnection(opts);
    super(connection, opts.contractAddress);
  }

  get isWalletConnect() {
    return true;
  }
}

export default WalletConnectStarkwareProvider;
