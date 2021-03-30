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
import { hexToNumber } from "enc-utils";

import config from "./config";
import { WakuMessage, WakuPeers } from "./types";

export class WakuService extends HttpConnection {
  public context = "waku";
  public payloads = new Map<number, JsonRpcResult>();
  public topic: string;

  constructor(public logger: Logger, nodeUrl: string, topic = config.wcTopic) {
    super(nodeUrl);
    this.topic = topic;
    this.logger = generateChildLogger(logger, `${this.context}@${nodeUrl}`);
    this.initialize();
  }

  private initialize(): void {
    this.logger.trace(`Initialized`);
    this.open().catch(console.error);
    this.on("payload", (payload: JsonRpcPayload) => {
      if (isJsonRpcError(payload)) {
        this.logger.error(payload.error);
      }
      this.logger.trace({ method: "New Response Payload", payload });
      this.events.emit(payload.id.toString(), payload);
    });
    this.subscribe(this.topic);
  }

  public async postMessage(payload: string, contentTopic?: number) {
    let jsonPayload = formatJsonRpcRequest("post_waku_v2_relay_v1_message", [
      this.topic,
      {
        payload,
        contentTopic,
      },
    ]);
    this.logger.debug("Posting Waku Message");
    this.logger.trace({ type: "method", method: "postMessages", payload: jsonPayload });
    this.send(jsonPayload);
  }

  public getContentMessages(topic: number): Promise<Array<WakuMessage>> {
    let payload = formatJsonRpcRequest("get_waku_v2_filter_v1_messages", [topic]);
    this.logger.debug("Getting Content Messages");
    this.logger.trace({ type: "method", method: "getContentMessages", payload });
    this.send(payload);
    return new Promise((resolve, reject) => {
      this.on(payload.id.toString(), (response: JsonRpcResponse) => {
        if (isJsonRpcError(response)) {
          reject(response.error);
        }
        resolve((response as JsonRpcResult<Array<WakuMessage>>).result);
      });
    });
  }

  public getMessages(): Promise<Array<WakuMessage>> {
    let payload = formatJsonRpcRequest("get_waku_v2_relay_v1_messages", [this.topic]);
    this.logger.debug("Getting Content Messages");
    this.logger.trace({ type: "method", method: "getContentMessages", payload });
    this.send(payload);
    return new Promise((resolve, reject) => {
      this.on(payload.id.toString(), (response: JsonRpcResponse) => {
        if (isJsonRpcError(response)) {
          reject(response.error);
        }
        resolve((response as JsonRpcResult<Array<WakuMessage>>).result);
      });
    });
  }

  public async contentSubscribe(contentFilters: number) {
    let payload = formatJsonRpcRequest("post_waku_v2_filter_v1_subscription", [
      [{ topics: [contentFilters] }],
      this.topic,
    ]);
    this.logger.debug("Subscribing to Waku ContentTopic");
    this.logger.trace({ type: "method", method: "contentSubscribe", payload });
    this.send(payload);
  }

  public async subscribe(topic: string) {
    let payload = formatJsonRpcRequest("post_waku_v2_relay_v1_subscriptions", [[topic]]);
    this.logger.debug("Subscribing to Waku Topic");
    this.logger.trace({ type: "method", method: "subscribe", payload });
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
