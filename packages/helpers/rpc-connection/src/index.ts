import EventEmitter from "eventemitter3";
import WalletConnect from "@walletconnect/client";
import QRCodeModal from "@walletconnect/qrcode-modal";
import { isJsonRpcResponseError } from "@walletconnect/utils";
import {
  IWCRpcConnection,
  IWCRpcConnectionOptions,
  IConnector,
  IJsonRpcResponseError,
  IJsonRpcResponseSuccess,
  IQRCodeModalOptions,
} from "@walletconnect/types";

class WCRpcConnection extends EventEmitter implements IWCRpcConnection {
  public bridge = "https://bridge.walletconnect.org";
  public qrcode = true;
  public qrcodeModalOptions: IQRCodeModalOptions | undefined = undefined;

  public wc: IConnector;
  public chainId = 1;
  public connected = false;

  constructor(opts?: IWCRpcConnectionOptions) {
    super();
    this.bridge = opts?.connector
      ? opts.connector.bridge
      : opts?.bridge || "https://bridge.walletconnect.org";
    this.qrcode = typeof opts?.qrcode === "undefined" || opts.qrcode !== false;
    this.chainId = typeof opts?.chainId !== "undefined" ? opts.chainId : 1;
    this.qrcodeModalOptions = opts?.qrcodeModalOptions;
    this.wc =
      opts?.connector ||
      new WalletConnect({
        bridge: this.bridge,
        qrcodeModal: this.qrcode ? QRCodeModal : undefined,
        qrcodeModalOptions: this.qrcodeModalOptions,
        clientMeta: opts?.clientMeta,
      });

    if (this.wc.connected) {
      this.connected = true;
    }
    this.on("error", () => this.close());
  }

  get connector() {
    return this.wc;
  }

  public create(): void {
    if (!this.wc.connected) {
      this.wc
        .createSession({ chainId: this.chainId })
        .then(() => this.emit("created"))
        .catch((e: Error) => this.emit("error", e));
    }

    this.wc.on("modal_closed", () => {
      this.emit("error", new Error("User closed modal"));
    });

    this.wc.on("connect", (err: Error | null) => {
      if (err) {
        this.emit("error", err);
        return;
      }

      this.onOpen();
    });

    this.wc.on("disconnect", (err: Error | null) => {
      if (err) {
        this.emit("error", err);
        return;
      }

      this.onClose();
    });
  }

  public onOpen(): void {
    this.connected = true;
    // Emit connect event
    this.emit("connect");
    // Emit  open event
    this.emit("open");
  }

  public onClose(): void {
    this.wc = new WalletConnect({
      bridge: this.bridge,
      qrcodeModalOptions: this.qrcodeModalOptions,
    });
    this.connected = false;
    // Emit close event
    this.emit("close");
    // Emit disconnect event
    this.emit("disconnect");
    this.removeAllListeners();
  }

  public open(): Promise<void> {
    if (this.connected) {
      this.onOpen();
      return Promise.resolve();
    }
    return new Promise((resolve, reject): void => {
      this.on("error", err => {
        reject(err);
      });

      this.on("connect", () => {
        resolve();
      });

      this.create();
    });
  }

  public async close(): Promise<void> {
    if (this.wc.connected) {
      this.wc.killSession();
    }
    this.onClose();
    return Promise.resolve();
  }

  public onError(
    payload: any,
    message = "Failed or Rejected Request",
    code = -32000,
  ): IJsonRpcResponseError {
    const errorPayload = {
      id: payload.id,
      jsonrpc: payload.jsonrpc,
      error: { code, message },
    };
    this.emit("payload", errorPayload);
    return errorPayload;
  }

  public async sendPayload(payload: any): Promise<IJsonRpcResponseSuccess | IJsonRpcResponseError> {
    if (!this.wc || !this.wc.connected) {
      return this.onError(payload, "WalletConnect Not Connected");
    }
    try {
      return this.wc.unsafeSend(payload);
    } catch (error) {
      return this.onError(payload, error.message);
    }
  }

  public async send(payload: any): Promise<any> {
    const response = await this.sendPayload(payload);
    if (isJsonRpcResponseError(response)) {
      throw new Error(response.error.message || "Failed or Rejected Request");
    }
    return response.result;
  }
}

export default WCRpcConnection;
