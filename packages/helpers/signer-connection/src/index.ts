import EventEmitter from "eventemitter3";
import { IJsonRpcConnection } from "@json-rpc-tools/types";

import WCRpcConnection from "@walletconnect/rpc-connection";
import { IWCEthRpcConnectionOptions, IWCRpcConnection } from "@walletconnect/types";

export class SignerConnection extends IJsonRpcConnection {
  public events: any = new EventEmitter();

  private connector: IWCRpcConnection | undefined;
  private opts: IWCEthRpcConnectionOptions | undefined;

  private registering = false;

  constructor(opts?: IWCEthRpcConnectionOptions) {
    super();
    this.opts = opts;
  }

  get connected(): boolean {
    return typeof this.connector !== "undefined" && this.connector.connected;
  }

  get connecting(): boolean {
    return this.registering;
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
    this.register();
  }

  public async close() {
    if (typeof this.connector === "undefined") {
      return;
    }
    if (this.connector.wc === null) {
      throw new Error("Connector missing or invalid");
    }
    await this.connector.wc.killSession();
    this.onClose();
  }

  public async send(payload: any) {
    if (typeof this.connector === "undefined") {
      this.connector = await this.register(this.opts);
    }
    this.connector.sendPayload(payload).then((res: any) => this.events.emit("payload", res));
  }

  // ---------- Private ----------------------------------------------- //

  private register(
    opts: IWCEthRpcConnectionOptions | undefined = this.opts,
  ): Promise<IWCRpcConnection> {
    if (this.registering) {
      return new Promise<any>((resolve, reject) => {
        this.events.once("open", () => {
          if (typeof this.connector === "undefined") {
            return reject(new Error("Signer connection is missing or invalid"));
          }
          resolve(this.connector);
        });
      });
    }
    return new Promise((resolve, reject) => {
      const connector = new WCRpcConnection(opts);
      if (connector.wc === null) {
        throw new Error("Connector missing or invalid");
      }
      connector.wc.on("disconnect", () => {
        reject();
      });
      connector.wc.on("connect", () => {
        this.onOpen(connector);
        resolve(connector);
      });

      connector.create();
    });
  }

  private onOpen(connector?: IWCRpcConnection) {
    if (connector) {
      this.connector = connector;
    }
    this.registering = false;
    this.events.emit("open");
  }

  private onClose() {
    if (this.connector) {
      this.connector = undefined;
    }
    this.events.emit("close");
  }
}

export default SignerConnection;
