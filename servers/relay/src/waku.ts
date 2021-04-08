import { Logger } from "pino";
import { generateChildLogger } from "@pedrouid/pino-utils";
import {
  JsonRpcResponse,
  JsonRpcError,
  isJsonRpcError,
  JsonRpcPayload,
  formatJsonRpcRequest,
  JsonRpcResult,
  isJsonRpcResult,
} from "@json-rpc-tools/utils";
import { HttpConnection } from "@json-rpc-tools/provider";
import { arrayToHex } from "enc-utils";

import config from "./config";
import {
  IJsonRpcCB,
  IMessageCB,
  WakuMessageResponse,
  WakuMessage,
  WakuPeers,
  PagingOptions,
} from "./types";

export class WakuService extends HttpConnection {
  public context = "waku";
  public topics: string[] = [];
  public logger: Logger;
  public namespace = config.wcTopic;

  constructor(logger: Logger, nodeUrl: string) {
    super(nodeUrl);
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
    this.request(jsonPayload);
  }

  public getContentMessages(topic: number, cb: IMessageCB) {
    let payload = formatJsonRpcRequest("get_waku_v2_filter_v1_messages", [topic]);
    this.logger.debug("Getting Content Messages");
    this.logger.trace({ type: "method", method: "getContentMessages", payload });
    this.request(payload);
    this.once(payload.id.toString(), (response: JsonRpcResponse) => {
      isJsonRpcResult(response)
        ? cb(undefined, this.parseWakuMessages(response))
        : cb(response as JsonRpcError, []);
    });
  }

  public getMessages(topic: string, cb: IMessageCB) {
    let payload = formatJsonRpcRequest("get_waku_v2_relay_v1_messages", [topic]);
    this.logger.debug("Getting Messages");
    this.logger.trace({ type: "method", method: "getMessages", payload });
    this.request(payload);
    this.once(payload.id.toString(), (response: JsonRpcResponse) => {
      isJsonRpcResult(response)
        ? cb(undefined, this.parseWakuMessages(response))
        : cb(response as JsonRpcError, []);
    });
  }

  public async contentSubscribe(contentFilters: number, cb: (err?: JsonRpcError) => void) {
    let payload = formatJsonRpcRequest("post_waku_v2_filter_v1_subscription", [
      [{ topics: [contentFilters] }],
      this.namespace,
    ]);
    this.logger.debug("Subscribing to Waku ContentTopic");
    this.logger.trace({ type: "method", method: "contentSubscribe", payload });
    this.request(payload);
    this.once(payload.id.toString(), (response: JsonRpcResponse) => {
      isJsonRpcError(response) ? cb(response) : cb();
    });
  }

  public subscribe(topic: string, cb: IJsonRpcCB) {
    let payload = formatJsonRpcRequest("post_waku_v2_relay_v1_subscriptions", [[topic]]);
    this.logger.debug("Subscribing to Waku Topic");
    this.logger.trace({ type: "method", method: "subscribe", payload });
    this.request(payload);
    this.once(payload.id.toString(), (response: JsonRpcResponse) => {
      isJsonRpcError(response) ? cb(response) : cb(response as JsonRpcResult);
    });
  }

  public unsubscribe(topic: string) {
    this.request(formatJsonRpcRequest("delete_waku_v2_relay_v1_subscriptions", [topic]));
    this.topics = this.topics.filter(t => t !== topic);
  }

  // This won't work until the contenTopic is a string:
  // https://github.com/status-im/nim-waku/issues/447
  public getStoreMessages(topic: string) {
    let pagingOptions: PagingOptions = {
      pageSize: 10,
      forward: true,
    };
    this.request(formatJsonRpcRequest("get_waku_v2_store_v1_message", [[0], [pagingOptions]]));
  }

  public async onNewTopicMessage(topic: string, cb: IMessageCB) {
    this.subscribe(topic, result => {
      if (isJsonRpcError(result)) cb(result as JsonRpcError, []);
      this.topics.push(topic);
      this.events.on(topic, cb);
    });
  }

  public getPeers(cb: (err: JsonRpcError | undefined, p: WakuPeers[]) => void) {
    let payload = formatJsonRpcRequest("get_waku_v2_admin_v1_peers", []);
    this.request(payload);
    this.once(payload.id.toString(), (response: JsonRpcResponse) => {
      isJsonRpcResult(response)
        ? cb(undefined, (response as JsonRpcResult<WakuPeers[]>).result)
        : cb(response as JsonRpcError, []);
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
    setInterval(() => this.poll(), 200);
  }

  private parseWakuMessages(result: JsonRpcResult<WakuMessageResponse[]>): WakuMessage[] {
    let messages: WakuMessage[] = [];
    result.result.forEach(m => {
      messages.push({
        payload: arrayToHex(m.payload),
        contentTopic: m.contentTopic,
        version: m.version,
        proof: m.proof,
      });
    });
    return messages;
  }

  private request(payload: JsonRpcPayload): Promise<void> {
    return this.send(payload).catch(e => {
      console.log("SUP");
      this.events.emit("error", e);
      throw e;
    });
  }

  private poll() {
    this.logger.trace({ method: "poll", topics: this.topics });
    this.topics.forEach(topic => {
      this.getMessages(topic, (err, messages) => {
        if (err) {
          this.events.emit("error", err);
          throw e;
        }
        if (messages && messages.length) {
          this.logger.trace({ method: "poll", messages: messages });
          this.events.emit(topic, messages);
        }
      });
    });
  }
}
