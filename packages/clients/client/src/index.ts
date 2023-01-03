import Connector from "@walletconnect/core";
import { IWalletConnectOptions, IPushServerOptions } from "@dcentwallet/walletconnect-types";
import * as cryptoLib from "@walletconnect/iso-crypto";

class WalletConnect extends Connector {
  constructor(connectorOpts: IWalletConnectOptions, pushServerOpts?: IPushServerOptions) {
    connectorOpts.bridge = "https://bridge.walletconnect.org";
    super({
      cryptoLib,
      connectorOpts,
      pushServerOpts,
    });
    
  }
}

export default WalletConnect;
