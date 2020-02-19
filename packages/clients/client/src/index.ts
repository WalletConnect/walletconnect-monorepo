import Connector from "@walletconnect/core";
import qrcodeModal from "@walletconnect/qrcode-modal";
import { IWalletConnectOptions, IPushServerOptions } from "@walletconnect/types";
import * as cryptoLib from "@walletconnect/iso-crypto";

class WalletConnect extends Connector {
  constructor(connectorOpts: IWalletConnectOptions, pushServerOpts?: IPushServerOptions) {
    super({
      cryptoLib,
      connectorOpts,
      qrcodeModal,
      pushServerOpts,
    });
  }
}

export default WalletConnect;
