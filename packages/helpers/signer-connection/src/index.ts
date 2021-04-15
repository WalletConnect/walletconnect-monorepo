import EventEmitter from "eventemitter3";
import { IJsonRpcConnection } from "@json-rpc-tools/types";
import { formatJsonRpcError } from "@json-rpc-tools/utils";

import WCRpcConnection from "@walletconnect/rpc-connection";
import { IConnector, IWCEthRpcConnectionOptions, IWCRpcConnection } from "@walletconnect/types";

export class SignerConnection extends IJsonRpcConnection {
  public events: any = new EventEmitter();

  public accounts: string[] = [];
  public chainId = 1;

  private pending = false;
  private rpc: IWCRpcConnection | undefined;
  private opts: IWCEthRpcConnectionOptions | undefined;

  constructor(opts?: IWCEthRpcConnectionOptions) {
    super();
    this.opts = opts;
    this.chainId = opts?.chainId || this.chainId;
    this.rpc = this.register(opts);
  }

  get connected(): boolean {
    return typeof this.rpc !== "undefined" && this.rpc.connected;
  }

  get connecting(): boolean {
    return this.pending;
  }

  get connector(): IConnector {
    this.rpc = this.register(this.opts);
    return this.rpc.connector;
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

  public async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.pending = true;
      if (typeof this.rpc === "undefined") {
        this.rpc = this.register(this.opts);
      }
      if (this.rpc.connector === null) {
        throw new Error("Connector missing or invalid");
      }
      this.rpc.connector.on("disconnect", err => {
        if (err) return reject(err);
        this.onClose();
        reject();
      });
      this.rpc.connector.on("connect", (err, payload) => {
        if (err) return reject(err);
        const { accounts, chainId } = payload.params[0];
        this.accounts = accounts;
        this.chainId = chainId;
        this.onOpen(this.rpc);
        resolve();
      });

      this.rpc.create();
    });
  }

  public async close() {
    if (typeof this.rpc === "undefined") {
      return;
    }
    if (this.rpc.connector === null) {
      throw new Error("Connector missing or invalid");
    }
    await this.rpc.connector.killSession();
    this.onClose();
  }

  public async send(payload: any) {
    if (typeof this.rpc === "undefined") {
      this.rpc = this.register(this.opts);
      if (!this.connected) await this.open();
    }
    this.rpc
      .sendPayload(payload)
      .then((res: any) => this.events.emit("payload", res))
      .catch(e => this.events.emit("payload", formatJsonRpcError(payload.id, e.message)));
  }

  // ---------- Private ----------------------------------------------- //

  private register(opts?: IWCEthRpcConnectionOptions): IWCRpcConnection {
    this.opts = opts || this.opts;
    return new WCRpcConnection(opts);
  }

  private onOpen(rpc?: IWCRpcConnection) {
    this.pending = false;
    if (rpc) {
      this.rpc = rpc;
    }
    this.events.emit("open");
    this.registerUpdateEvents();
  }

  private onClose() {
    this.pending = false;
    if (this.rpc) {
      this.rpc = undefined;
    }
    this.events.emit("close");
  }

  private registerUpdateEvents() {
    if (!this.rpc || this.rpc.connector === null) return;
    this.rpc.connector.on("session_update", (error, payload) => {
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
}

export default SignerConnection;
