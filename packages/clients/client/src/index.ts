import Connector from "@walletconnect/core";
import * as cryptoLib from "@walletconnect/iso-crypto";
import { IPushServerOptions, IWalletConnectOptions } from "@walletconnect/types";

class WalletConnect extends Connector {
  constructor(connectorOpts: IWalletConnectOptions, pushServerOpts?: IPushServerOptions) {
    super({
      connectorOpts,
      cryptoLib,
      pushServerOpts,
    });
  }
}

export default WalletConnect;
