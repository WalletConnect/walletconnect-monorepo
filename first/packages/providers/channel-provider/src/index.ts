import { IWCRpcConnectionOptions } from "@walletconnect/types";
import WCRpcConnection from "@walletconnect/rpc-connection";
import { ChannelProvider } from "@connext/channel-provider";

class WalletConnectChannelProvider extends ChannelProvider {
  constructor(opts?: IWCRpcConnectionOptions) {
    super(new WCRpcConnection(opts) as any);
  }

  get isWalletConnect() {
    return true;
  }
}

export default WalletConnectChannelProvider;
