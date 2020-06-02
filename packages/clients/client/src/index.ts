import Connector from "@walletconnect/core";
import { IWalletConnectOptions, IPushServerOptions } from "@walletconnect/types";
import * as cryptoLib from "@walletconnect/iso-crypto";

class WalletConnect extends Connector {
  constructor(connectorOpts: IWalletConnectOptions, pushServerOpts?: IPushServerOptions) {
    super({
      cryptoLib,
      connectorOpts,
      clientMeta: connectorOpts.clientMeta,
      pushServerOpts,
    });
  }
}

export default WalletConnect;
