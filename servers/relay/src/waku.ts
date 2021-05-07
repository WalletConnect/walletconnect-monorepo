import { Logger } from "pino";
import { generateChildLogger } from "@pedrouid/pino-utils";
import {
  JsonRpcResponse,
  isJsonRpcError,
  JsonRpcPayload,
  formatJsonRpcRequest,
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
import { WAKU_JSONRPC, WAKU_POLLING_INTERVAL, WAKU_DEFAULT_PAGE_SIZE } from "./constants";

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
    const method = WAKU_JSONRPC.post.relay.message;
    const jsonPayload = formatJsonRpcRequest(method, [
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
    const method = WAKU_JSONRPC.get.filter.messages;
    this.get(formatJsonRpcRequest(method, [filter]), cb);
  }

  public getMessages(topic: string, cb: IWakuCB.Message) {
    const method = WAKU_JSONRPC.get.relay.messages;
    this.get(formatJsonRpcRequest(method, [topic]), cb);
  }

  public async filterSubscribe(filter: string, cb?: IWakuCB.Rpc) {
    const method = WAKU_JSONRPC.post.filter.subscription;
    this.sub(formatJsonRpcRequest(method, [[{ contentTopics: [filter] }], this.namespace]), cb);
  }

  public subscribe(topic = this.namespace, cb?: IWakuCB.Rpc) {
    const method = WAKU_JSONRPC.post.relay.subscriptions;
    this.sub(formatJsonRpcRequest(method, [[topic]]), cb);
  }

  public filterUnsubscribe(filterTopic: string) {
    const method = WAKU_JSONRPC.delete.filter.subscription;
    this.unsub(formatJsonRpcRequest(method, [[{ contentTopics: [filterTopic] }]]));
    this.filterTopics = this.filterTopics.filter(t => t !== filterTopic);
  }

  public unsubscribe(topic: string) {
    const method = WAKU_JSONRPC.delete.relay.subscription;
    this.unsub(formatJsonRpcRequest(method, [[topic]]));
    this.topics = this.topics.filter(t => t !== topic);
  }

  public getStoreMessages(contentTopic: string, cb: IWakuCB.Message) {
    const recursiveStoreCall = async (
      currentCursor: PagingOptions = {
        pageSize: WAKU_DEFAULT_PAGE_SIZE,
        forward: true,
      },
    ): Promise<WakuMessageResponse[]> => {
      const method = WAKU_JSONRPC.get.store.messages;
      const params = currentCursor
        ? [this.namespace, [{ contentTopic }], currentCursor]
        : [this.namespace, [{ contentTopic }]];
      const payload = formatJsonRpcRequest(method, params);
      await this.send(payload);
      const { pagingOptions, messages } = await new Promise<StoreResponse>(resolve => {
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
    const method = WAKU_JSONRPC.get.admin.peers;
    const payload = formatJsonRpcRequest(method, []);
    this.send(payload);
    this.once(payload.id.toString(), (response: JsonRpcResponse) => {
      isJsonRpcError(response) ? cb(response, []) : cb(undefined, response.result);
    });
  }

  public debug(cb: IWakuCB.Info) {
    const method = WAKU_JSONRPC.get.debug.info;
    const payload = formatJsonRpcRequest(method, []);
    this.send(payload);
    this.once(payload.id.toString(), (response: JsonRpcResponse) => {
      isJsonRpcError(response) ? cb(response, {} as WakuInfo) : cb(undefined, response.result);
    });
  }

  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.open().catch(this.logger.error);
    this.on("payload", (payload: JsonRpcPayload) => {
      if (isJsonRpcError(payload)) this.logger.error(payload.error);
      this.logger.trace({ method: "New Response Payload", payload });
      this.events.emit(payload.id.toString(), payload);
    });
    this.subscribe(this.namespace);
    setInterval(() => this.poll(), WAKU_POLLING_INTERVAL);
    this.logger.trace(`Initialized`);
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
    this.logger.debug("Subscribing to topic");
    this.logger.debug({ type: "method", method: "sub", request });
    this.send(request);
    this.once(request.id.toString(), (response: JsonRpcResponse) => {
      if (cb) isJsonRpcError(response) ? cb(response, false) : cb(undefined, response.result);
    });
  }

  private unsub(request: JsonRpcRequest) {
    this.logger.debug(`Unsubscribe from topic`);
    this.logger.trace({ type: "method", method: "unsub", request });
    this.send(request);
  }

  private onnew(topic: string, response: JsonRpcResponse | undefined, cb: IWakuCB.Message) {
    if (response && isJsonRpcError(response)) cb(response, []);
    this.on(topic, (messages: WakuMessage[]) => cb(undefined, messages));
  }

  private poll() {
    this.filterTopics.forEach(filter => {
      this.getFilterMessages(filter, (err, messages: WakuMessage[]) => {
        if (err && err.error.data === `Not subscribed to content topic: ${filter}`) {
          this.filterSubscribe(filter);
        }
        if (messages.length) {
          this.logger.trace({ method: "pollFilterTopic", messages: messages });
          this.events.emit(filter, messages);
        }
      });
    });
  }
}
