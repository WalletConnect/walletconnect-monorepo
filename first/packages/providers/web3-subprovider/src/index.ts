import WalletConnect from "@walletconnect/client";
import QRCodeModal from "@walletconnect/qrcode-modal";
import { IWCEthRpcConnectionOptions, IConnector } from "@walletconnect/types";

const HookedWalletSubprovider = require("web3-provider-engine/subproviders/hooked-wallet");

const isNode = () =>
  typeof process !== "undefined" &&
  typeof process.versions !== "undefined" &&
  typeof process.versions.node !== "undefined";

class WalletConnectSubprovider extends HookedWalletSubprovider {
  private _connected = false;
  constructor(opts: IWCEthRpcConnectionOptions) {
    super({
      getAccounts: async (cb: any) => {
        try {
          const wc = await this.getWalletConnector();
          const accounts = wc.accounts;
          if (accounts && accounts.length) {
            cb(null, accounts);
          } else {
            cb(new Error("Failed to get accounts"));
          }
        } catch (error) {
          cb(error);
        }
      },
      processMessage: async (msgParams: { from: string; data: string }, cb: any) => {
        try {
          const wc = await this.getWalletConnector();
          const result = await wc.signMessage([msgParams.from, msgParams.data]);
          cb(null, result);
        } catch (error) {
          cb(error);
        }
      },
      processPersonalMessage: async (msgParams: { from: string; data: string }, cb: any) => {
        try {
          const wc = await this.getWalletConnector();
          const result = await wc.signPersonalMessage([msgParams.data, msgParams.from]);
          cb(null, result);
        } catch (error) {
          cb(error);
        }
      },
      processSignTransaction: async (txParams: any, cb: any) => {
        try {
          const wc = await this.getWalletConnector();
          const result = await wc.signTransaction(txParams);
          cb(null, result);
        } catch (error) {
          cb(error);
        }
      },
      processTransaction: async (txParams: any, cb: any) => {
        try {
          const wc = await this.getWalletConnector();
          const result = await wc.sendTransaction(txParams);
          cb(null, result);
        } catch (error) {
          cb(error);
        }
      },
      processTypedMessage: async (msgParams: { from: string; data: string }, cb: any) => {
        try {
          const wc = await this.getWalletConnector();
          const result = await wc.signTypedData([msgParams.from, msgParams.data]);
          cb(null, result);
        } catch (error) {
          cb(error);
        }
      },
    });

    const clientMeta = isNode()
      ? {
          name: "wallet-connect-provider",
          description: "WalletConnect provider",
          url: "#",
          icons: ["https://walletconnect.org/walletconnect-logo.png"],
        }
      : opts.clientMeta;

    this.bridge = opts.connector
      ? opts.connector.bridge
      : opts.bridge || "https://bridge.walletconnect.org";
    this.qrcode = typeof opts.qrcode === "undefined" || opts.qrcode !== false;
    this.chainId = typeof opts.chainId !== "undefined" ? opts.chainId : 1;
    this.networkId = this.chainId;
    this.qrcodeModalOptions = opts.qrcodeModalOptions;
    this.wc =
      opts.connector ||
      new WalletConnect({
        bridge: this.bridge,
        clientMeta,
        qrcodeModal: this.qrcode ? QRCodeModal : undefined,
        qrcodeModalOptions: this.qrcodeModalOptions,
      });

    this.isConnecting = false;
    this.connectCallbacks = [];
  }

  get isWalletConnect() {
    return true;
  }

  get connector() {
    return this.wc;
  }

  get connected() {
    return this._connected;
  }

  get uri() {
    return this.wc.uri;
  }

  get accounts() {
    return this.wc.accounts;
  }

  onConnect(callback: any) {
    this.connectCallbacks.push(callback);
  }

  triggerConnect(result: any) {
    if (this.connectCallbacks && this.connectCallbacks.length) {
      this.connectCallbacks.forEach((callback: any) => callback(result));
    }
  }

  // disableSessionCreation - if true, getWalletConnector won't try to create a new session
  // in case the connector is disconnected
  getWalletConnector(opts: { disableSessionCreation?: boolean } = {}): Promise<IConnector> {
    const { disableSessionCreation = false } = opts;

    return new Promise((resolve, reject) => {
      const wc = this.wc;

      if (this.isConnecting) {
        this.onConnect((x: any) => resolve(x));
      } else if (!wc.connected && !disableSessionCreation) {
        this.isConnecting = true;
        const sessionRequestOpions = this.chainId ? { chainId: this.chainId } : undefined;
        wc.on("modal_closed", () => {
          reject(new Error("User closed modal"));
        });
        wc.createSession(sessionRequestOpions)
          .then(() => {
            wc.on("connect", (error: any, payload: any) => {
              if (this.qrcode) {
                // do nothing
              }
              if (error) {
                this.isConnecting = false;
                return reject(error);
              }
              this.isConnecting = false;
              this._connected = true;

              if (payload) {
                // Handle session update
                this.updateState(payload.params[0]);
              }
              // Emit connect event
              this.emit("connect");

              this.triggerConnect(wc);
              resolve(wc);
            });
          })
          .catch((error: any) => {
            this.isConnecting = false;
            reject(error);
          });
      } else {
        if (!this.connected) {
          this._connected = true;
          this.updateState(wc.session);
        }
        resolve(wc);
      }
    });
  }
}

export default WalletConnectSubprovider;
