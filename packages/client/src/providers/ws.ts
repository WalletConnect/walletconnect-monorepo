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
    this.logger.info("Connecting JSON-RPC Provider WebSocket");
    this.logger.debug({ type: "method", method: "connect", rpcUrl });
    return new Promise((resolve, reject) => {
      this.rpcUrl = rpcUrl;
      const socket = new WS(rpcUrl) as WebSocket;
      socket.onopen = () => {
        this.logger.info("Successfully connected JSON-RPC Provider WebSocket");
        this.logger.debug({ type: "event", event: "onopen" });
        socket.onmessage = (event: MessageEvent) => {
          this.logger.info("Received JSON-RPC Provider WebSocket Message");
          this.logger.debug({ type: "event", event: "onmessage", data: event.data });
          this.onMessage(event);
        };
        this.socket = socket;
        resolve();
      };
      socket.onerror = (event: Event) => {
        this.logger.info("Failed to connect JSON-RPC Provider WebSocket");
        this.logger.debug({ type: "event", event: "onerror" });
        reject(event);
      };
    });
  }

  public async disconnect(): Promise<void> {
    this.logger.info("Disconnecting JSON-RPC Provider WebSocket");
    this.logger.debug({ type: "method", method: "disconnect" });
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
    this.logger.info("Sending JSON-RPC Request");
    this.logger.debug({ type: "method", method: "request", payload });
    return new Promise((resolve, reject) => {
      this.events.on(`${payload.id}`, response => {
        this.logger.info("Receiving JSON-RPC Response");
        this.logger.debug({ type: "event", event: `${payload.id}`, response });
        if (response.error) {
          reject(response.error.message);
        } else {
          resolve(response.result);
        }
      });
      if (typeof this.socket === "undefined") {
        throw new Error("Socket is not connected");
      }
      this.logger.info("Outgoing JSON-RPC Payload");
      this.logger.debug({ type: "payload", direction: "outgoing", payload });
      this.socket.send(safeJsonStringify(payload));
    });
  }

  private onMessage(e: MessageEvent) {
    if (typeof e.data === "undefined") return;
    const payload = safeJsonParse(e.data) as JsonRpcPayload;
    this.logger.info("Incoming JSON-RPC Payload");
    this.logger.debug({ type: "payload", direction: "incoming", payload });
    if (isJsonRpcResponse(payload)) {
      this.events.emit(`${payload.id}`, payload);
    } else {
      this.events.emit("request", payload);
    }
  }
  // ---------- Private ----------------------------------------------- //

  private async initialize(): Promise<void> {
    this.logger.trace({ type: "init" });
  }
}
