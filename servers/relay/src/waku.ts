import { Logger } from "pino";
import { EventEmitter } from "events";
import { generateChildLogger } from "@pedrouid/pino-utils";
import {
  JsonRpcResponse,
  JsonRpcRequest,
  isJsonRpcError,
  isJsonRpcRequest,
  JsonRpcPayload,
  formatJsonRpcResult,
  formatJsonRpcRequest,
  formatJsonRpcError,
  JsonRpcResult,
} from "@json-rpc-tools/utils";
import { HttpConnection } from "@json-rpc-tools/provider";

export interface WakuPeers {
  multiaddr: string;
  protocol: string;
  connected: boolean;
}

export interface WakuMessage {
  payload: Uint8Array;
  contentTopic: number;
  version: number;
  proof: Uint8Array;
}

export class WakuService extends HttpConnection {
  public context = "waku";
  public payloads = new Map<number, JsonRpcResult>();

  constructor(public logger: Logger, nodeUrl: string) {
    super(nodeUrl);
    this.logger = generateChildLogger(logger, `${this.context}@${nodeUrl}`);
    this.initialize();
  }

  private initialize(): void {
    this.logger.trace(`Initialized`);
    this.open();
    this.on("payload", (payload: JsonRpcPayload) => {
      if (isJsonRpcError(payload)) {
        this.logger.error(payload.error);
      }
      this.logger.trace({ method: "New Payload", payload });
      this.events.emit(payload.id.toString(), payload);
    });
  }

  public async postMessage(topic: string, message: string) {
    this.logger.debug("Posting Waku Message");
    this.logger.trace({ type: "method", method: "postMessages", topic, message });
    this.send(
      formatJsonRpcRequest("post_waku_v2_relay_v1_message", [
        topic,
        {
          payload: message,
        },
      ]),
    );
  }
  public getMessages(topics: Array<string>): Promise<Array<WakuMessage>> {
    let payload = formatJsonRpcRequest("get_waku_v2_relay_v1_messages", topics);
    this.logger.debug("Getting Messages");
    this.logger.trace({ type: "method", method: "getMessages", topics });
    this.send(payload);
    return new Promise((resolve, reject) => {
      this.on(payload.id.toString(), (response: JsonRpcResponse) => {
        if (isJsonRpcError(response)) {
          this.logger.error(response.error);
          reject(response.error);
        }
        resolve((response as JsonRpcResult<Array<WakuMessage>>).result);
      });
    });
  }
  public async subscribe(topics: Array<string>) {
    let payload = formatJsonRpcRequest("post_waku_v2_relay_v1_subscriptions", [topics]);
    this.logger.debug("Subscribing to Waku Topic");
    this.logger.trace({ type: "method", method: "subscribe", topics });
    this.send(payload);
  }
  public unsubscribe(topic: string) {
    this.send(formatJsonRpcRequest("delete_waku_v2_relay_v1_subscriptions", [topic]));
  }

  public getInfo() {
    let payload = formatJsonRpcRequest("get_waku_v2_debug_v1_info", []);
    this.send(payload);
  }

  public getPeers(): Promise<Array<WakuPeers>> {
    let payload = formatJsonRpcRequest("get_waku_v2_admin_v1_peers", []);
    this.send(payload);
    return new Promise((resolve, reject) => {
      this.on(payload.id.toString(), (response: JsonRpcResponse) => {
        if (isJsonRpcError(response)) {
          reject(response.error);
        }
        resolve((response as JsonRpcResult<Array<WakuPeers>>).result);
      });
    });
  }
}
