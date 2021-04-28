import ThreeIdProvider from "3id-provider";
import SignerConnection from "@walletconnect/signer-connection";
import { IWCRpcConnectionOptions } from "@walletconnect/types";

class WalletConnectThreeIdProvider extends ThreeIdProvider {
  constructor(opts?: IWCRpcConnectionOptions) {
    super(new SignerConnection(opts));
  }

  get isWalletConnect() {
    return true;
  }
}

export default WalletConnectThreeIdProvider;
