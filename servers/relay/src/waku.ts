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
  WakuInfo,
  IInfoCB,
  IPeersCB,
  IJsonRpcCB,
  IMessageCB,
  WakuMessageResponse,
  WakuMessage,
  WakuPeers,
} from "./types";

export class WakuService extends HttpConnection {
  public context = "waku";
  public topics: string[] = [];
  public filterTopics: string[] = [];
  public logger: Logger;
  public namespace = config.wcTopic;

  constructor(logger: Logger, nodeUrl: string) {
    super(nodeUrl);
    this.logger = generateChildLogger(logger, `${this.context}@${nodeUrl}`);
    this.initialize();
  }

  public async post(payload: string, contentTopic: string, topic = this.namespace) {
    let jsonPayload = formatJsonRpcRequest("post_waku_v2_relay_v1_message", [
      topic,
      {
        payload,
        contentTopic,
      },
    ]);
    this.logger.debug("Posting Waku Message");
    this.logger.trace({ type: "method", method: "post", payload: jsonPayload });
    this.request(jsonPayload);
  }

  public getFilterMessages(filter: string, cb: IMessageCB) {
    let payload = formatJsonRpcRequest("get_waku_v2_filter_v1_messages", [filter]);
    this.logger.trace("Getting FilterTopic Messages");
    this.logger.trace({ type: "method", method: "getFilterTopicMessages", payload });
    this.request(payload);
    this.once(payload.id.toString(), (response: JsonRpcResponse) => {
      isJsonRpcError(response)
        ? cb(response, [])
        : cb(undefined, this.parseWakuMessagePayload(response));
    });
  }

  public getMessages(topic: string, cb: IMessageCB) {
    let payload = formatJsonRpcRequest("get_waku_v2_relay_v1_messages", [topic]);
    this.logger.debug("Getting Messages");
    this.logger.trace({ type: "method", method: "getMessages", payload });
    this.request(payload);
    this.once(payload.id.toString(), (response: JsonRpcResponse) => {
      isJsonRpcError(response)
        ? cb(response, [])
        : cb(undefined, this.parseWakuMessagePayload(response));
    });
  }

  public async filterSubscribe(filter: string, cb?: IJsonRpcCB) {
    let payload = formatJsonRpcRequest("post_waku_v2_filter_v1_subscription", [
      [{ topics: [filter] }],
      this.namespace,
    ]);
    this.logger.debug("Subscribing to Waku FilterTopicTopic");
    this.logger.debug({ type: "method", method: "filterSubscribe", payload });
    this.request(payload);
    this.once(payload.id.toString(), (response: JsonRpcResponse) => {
      if (cb) isJsonRpcError(response) ? cb(response, false) : cb(undefined, response.result);
    });
  }

  public subscribe(topic = this.namespace, cb?: IJsonRpcCB) {
    let payload = formatJsonRpcRequest("post_waku_v2_relay_v1_subscriptions", [[topic]]);
    this.logger.debug("Subscribing to Waku Topic");
    this.logger.trace({ type: "method", method: "subscribe", payload });
    this.request(payload);
    this.once(payload.id.toString(), (response: JsonRpcResponse) => {
      if (cb) isJsonRpcError(response) ? cb(response, false) : cb(undefined, response.result);
    });
  }

  public filterUnsubscribe(filterTopic: string) {
    this.request(
      formatJsonRpcRequest("delete_waku_v2_filter_v1_subscription", [[{ topics: [filterTopic] }]]),
    );
    this.filterTopics = this.filterTopics.filter(t => t !== filterTopic);
  }

  public unsubscribe(topic: string) {
    this.request(formatJsonRpcRequest("delete_waku_v2_relay_v1_subscription", [[topic]]));
    this.topics = this.topics.filter(t => t !== topic);
  }

  public async onNewFilterMessage(filterTopic: string, cb: IMessageCB) {
    this.filterSubscribe(filterTopic, response => {
      if (response && isJsonRpcError(response)) cb(response as JsonRpcError, []);
      this.filterTopics.push(filterTopic);
      this.events.on(filterTopic, (messages: WakuMessage[]) => {
        cb(undefined, messages);
      });
    });
  }

  public async onNewMessage(topic: string, cb: IMessageCB) {
    this.subscribe(topic, response => {
      if (response && isJsonRpcError(response)) cb(response as JsonRpcError, []);
      this.topics.push(topic);
      this.events.on(topic, (messages: WakuMessage[]) => {
        cb(undefined, messages);
      });
    });
  }

  public getPeers(cb: IPeersCB) {
    let payload = formatJsonRpcRequest("get_waku_v2_admin_v1_peers", []);
    this.request(payload);
    this.once(payload.id.toString(), (response: JsonRpcResponse) => {
      isJsonRpcError(response) ? cb(response, []) : cb(undefined, response.result);
    });
  }

  public debug(cb: IInfoCB) {
    let payload = formatJsonRpcRequest("get_waku_v2_debug_v1_info", []);
    this.request(payload);
    this.once(payload.id.toString(), (response: JsonRpcResponse) => {
      isJsonRpcError(response) ? cb(response, {} as WakuInfo) : cb(undefined, response.result);
    });
  }

  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.logger.trace(`Initialized`);
    this.open().catch(this.logger.error);
    this.on("payload", (payload: JsonRpcPayload) => {
      if (isJsonRpcError(payload)) {
        this.logger.error(payload.error);
      }
      this.logger.trace({ method: "New Response Payload", payload });
      this.events.emit(payload.id.toString(), payload);
    });
    this.subscribe(this.namespace);
    setInterval(() => this.poll(), 200);
  }

  private parseWakuMessagePayload(payload: JsonRpcResult<WakuMessageResponse[]>): WakuMessage[] {
    const messages: WakuMessage[] = [];
    const seenMessages = new Set();
    payload.result.forEach(m => {
      const stringPayload = arrayToHex(m.payload);
      if (!seenMessages.has(stringPayload)) {
        seenMessages.add(stringPayload);
        messages.push({
          payload: stringPayload,
          contentTopic: m.contentTopic,
          version: m.version,
          proof: m.proof,
          timestamp: m.timestamp,
        });
      }
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
    this.filterTopics.forEach(filterTopic => {
      this.getFilterMessages(
        filterTopic,
        (err: JsonRpcError | undefined, messages: WakuMessage[]) => {
          if (err) {
            this.logger.error(err);
            this.events.emit("error", err);
            this.events.emit(filterTopic, err);
          }
          if (messages.length) {
            this.logger.trace({ method: "pollFilterTopic", messages: messages });
            this.events.emit(filterTopic, messages);
          }
        },
      );
    });
  }
}
