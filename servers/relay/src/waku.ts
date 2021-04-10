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

  public async post(payload: string, topic: string) {
    let jsonPayload = formatJsonRpcRequest("post_waku_v2_relay_v1_message", [
      topic,
      {
        payload,
      },
    ]);
    this.logger.debug("Posting Waku Message");
    this.logger.trace({ type: "method", method: "postMessages", payload: jsonPayload });
    this.request(jsonPayload);
  }

  public async postContent(payload: string, contentTopic: string) {
    let jsonPayload = formatJsonRpcRequest("post_waku_v2_relay_v1_message", [
      this.namespace,
      {
        payload,
        contentTopic,
      },
    ]);
    this.logger.debug("Posting Content Waku Message");
    this.logger.trace({ type: "method", method: "postMessages", payload: jsonPayload });
    this.request(jsonPayload);
  }

  public getContentMessages(content: string, cb: IMessageCB) {
    let payload = formatJsonRpcRequest("get_waku_v2_filter_v1_messages", [content]);
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

  public async contentSubscribe(contentFilters: string, cb?: (err?: JsonRpcError) => void) {
    let payload = formatJsonRpcRequest("post_waku_v2_filter_v1_subscription", [
      [{ topics: [contentFilters] }],
      this.namespace,
    ]);
    this.logger.debug("Subscribing to Waku ContentTopic");
    this.logger.trace({ type: "method", method: "contentSubscribe", payload });
    this.request(payload);
    this.once(payload.id.toString(), (response: JsonRpcResponse) => {
      if (cb) isJsonRpcError(response) ? cb(response) : cb();
    });
  }

  public subscribe(topic = config.wcTopic, cb?: IJsonRpcCB) {
    let payload = formatJsonRpcRequest("post_waku_v2_relay_v1_subscriptions", [[topic]]);
    this.logger.debug("Subscribing to Waku Topic");
    this.logger.trace({ type: "method", method: "subscribe", payload });
    this.request(payload);
    this.once(payload.id.toString(), (response: JsonRpcResponse) => {
      if (cb) isJsonRpcError(response) ? cb(response) : cb(response as JsonRpcResult);
    });
  }

  public contentUnsubscribe(topic: string) {
    this.request(formatJsonRpcRequest("delete_waku_v2_filter_v1_subscriptions", [topic]));
    this.topics = this.topics.filter(t => t !== topic);
  }

  public unsubscribe(topic: string) {
    this.request(formatJsonRpcRequest("delete_waku_v2_relay_v1_subscriptions", [topic]));
    this.topics = this.topics.filter(t => t !== topic);
  }

  public getStoreMessages(contentTopic: string, cb: IMessageCB) {
    let pagingOptions: PagingOptions = {
      pageSize: 10,
      forward: true,
    };
    const payload = formatJsonRpcRequest("get_waku_v2_store_v1_messages", [
      [contentTopic],
      //pagingOptions,
    ]);

    this.request(payload);
    this.once(payload.id.toString(), (response: JsonRpcResponse) => {
      isJsonRpcError(response)
        ? cb(response as JsonRpcError, [])
        : cb(undefined, this.parseWakuMessages(response));
    });
  }

  public async onNewTopicMessage(topic: string, cb: IMessageCB) {
    this.subscribe(topic, response => {
      if (isJsonRpcError(response)) cb(response as JsonRpcError, []);
      this.topics.push(topic);
      this.events.on(topic, (messages: WakuMessage[]) => {
        cb(undefined, messages);
      });
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
  public debug(cb: (err: JsonRpcError | undefined, p: string[]) => void) {
    let payload = formatJsonRpcRequest("get_waku_v2_debug_v1_info", []);
    this.request(payload);
    this.once(payload.id.toString(), (response: JsonRpcResponse) => {
      isJsonRpcResult(response)
        ? cb(undefined, (response as JsonRpcResult<string[]>).result)
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
    //this.subscribe(config.wcTopic, () => {});
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

  private async request(payload: JsonRpcPayload): Promise<void> {
    return this.send(payload).catch(e => {
      this.events.emit("error", e);
      throw e;
    });
  }

  private poll() {
    this.topics.forEach(topic => {
      this.getMessages(topic, (err, messages) => {
        if (err) {
          this.logger.error(err);
          this.events.emit("error", err);
          this.events.emit(topic, err);
        }
        if (messages && messages.length) {
          this.logger.trace({ method: "poll", messages: messages });
          this.events.emit(topic, messages);
        }
      });
    });
  }
  private pollContent() {
    this.topics.forEach(topic => {
      this.getMessages(topic, (err, messages) => {
        if (err) {
          this.logger.error(err);
          this.events.emit("error", err);
          this.events.emit(topic, err);
        }
        if (messages && messages.length) {
          this.logger.trace({ method: "poll", messages: messages });
          this.events.emit(topic, messages);
        }
      });
    });
  }
}
