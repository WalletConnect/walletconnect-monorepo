import { ChannelProvider } from "@connext/channel-provider";
import WCRpcConnection from "@walletconnect/rpc-connection";
import { IWCRpcConnectionOptions } from "@walletconnect/types";

class WalletConnectChannelProvider extends ChannelProvider {
  constructor(opts?: IWCRpcConnectionOptions) {
    super(new WCRpcConnection(opts) as any);
  }

  get isWalletConnect() {
    return true;
  }
}

export default WalletConnectChannelProvider;
