import { Logger } from "pino";
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

interface ListenCallback {
  (messages: WakuMessage[]): void;
}

export class WakuService extends HttpConnection {
  public context = "waku";
  public namespace: string;
  public topics: string[] = [];

  constructor(public logger: Logger, nodeUrl: string, namespace = config.wcTopic) {
    super(nodeUrl);
    this.namespace = namespace;
    this.logger = generateChildLogger(logger, `${this.context}@${nodeUrl}`);
    this.initialize();
  }

  public async postMessage(payload: string, topic: string, contentTopic?: number) {
    let jsonPayload = formatJsonRpcRequest("post_waku_v2_relay_v1_message", [
      topic,
      {
        payload,
        contentTopic,
      },
    ]);
    this.logger.debug("Posting Waku Message");
    this.logger.trace({ type: "method", method: "postMessages", payload: jsonPayload });
    this.send(jsonPayload);
  }

  public getContentMessages(topic: number): Promise<WakuMessage[]> {
    let payload = formatJsonRpcRequest("get_waku_v2_filter_v1_messages", [topic]);
    this.logger.debug("Getting Content Messages");
    this.logger.trace({ type: "method", method: "getContentMessages", payload });
    this.send(payload);
    return new Promise((resolve, reject) => {
      this.once(payload.id.toString(), (response: JsonRpcResponse) => {
        if (isJsonRpcError(response)) {
          reject(response.error);
        }
        resolve((response as JsonRpcResult<WakuMessage[]>).result);
      });
    });
  }

  public getMessages(topic: string): Promise<WakuMessage[]> {
    let payload = formatJsonRpcRequest("get_waku_v2_relay_v1_messages", [topic]);
    this.logger.debug("Getting Messages");
    this.logger.trace({ type: "method", method: "getMessages", payload });
    this.send(payload);
    return new Promise((resolve, reject) => {
      this.once(payload.id.toString(), (response: JsonRpcResponse) => {
        if (isJsonRpcError(response)) {
          reject(response.error);
        }
        resolve((response as JsonRpcResult<WakuMessage[]>).result);
      });
    });
  }

  public async contentSubscribe(contentFilters: number) {
    let payload = formatJsonRpcRequest("post_waku_v2_filter_v1_subscription", [
      [{ topics: [contentFilters] }],
      this.namespace,
    ]);
    this.logger.debug("Subscribing to Waku ContentTopic");
    this.logger.trace({ type: "method", method: "contentSubscribe", payload });
    this.send(payload);
  }

  public subscribe(topic: string): Promise<void> {
    let payload = formatJsonRpcRequest("post_waku_v2_relay_v1_subscriptions", [[topic]]);
    this.logger.debug("Subscribing to Waku Topic");
    this.logger.trace({ type: "method", method: "subscribe", payload });
    this.send(payload);
    return new Promise((resolve, reject) => {
      this.once(payload.id.toString(), (response: JsonRpcResponse) => {
        if (isJsonRpcError(response)) {
          reject(response.error);
        }
        resolve();
      });
    });
  }

  public unsubscribe(topic: string) {
    this.send(formatJsonRpcRequest("delete_waku_v2_relay_v1_subscriptions", [topic]));
    this.topics = this.topics.filter(t => t !== topic);
  }

  public async onNewTopicMessage(topic: string, cb: ListenCallback) {
    this.subscribe(topic).then(() => {
      this.topics.push(topic);
      this.events.on(topic, cb);
    });
  }

  public getPeers(): Promise<WakuPeers[]> {
    let payload = formatJsonRpcRequest("get_waku_v2_admin_v1_peers", []);
    this.send(payload);
    return new Promise((resolve, reject) => {
      this.once(payload.id.toString(), (response: JsonRpcResponse) => {
        if (isJsonRpcError(response)) {
          reject(response.error);
        }
        resolve((response as JsonRpcResult<WakuPeers[]>).result);
      });
    });
  }

  // ---------- Private ----------------------------------------------- //

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
    setInterval(() => this.poll(), 500);
  }

  private poll() {
    this.logger.debug("Polling all topics for messages");
    this.logger.trace({ method: "poll", topics: this.topics });
    this.topics.forEach(async t => {
      try {
        let messages = await this.getMessages(t);
        if (messages && messages.length) {
          this.logger.trace({ method: "poll", messages: messages });
          this.events.emit(t, messages as WakuMessage[]);
        }
      } catch (e) {
        throw e;
      }
    });
  }
}
