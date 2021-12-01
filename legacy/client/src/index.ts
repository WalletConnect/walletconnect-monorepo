import { IWalletConnectOptions, IPushServerOptions } from "@walletconnect/legacy-types";

import Connector from "./core";
import * as cryptoLib from "./crypto";

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
