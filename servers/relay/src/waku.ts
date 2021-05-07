import EventEmitter from "events";
import { Logger } from "pino";
import { generateChildLogger } from "@pedrouid/pino-utils";
import {
  JsonRpcResponse,
  isJsonRpcError,
  JsonRpcPayload,
  IJsonRpcProvider,
} from "@json-rpc-tools/utils";
import { JsonRpcProvider } from "@json-rpc-tools/provider";
import { arrayToHex } from "enc-utils";

import { PagingOptions, IWakuCB, WakuMessageResponse, WakuMessage } from "./types";
import {
  WAKU_JSONRPC,
  WAKU_POLLING_INTERVAL,
  WAKU_DEFAULT_PAGE_SIZE,
  WAKU_CONTEXT,
  WAKU_PUBSUB_TOPIC,
} from "./constants";

export class WakuService {
  public events = new EventEmitter();
  public context = WAKU_CONTEXT;
  public topics: string[] = [];
  public logger: Logger;
  public namespace = WAKU_PUBSUB_TOPIC;

  public provider: IJsonRpcProvider;

  constructor(logger: Logger, nodeUrl: string) {
    this.provider = new JsonRpcProvider(nodeUrl);
    this.logger = generateChildLogger(logger, this.context);
    this.initialize();
  }

  public async post(payload: string, contentTopic: string, topic = this.namespace) {
    const method = WAKU_JSONRPC.post.relay.message;
    const params = [
      topic,
      {
        payload,
        contentTopic,
      },
    ];
    this.logger.info("Posting Waku Message");
    this.logger.debug({ type: "method", method: "post", payload: { method, params } });
    await this.provider.request({ method, params });
  }

  public getFilterMessages(filter: string, cb: IWakuCB.Message) {
    const method = WAKU_JSONRPC.get.filter.messages;
    const params = [filter];
    this.provider
      .request({ method, params })
      .then(result => cb && cb(undefined, result))
      .catch(e => cb && cb(e, undefined));
  }

  public getMessages(topic: string, cb: IWakuCB.Message) {
    const method = WAKU_JSONRPC.get.relay.messages;
    const params = [topic];
    this.provider
      .request({ method, params })
      .then(result => cb && cb(undefined, result))
      .catch(e => cb && cb(e, undefined));
  }

  public async subscribe(topic: string, cb?: IWakuCB.Rpc) {
    const method = WAKU_JSONRPC.post.filter.subscription;
    const params = [[{ contentTopics: [topic] }], this.namespace];
    this.provider
      .request({ method, params })
      .then(result => cb && cb(undefined, result))
      .catch(e => cb && cb(e, undefined));
  }

  public unsubscribe(topic: string) {
    const method = WAKU_JSONRPC.delete.filter.subscription;
    const params = [[{ contentTopics: [topic] }]];
    this.provider.request({ method, params });
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
      const { pagingOptions, messages } = await this.provider.request({ method, params });
      if (pagingOptions?.pageSize == 0 || !pagingOptions) return messages;
      (await recursiveStoreCall(pagingOptions)).forEach(m => messages.push(m));
      return messages;
    };

    recursiveStoreCall().then((messages: WakuMessageResponse[]) => {
      cb(undefined, this.parseWakuMessagePayload(messages));
    });
  }

  public async onNewFilterMessage(topic: string, cb: IWakuCB.Message) {
    this.subscribe(topic, response => {
      this.onnew(topic, response, cb);
      this.topics.push(topic);
    });
  }

  public getPeers(cb: IWakuCB.Peers) {
    const method = WAKU_JSONRPC.get.admin.peers;
    this.provider
      .request({ method })
      .then(result => cb(undefined, result))
      .catch(e => cb(e, undefined));
  }

  public debug(cb: IWakuCB.Info) {
    const method = WAKU_JSONRPC.get.debug.info;
    this.provider
      .request({ method })
      .then(result => cb(undefined, result))
      .catch(e => cb(e, undefined));
  }

  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.provider.connect();
    this.registerNamespace();
    setInterval(() => this.poll(), WAKU_POLLING_INTERVAL);
    this.logger.trace(`Initialized`);
  }

  public registerNamespace() {
    const method = WAKU_JSONRPC.post.relay.subscriptions;
    const topic = this.namespace;
    const params = [[topic]];
    this.provider.request({ method, params });
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

  private onnew(topic: string, response: JsonRpcResponse | undefined, cb: IWakuCB.Message) {
    if (response && isJsonRpcError(response)) cb(response, []);
    this.events.on(topic, (messages: WakuMessage[]) => cb(undefined, messages));
  }

  private poll() {
    this.topics.forEach(filter => {
      this.getFilterMessages(filter, (err, messages?: WakuMessage[]) => {
        if (err && err.error.data === `Not subscribed to content topic: ${filter}`) {
          this.subscribe(filter);
        }
        if (messages && messages.length) {
          this.logger.trace({ method: "pollFilterTopic", messages: messages });
          this.events.emit(filter, messages);
        }
      });
    });
  }
}
