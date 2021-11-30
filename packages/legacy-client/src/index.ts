import Connector from "./core";
import { IWalletConnectOptions, IPushServerOptions } from "./types";
import * as cryptoLib from "./crypto";

export * from "./types";
export * from "./browser";
export * from "./constants";

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
