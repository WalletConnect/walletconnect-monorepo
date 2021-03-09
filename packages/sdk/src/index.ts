import ThreeIdProvider from "@walletconnect/3id-provider";
import ChannelProvider from "@walletconnect/channel-provider";
import WalletConnect from "@walletconnect/client";
import QRCodeModal from "@walletconnect/qrcode-modal";
import StarkwareProvider from "@walletconnect/starkware-provider";
import {
  IConnector,
  ICreateSessionOptions,
  IWalletConnectOptions,
  IWalletConnectProviderOptions,
  IWalletConnectSDKOptions,
  IWalletConnectStarkwareProviderOptions,
  IWCRpcConnectionOptions,
} from "@walletconnect/types";
import { isNode } from "@walletconnect/utils";
import Web3Provider from "@walletconnect/web3-provider";

class WalletConnectSDK {
  public connector: IConnector | undefined;
  constructor(private options?: IWalletConnectSDKOptions) {}

  get connected() {
    if (this.connector) {
      return this.connector.connected;
    }
    return false;
  }

  public async connect(createSessionOpts?: ICreateSessionOptions): Promise<IConnector> {
    const options: IWalletConnectOptions = {
      bridge: "https://bridge.walletconnect.org",
      qrcodeModal: QRCodeModal,
      ...this.options,
    };
    if (isNode()) {
      options.clientMeta = this.options?.clientMeta || {
        description: "WalletConnect SDK in NodeJS",
        icons: ["https://walletconnect.org/walletconnect-logo.png"],
        name: "WalletConnect SDK",
        url: "#",
      };
    }
    const connector = new WalletConnect(options);
    await connector.connect(createSessionOpts);
    this.connector = connector;
    return connector;
  }

  public getWeb3Provider(opts?: IWalletConnectProviderOptions) {
    if (!this.connector) {
      throw new Error("No connector available - please call connect() first");
    }
    return new Web3Provider({ ...opts, connector: this.connector });
  }

  public getChannelProvider(opts?: IWCRpcConnectionOptions) {
    if (!this.connector) {
      throw new Error("No connector available - please call connect() first");
    }
    return new ChannelProvider({ ...opts, connector: this.connector });
  }

  public getStarkwareProvider(opts: IWalletConnectStarkwareProviderOptions) {
    if (!this.connector) {
      throw new Error("No connector available - please call connect() first");
    }
    return new StarkwareProvider({ ...opts, connector: this.connector });
  }

  public getThreeIdProvider(opts?: IWCRpcConnectionOptions) {
    if (!this.connector) {
      throw new Error("No connector available - please call connect() first");
    }
    return new ThreeIdProvider({ ...opts, connector: this.connector });
  }
}

export default WalletConnectSDK;
