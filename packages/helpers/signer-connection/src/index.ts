import EventEmitter from "eventemitter3";
import WalletConnect from "@walletconnect/client";
import QRCodeModal from "@walletconnect/qrcode-modal";
import { IJsonRpcConnection, JsonRpcError, JsonRpcResponse } from "@walletconnect/jsonrpc-types";
import { formatJsonRpcError } from "@walletconnect/jsonrpc-utils";
import {
  IConnector,
  IJsonRpcResponseError,
  IJsonRpcResponseSuccess,
  IQRCodeModalOptions,
  IWCEthRpcConnectionOptions,
} from "@walletconnect/types";

export class SignerConnection extends IJsonRpcConnection {
  public events: any = new EventEmitter();

  public accounts: string[] = [];
  public chainId = 1;

  private pending = false;
  private wc: IConnector | undefined;
  private bridge = "https://bridge.walletconnect.org";
  private qrcode = true;
  private qrcodeModalOptions: IQRCodeModalOptions | undefined = undefined;
  private opts: IWCEthRpcConnectionOptions | undefined;

  constructor(opts?: IWCEthRpcConnectionOptions) {
    super();
    this.opts = opts;
    this.chainId = opts?.chainId || this.chainId;
    this.wc = this.register(opts);
  }

  get connected(): boolean {
    return typeof this.wc !== "undefined" && this.wc.connected;
  }

  get connecting(): boolean {
    return this.pending;
  }

  get connector(): IConnector {
    this.wc = this.register(this.opts);
    return this.wc;
  }

  public on(event: string, listener: any) {
    this.events.on(event, listener);
  }

  public once(event: string, listener: any) {
    this.events.once(event, listener);
  }

  public off(event: string, listener: any) {
    this.events.off(event, listener);
  }

  public removeListener(event: string, listener: any) {
    this.events.removeListener(event, listener);
  }

  public async open(chainId?: number): Promise<void> {
    if (this.connected) {
      this.onOpen();
      return;
    }
    return new Promise((resolve, reject): void => {
      this.on("error", err => {
        reject(err);
      });

      this.on("open", () => {
        resolve();
      });

      this.create(chainId);
    });
  }

  public async close(): Promise<void> {
    if (typeof this.wc === "undefined") return;
    if (this.wc.connected) {
      this.wc.killSession();
    }
    this.onClose();
  }

  public async send(payload: any) {
    this.wc = this.register(this.opts);

    if (!this.connected) await this.open();
    this.sendPayload(payload)
      .then((res: any) => this.events.emit("payload", res))
      .catch(e => this.events.emit("payload", formatJsonRpcError(payload.id, e.message)));
  }

  // ---------- Private ----------------------------------------------- //

  private register(opts?: IWCEthRpcConnectionOptions): IConnector {
    if (this.wc) return this.wc;
    this.opts = opts || this.opts;
    this.bridge = opts?.connector
      ? opts.connector.bridge
      : opts?.bridge || "https://bridge.walletconnect.org";

    this.qrcode = typeof opts?.qrcode === "undefined" || opts.qrcode !== false;
    this.chainId = typeof opts?.chainId !== "undefined" ? opts.chainId : this.chainId;
    this.qrcodeModalOptions = opts?.qrcodeModalOptions;
    const connectorOpts = {
      bridge: this.bridge,
      qrcodeModal: this.qrcode ? QRCodeModal : undefined,
      qrcodeModalOptions: this.qrcodeModalOptions,
      storageId: opts?.storageId,
      signingMethods: opts?.signingMethods,
      clientMeta: opts?.clientMeta,
    };
    this.wc =
      typeof opts?.connector !== "undefined" ? opts.connector : new WalletConnect(connectorOpts);
    if (typeof this.wc === "undefined") {
      throw new Error("Failed to register WalletConnect connector");
    }
    if (this.wc.accounts.length) {
      this.accounts = this.wc.accounts;
    }
    if (this.wc.chainId) {
      this.chainId = this.wc.chainId;
    }
    // this.accounts = this.wc.accounts;
    // this.chainId = this.wc.chainId;
    this.registerConnectorEvents();
    return this.wc;
  }

  private onOpen(wc?: IConnector) {
    this.pending = false;
    if (wc) {
      this.wc = wc;
    }
    this.events.emit("open");
  }

  private onClose() {
    this.pending = false;
    if (this.wc) {
      this.wc = undefined;
    }
    this.events.emit("close");
  }

  public onError(
    payload: any,
    message = "Failed or Rejected Request",
    code = -32000,
    data?: string,
  ): JsonRpcError {
    const errorPayload: JsonRpcError = {
      id: payload.id,
      jsonrpc: payload.jsonrpc,
      error: { code, message },
    };
    if (typeof data !== "undefined") {
      errorPayload.error.data = data;
    }
    this.events.emit("payload", errorPayload);
    return errorPayload;
  }

  private create(chainId?: number): void {
    this.wc = this.register(this.opts);
    this.chainId = chainId || this.chainId;
    if (this.connected || this.pending) return;
    this.pending = true;
    this.registerConnectorEvents();
    this.wc
      .createSession({ chainId: this.chainId })
      .then(() => this.events.emit("created"))
      .catch((e: Error) => this.events.emit("error", e));
  }

  private registerConnectorEvents() {
    this.wc = this.register(this.opts);

    this.wc.on("connect", (err: Error | null) => {
      if (err) {
        this.events.emit("error", err);
        return;
      }
      this.accounts = this.wc?.accounts || [];
      this.chainId = this.wc?.chainId || this.chainId;

      this.onOpen();
    });

    this.wc.on("disconnect", (err: Error | null) => {
      if (err) {
        this.events.emit("error", err);
        return;
      }

      this.onClose();
    });

    this.wc.on("modal_closed", () => {
      this.events.emit("error", new Error("User closed modal"));
    });

    this.wc.on("session_update", (error, payload) => {
      const { accounts, chainId } = payload.params[0];
      if (!this.accounts || (accounts && this.accounts !== accounts)) {
        this.accounts = accounts;
        this.events.emit("accountsChanged", accounts);
      }
      if (!this.chainId || (chainId && this.chainId !== chainId)) {
        this.chainId = chainId;
        this.events.emit("chainChanged", chainId);
      }
    });
  }

  private async sendPayload(payload: any): Promise<JsonRpcResponse> {
    this.wc = this.register(this.opts);
    try {
      const response = await this.wc.unsafeSend(payload);
      return this.sanitizeResponse(response);
    } catch (error) {
      return this.onError(payload, (error as any).message);
    }
  }

  private sanitizeResponse(
    response: IJsonRpcResponseSuccess | IJsonRpcResponseError,
  ): JsonRpcResponse {
    return typeof (response as IJsonRpcResponseError).error !== "undefined" &&
      typeof (response as IJsonRpcResponseError).error.code === "undefined"
      ? formatJsonRpcError(
          response.id,
          (response as IJsonRpcResponseError).error.message,
          (response as IJsonRpcResponseError).error.data,
        )
      : (response as JsonRpcResponse);
  }
}

export default SignerConnection;
