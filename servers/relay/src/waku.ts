import EventEmitter from "events";
import { Logger } from "pino";
import { generateChildLogger } from "@pedrouid/pino-utils";
import { IJsonRpcProvider, IEvents } from "@json-rpc-tools/utils";
import { JsonRpcProvider } from "@json-rpc-tools/provider";
import { arrayToHex } from "enc-utils";

import { PagingOptions, WakuMessagesResult, WakuMessage } from "./types";
import {
  WAKU_JSONRPC,
  WAKU_POLLING_INTERVAL,
  WAKU_DEFAULT_PAGE_SIZE,
  WAKU_CONTEXT,
  WAKU_PUBSUB_TOPIC,
} from "./constants";

export class WakuService extends IEvents {
  public events = new EventEmitter();
  public context = WAKU_CONTEXT;
  public topics: string[] = [];
  public logger: Logger;
  public namespace = WAKU_PUBSUB_TOPIC;

  public provider: IJsonRpcProvider;

  constructor(logger: Logger, nodeUrl: string) {
    super();
    this.provider = new JsonRpcProvider(nodeUrl);
    this.logger = generateChildLogger(logger, this.context);
    this.initialize();
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

  public removeListener(event: string, listener: any): void {
    this.events.removeListener(event, listener);
  }

  public async post(payload: string, topic: string) {
    const method = WAKU_JSONRPC.post.relay.message;
    const params = [
      this.namespace,
      {
        payload,
        contentTopic: topic,
      },
    ];
    this.logger.info("Posting Waku Message");
    this.logger.debug({ type: "method", method: "post", payload: { method, params } });
    await this.provider.request({ method, params });
  }

  public async getMessages(topic: string) {
    const method = WAKU_JSONRPC.get.filter.messages;
    const params = [topic];
    const result = await this.provider.request({ method, params });
    const messages = this.parseWakuMessageResult(result);
    this.logger.debug({ type: "method", method: "getMessages", messages });
    this.events.emit("message", { topic, messages });
  }

  public async subscribe(topic: string) {
    const method = WAKU_JSONRPC.post.filter.subscription;
    //const params = [[{ contentTopics: topic }], this.namespace];
    const params = [[{ contentTopics: [topic] }], this.namespace];
    await this.provider.request({ method, params });
    this.topics.push(topic);
    for (let i = 1; i < 5; i++) {
      setTimeout(async () => {
        const messages = await this.getStoreMessages(topic);
        this.events.emit("message", { topic, messages });
      }, i * 1500);
    }
  }

  public async unsubscribe(topic: string) {
    const method = WAKU_JSONRPC.delete.filter.subscription;
    const params = [[{ contentTopics: [topic] }]];
    await this.provider.request({ method, params });
    this.topics = this.topics.filter(t => t !== topic);
  }

  public async getStoreMessages(
    topic: string,
    pagingOptions: PagingOptions = {
      pageSize: WAKU_DEFAULT_PAGE_SIZE,
      forward: true,
    },
    messages: WakuMessage[] = [],
  ): Promise<WakuMessage[]> {
    const method = WAKU_JSONRPC.get.store.messages;
    //const params = [this.namespace, [{ contentTopic: topic }], pagingOptions];
    const params = [this.namespace, [{ contentTopic: topic }], pagingOptions];
    const result = await this.provider.request({ method, params });
    pagingOptions = result.pagingOptions;
    messages = [...messages, ...this.parseWakuMessageResult(result.messages)];
    this.logger.debug({ type: "method", method: "getStoreMessages", pagingOptions });
    this.logger.trace({ type: "messages", messages });
    if (pagingOptions?.pageSize == 0 || !pagingOptions) return messages;
    return [...messages, ...(await this.getStoreMessages(topic, pagingOptions))];
  }

  public async getPeers() {
    const method = WAKU_JSONRPC.get.admin.peers;
    await this.provider.request({ method });
  }

  public async debug() {
    const method = WAKU_JSONRPC.get.debug.info;
    await this.provider.request({ method });
  }

  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.provider.connect();
    this.registerNamespace();
    setInterval(() => this.poll(), WAKU_POLLING_INTERVAL);
    this.logger.trace(`Initialized`);
  }

  private registerNamespace() {
    const method = WAKU_JSONRPC.post.relay.subscriptions;
    const topic = this.namespace;
    const params = [[topic]];
    this.provider.request({ method, params });
  }

  private parseWakuMessageResult(result: WakuMessagesResult[]): WakuMessage[] {
    const messages: WakuMessage[] = [];
    const seenMessages = new Set();
    result.forEach(m => {
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

  private poll() {
    this.topics.forEach(topic => this.getMessages(topic));
    this.events.on("message", ({ topic, messages }) => {
      if (messages && messages.length) {
        this.logger.trace({ method: "poll", messages: messages });
        this.events.emit("message", { topic, messages });
      }
    });
  }
}
