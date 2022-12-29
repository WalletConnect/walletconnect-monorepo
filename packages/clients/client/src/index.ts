import Connector from "@walletconnect/core";
import { IWalletConnectOptions, IPushServerOptions } from "@dcentwallet/types";
import * as cryptoLib from "@walletconnect/iso-crypto";

class WalletConnect extends Connector {
  constructor(connectorOpts: IWalletConnectOptions, pushServerOpts?: IPushServerOptions) {
    super({
      cryptoLib,
      connectorOpts,
      pushServerOpts,
    });
  }
}

export default WalletConnect;
