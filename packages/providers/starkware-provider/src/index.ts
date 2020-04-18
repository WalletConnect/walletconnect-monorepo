import StarkwareProvider from "starkware-provider";
import WCRpcConnection from "@walletconnect/rpc-connection";
import { IWCRpcConnectionOptions } from "@walletconnect/types";

interface WalletConnectStarkwareProviderOptions extends IWCRpcConnectionOptions {
  contractAddress: string;
}

class WalletConnectStarkwareProvider extends StarkwareProvider {
  constructor(opts: WalletConnectStarkwareProviderOptions) {
    const connection = new WCRpcConnection(opts);
    super(connection, opts.contractAddress);
  }

  get isWalletConnect() {
    return true;
  }
}

export default WalletConnectStarkwareProvider;
