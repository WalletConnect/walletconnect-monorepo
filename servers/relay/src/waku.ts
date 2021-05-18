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
import { HttpService } from "./http";
import { SubscriptionService } from "./subscription";

export class WakuService extends IEvents {
  public events = new EventEmitter();
  public context = WAKU_CONTEXT;
  public subscription: SubscriptionService;
  public server: HttpService;
  public logger: Logger;
  public namespace = WAKU_PUBSUB_TOPIC;
  public provider: IJsonRpcProvider | undefined;

  private manageSubs = false;

  constructor(
    server: HttpService,
    logger: Logger,
    nodeUrl: string,
    subscription: SubscriptionService,
  ) {
    super();
    this.subscription = subscription;
    this.server = server;
    this.logger = generateChildLogger(logger, this.context);
    this.provider = this.setJsonRpcProvider(nodeUrl);
    this.initialize();
  }

  get connected() {
    return this.provider?.connection.connected;
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
    if (typeof this.provider === "undefined") return;
    if (!this.connected) return;
    await this.provider.request({ method, params });
  }

  public async getMessages(topic: string): Promise<WakuMessage[]> {
    const method = WAKU_JSONRPC.get.filter.messages;
    const params = [topic];
    if (typeof this.provider === "undefined") return [];
    if (!this.connected) return [];
    const result = await this.provider.request({ method, params });
    const messages = this.parseWakuMessageResult(result);
    this.logger.trace({ type: "method", topic, method: "getMessages", messages });
    return messages;
  }

  public async subscribe(topic: string) {
    const method = WAKU_JSONRPC.post.filter.subscription;
    const params = [[{ contentTopic: topic }], this.namespace];
    this.logger.debug({ type: "method", method: "subscribe", params });
    if (typeof this.provider === "undefined") return;
    if (!this.connected) return;
    await this.provider.request({ method, params });
  }

  public async subAndGetHistorical(topic: string) {
    await this.subscribe(topic);
    setTimeout(async () => {
      const messages = await this.getStoreMessages(topic);
      this.events.emit("message", { topic, messages });
    }, WAKU_POLLING_INTERVAL);
  }

  public async unsubscribe(subscription: string) {
    const method = WAKU_JSONRPC.delete.filter.subscription;
    const params = [[{ contentTopic: subscription }]];
    if (typeof this.provider === "undefined") return;
    if (!this.connected) return;
    await this.provider.request({ method, params });
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
    const params = [this.namespace, [{ contentTopic: topic }], pagingOptions];
    if (typeof this.provider === "undefined") return [];
    if (!this.connected) return [];
    const result = await this.provider.request({ method, params });
    pagingOptions = result.pagingOptions;
    messages = [...messages, ...this.parseWakuMessageResult(result.messages)];
    this.logger.debug({ type: "method", method: "getStoreMessages", pagingOptions });
    this.logger.trace({ type: "messages", messages });
    if (pagingOptions?.pageSize == 0 || !pagingOptions) return messages;
    return [...messages, ...(await this.getStoreMessages(topic, pagingOptions))];
  }

  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.connectProvider();
    this.logger.trace(`Initialized`);
    this.logger.debug({ manageSubs: this.manageSubs });
  }

  private async connectProvider(): Promise<void> {
    if (typeof this.provider === "undefined") return;
    try {
      await this.provider.connect();
      if (!this.connected) return;
      this.registerNamespace();
      setInterval(() => this.poll(), WAKU_POLLING_INTERVAL);
    } catch (e) {
      console.error(e); // eslint-disable-line
      this.provider = undefined;
    }
  }

  private registerNamespace() {
    const method = WAKU_JSONRPC.post.relay.subscriptions;
    const topic = this.namespace;
    const params = [[topic]];

    if (typeof this.provider === "undefined") return;
    if (!this.connected) return;
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
    this.subscription.subscriptions.forEach(async ({ topic }) => {
      const messages = await this.getMessages(topic);
      if (messages && messages.length) {
        this.logger.trace({ method: "poll", messages: messages });
        this.events.emit("message", { topic, messages });
      }
    });
  }

  private setJsonRpcProvider(nodeUrl: string): JsonRpcProvider | undefined {
    let provider: JsonRpcProvider | undefined;
    try {
      provider = new JsonRpcProvider(nodeUrl);
    } catch (e) {
      // do nothing
    }
    return provider;
  }
}
