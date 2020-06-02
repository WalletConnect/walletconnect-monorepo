import Connector from "@walletconnect/core";
import { IWalletConnectOptions, INodeJSOptions } from "@walletconnect/types";
import * as cryptoLib from "@walletconnect/node-crypto";
import { logDeprecationWarning } from "@walletconnect/utils";

class NodeWalletConnect extends Connector {
  constructor(connectorOpts: IWalletConnectOptions, nodeJsOptions: INodeJSOptions) {
    super({
      cryptoLib,
      connectorOpts: {
        ...connectorOpts,
        clientMeta: nodeJsOptions.clientMeta || connectorOpts.clientMeta,
      },
    });
    logDeprecationWarning();
  }
}

export default NodeWalletConnect;
