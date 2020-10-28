import { EventEmitter } from "events";
import { safeJsonStringify } from "safe-json-utils";
import {
  IJsonRpcProvider,
  JsonRpcPayload,
  JsonRpcRequest,
  isJsonRpcResponse,
} from "rpc-json-utils";

const WS =
  // @ts-ignore
  typeof global.WebSocket !== "undefined" ? global.WebSocket : require("ws");

export class WSProvider extends IJsonRpcProvider {
  public events = new EventEmitter();

  public rpcUrl: string;
  public socket: WebSocket | undefined;

  constructor(rpcUrl: string) {
    super();
    this.rpcUrl = rpcUrl;
  }

  public async connect() {
    const socket = new WS(this.rpcUrl, {
        rejectUnauthorized: false, // Allows for self signed certs
    });
    socket.onmessage = (event: MessageEvent) => this.onMessage(event.data);
    this.socket = socket;
  }

  public async disconnect() {
    if (typeof this.socket === "undefined") {
      throw new Error("Socket is not connected");
    }
    this.socket.close();
    this.socket = undefined;
  }

  public on(event: string, listener: any): void {
    this.events.on(event, listener);
  }

  public once(event: string, listener: any): void {
    this.events.once(event, listener);
  }

  public off(event: string, listener: any): void {
    this.events.off(event, listener);
  }

  public async request(payload: JsonRpcRequest): Promise<any> {
    return new Promise((resolve, reject) => {
      this.events.on(`${payload.id}`, response => {
        if (response.error) {
          reject(response.error.message);
        } else {
          resolve(response.result);
        }
      });
      if (typeof this.socket === "undefined") {
        throw new Error("Socket is not connected");
      }
      this.socket.send(safeJsonStringify(payload));
    });
  }

  private onMessage(e: MessageEvent) {
    const payload = JSON.parse(e.data) as JsonRpcPayload;
    if (isJsonRpcResponse(payload)) {
      this.events.emit(`${payload.id}`, payload);
    } else {
      this.events.emit("request", payload);
    }
  }
}
