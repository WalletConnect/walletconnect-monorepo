import { EventEmitter } from "events";
import { safeJsonParse, safeJsonStringify } from "safe-json-utils";
import {
  IJsonRpcProvider,
  JsonRpcPayload,
  JsonRpcRequest,
  isJsonRpcResponse,
} from "rpc-json-utils";
import { Logger } from "pino";
import { formatLoggerContext } from "@walletconnect/utils";

const WS =
  // @ts-ignore
  typeof global.WebSocket !== "undefined" ? global.WebSocket : require("ws");

const WS_PROVIDER_CONTEXT = "provider";

export class WSProvider extends IJsonRpcProvider {
  public events = new EventEmitter();

  public socket: WebSocket | undefined;

  protected context: string = WS_PROVIDER_CONTEXT;

  constructor(public rpcUrl: string, public logger: Logger) {
    super();
    this.rpcUrl = rpcUrl;
    this.logger = logger.child({
      context: formatLoggerContext(logger, this.context),
    });
    this.initialize();
  }

  public async connect(rpcUrl = this.rpcUrl): Promise<void> {
    this.logger.debug(`Connecting JSON-RPC Provider WebSocket`);
    this.logger.trace({ type: "method", method: "connect", rpcUrl });
    return new Promise((resolve, reject) => {
      this.rpcUrl = rpcUrl;
      const socket = new WS(rpcUrl) as WebSocket;
      socket.onopen = () => {
        this.logger.trace("Successfully connected JSON-RPC Provider WebSocket");
        this.logger.debug({ type: "event", event: "onopen" });
        this.events.emit("connect");
        socket.onmessage = (event: MessageEvent) => this.onMessage(event);
        socket.onclose = (event: CloseEvent) => this.onClose(event);
        this.socket = socket;
        resolve();
      };

      socket.onerror = (event: Event) => {
        this.logger.trace("Failed to connect JSON-RPC Provider WebSocket");
        this.logger.debug({ type: "event", event: "onerror" });
        this.events.emit("error", event);
        reject(event);
      };
    });
  }

  public async disconnect(): Promise<void> {
    this.logger.debug(`Disconnecting JSON-RPC Provider WebSocket`);
    this.logger.trace({ type: "method", method: "disconnect" });
    if (typeof this.socket === "undefined") {
      throw new Error("Socket is not connected");
    }
    this.socket.close();
    this.events.emit("disconnect");
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

  // ---------- Private ----------------------------------------------- //

  private onClose(e: CloseEvent) {
    this.logger.trace("Closed JSON-RPC Provider WebSocket");
    this.logger.debug({ type: "event", event: "onclose" });
    this.events.emit("disconnect");
    this.socket = undefined;
  }

  private onMessage(e: MessageEvent) {
    if (typeof e.data === "undefined") return;
    const payload = safeJsonParse(e.data) as JsonRpcPayload;
    if (isJsonRpcResponse(payload)) {
      this.events.emit(`${payload.id}`, payload);
    } else {
      this.events.emit("request", payload);
    }
  }

  private async initialize(): Promise<void> {
    this.logger.trace(`Initialized`);
  }
}
