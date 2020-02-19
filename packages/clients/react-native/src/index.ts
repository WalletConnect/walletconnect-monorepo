import Connector from "@walletconnect/core";
import { IWalletConnectOptions, INativeWalletOptions } from "@walletconnect/types";
import * as cryptoLib from "@walletconnect/node-crypto";
// import { logDeprecationWarning } from '@walletconnect/utils'

class RNWalletConnect extends Connector {
  constructor (connectorOpts: IWalletConnectOptions, walletOptions: INativeWalletOptions) {
    super({
      cryptoLib,
      connectorOpts,
      clientMeta: connectorOpts.clientMeta || walletOptions.clientMeta,
      pushServerOpts: walletOptions.push || undefined,
    });
    // logDeprecationWarning()
  }
}

export default RNWalletConnect;
