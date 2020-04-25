import BrowserWalletConnect from "@walletconnect/browser";
import BrowserQRCodeModal from "@walletconnect/qrcode-modal";
import Web3Provider from "@walletconnect/web3-provider";
import ChannelProvider from "@walletconnect/channel-provider";
import StarkwareProvider from "@walletconnect/starkware-provider";
import ThreeIdProvider from "@walletconnect/3id-provider";
import {
  IWalletConnectSDKOptions,
  IConnector,
  ICreateSessionOptions,
  IWalletConnectProviderOptions,
  IWCRpcConnectionOptions,
  IWalletConnectStarkwareProviderOptions,
} from "@walletconnect/types";

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
    const options = {
      bridge: "https://bridge.walletconnect.org",
      ...this.options,
      qrcodeModal: BrowserQRCodeModal,
    };
    const connector = new BrowserWalletConnect(options);
    await connector.connect(createSessionOpts);
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
