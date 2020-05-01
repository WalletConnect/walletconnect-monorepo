import Connector from "@walletconnect/core";
import { IWalletConnectOptions } from "@walletconnect/types";
import { logDeprecationWarning } from "@walletconnect/utils";
import * as cryptoLib from "@walletconnect/browser-crypto";

class WalletConnect extends Connector {
  constructor(connectorOpts: IWalletConnectOptions) {
    super({
      cryptoLib,
      connectorOpts,
      clientMeta: connectorOpts.clientMeta,
    });
    logDeprecationWarning();
  }
}

export default WalletConnect;
