import { Logger } from "pino";
import { generateChildLogger } from "@pedrouid/pino-utils";
import {
  JsonRpcResponse,
  JsonRpcError,
  isJsonRpcError,
  JsonRpcPayload,
  formatJsonRpcRequest,
  JsonRpcResult,
  JsonRpcRequest,
  isJsonRpcResult,
} from "@json-rpc-tools/utils";
import { HttpConnection } from "@json-rpc-tools/provider";
import { arrayToHex } from "enc-utils";

import config from "./config";
import {
  WakuInfo,
  PagingOptions,
  IWakuCB,
  StoreResponse,
  WakuMessageResponse,
  WakuMessage,
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
    const jsonPayload = formatJsonRpcRequest("post_waku_v2_relay_v1_message", [
      topic,
      {
        payload,
        contentTopic,
      },
    ]);
    this.logger.info("Posting Waku Message");
    this.logger.debug({ type: "method", method: "post", payload: jsonPayload });
    this.send(jsonPayload);
  }

  public getFilterMessages(filter: string, cb: IWakuCB.Message) {
    this.get(formatJsonRpcRequest("get_waku_v2_filter_v1_messages", [filter]), cb);
  }

  public getMessages(topic: string, cb: IWakuCB.Message) {
    this.get(formatJsonRpcRequest("get_waku_v2_relay_v1_messages", [topic]), cb);
  }

  public async filterSubscribe(filter: string, cb?: IWakuCB.Rpc) {
    this.sub(
      formatJsonRpcRequest("post_waku_v2_filter_v1_subscription", [
        [{ contentTopics: [filter] }],
        this.namespace,
      ]),
      cb,
    );
  }

  public subscribe(topic = this.namespace, cb?: IWakuCB.Rpc) {
    this.sub(formatJsonRpcRequest("post_waku_v2_relay_v1_subscriptions", [[topic]]), cb);
  }

  public filterUnsubscribe(filterTopic: string) {
    this.unsub(
      formatJsonRpcRequest("delete_waku_v2_filter_v1_subscription", [
        [{ contentTopics: [filterTopic] }],
      ]),
    );
    this.filterTopics = this.filterTopics.filter(t => t !== filterTopic);
  }

  public unsubscribe(topic: string) {
    this.unsub(formatJsonRpcRequest("delete_waku_v2_relay_v1_subscription", [[topic]]));
    this.topics = this.topics.filter(t => t !== topic);
  }

  public getStoreMessages(contentTopic: string, cb: IWakuCB.Message) {
    const recursiveStoreCall = async (
      currentCursor: PagingOptions = {
        pageSize: 100,
        forward: true,
      },
    ): Promise<WakuMessageResponse[]> => {
      const payload = currentCursor
        ? formatJsonRpcRequest("get_waku_v2_store_v1_messages", [[{ contentTopic }], currentCursor])
        : formatJsonRpcRequest("get_waku_v2_store_v1_messages", [[{ contentTopic }]]);
      await this.send(payload);
      let { pagingOptions, messages } = await new Promise<StoreResponse>(resolve => {
        this.once(payload.id.toString(), (response: JsonRpcResponse) => {
          if (isJsonRpcResult(response)) resolve(response.result as StoreResponse);
          if (isJsonRpcError(response)) cb(response, []);
        });
      });
      if (pagingOptions?.pageSize == 0 || !pagingOptions) return messages;
      (await recursiveStoreCall(pagingOptions)).forEach(m => messages.push(m));
      return messages;
    };

    recursiveStoreCall().then((messages: WakuMessageResponse[]) => {
      cb(undefined, this.parseWakuMessagePayload(messages));
    });
  }

  public async onNewFilterMessage(filterTopic: string, cb: IWakuCB.Message) {
    this.filterSubscribe(filterTopic, response => {
      this.onnew(filterTopic, response, cb);
      this.filterTopics.push(filterTopic);
    });
  }

  public async onNewMessage(topic: string, cb: IWakuCB.Message) {
    this.subscribe(topic, response => {
      this.onnew(topic, response, cb);
      this.topics.push(topic);
    });
  }

  public getPeers(cb: IWakuCB.Peers) {
    const payload = formatJsonRpcRequest("get_waku_v2_admin_v1_peers", []);
    this.send(payload);
    this.once(payload.id.toString(), (response: JsonRpcResponse) => {
      isJsonRpcError(response) ? cb(response, []) : cb(undefined, response.result);
    });
  }

  public debug(cb: IWakuCB.Info) {
    const payload = formatJsonRpcRequest("get_waku_v2_debug_v1_info", []);
    this.send(payload);
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

  private parseWakuMessagePayload(payload: WakuMessageResponse[]): WakuMessage[] {
    const messages: WakuMessage[] = [];
    const seenMessages = new Set();
    payload.forEach(m => {
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

  private get(request: JsonRpcRequest, cb: IWakuCB.Message) {
    this.logger.trace("Getting Messages");
    this.logger.trace({ type: "method", method: "get", request });
    this.send(request);
    this.once(request.id.toString(), (response: JsonRpcResponse) => {
      isJsonRpcError(response)
        ? cb(response, [])
        : cb(undefined, this.parseWakuMessagePayload(response.result as WakuMessageResponse[]));
    });
  }

  private sub(request: JsonRpcRequest, cb?: IWakuCB.Rpc) {
    this.logger.debug("Subscribing to Waku");
    this.logger.debug({ type: "method", method: "filterSubscribe", request });
    this.send(request);
    this.once(request.id.toString(), (response: JsonRpcResponse) => {
      if (cb) isJsonRpcError(response) ? cb(response, false) : cb(undefined, response.result);
    });
  }

  private unsub(request: JsonRpcRequest) {
    this.logger.debug("Subscribing to Waku");
    this.logger.trace({ type: "method", method: "unsub", request });
    this.send(request);
  }

  private onnew(topic: string, response: JsonRpcResponse | undefined, cb: IWakuCB.Message) {
    if (response && isJsonRpcError(response)) cb(response, []);
    this.on(topic, (messages: WakuMessage[]) => cb(undefined, messages));
  }

  private poll() {
    // SHould the filterTopics list be removed once the subscription is also removed?
    // I think it should
    this.filterTopics.forEach(filterTopic => {
      this.getFilterMessages(filterTopic, (err, messages: WakuMessage[]) => {
        if (err && err.error.data === `Not subscribed to content topic: ${filterTopic}`) {
          this.filterSubscribe(filterTopic);
        }
        if (messages.length) {
          this.logger.trace({ method: "pollFilterTopic", messages: messages });
          this.events.emit(filterTopic, messages);
        }
      });
    });
  }
}
