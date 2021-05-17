import EventEmitter from "events";
import { Logger } from "pino";
import { generateChildLogger } from "@pedrouid/pino-utils";
import { IJsonRpcProvider, IEvents } from "@json-rpc-tools/utils";
import { JsonRpcProvider } from "@json-rpc-tools/provider";
import { arrayToHex } from "enc-utils";
import { Subscription, PagingOptions, WakuMessagesResult, WakuMessage } from "./types";

import {
  WAKU_JSONRPC,
  WAKU_POLLING_INTERVAL,
  WAKU_DEFAULT_PAGE_SIZE,
  WAKU_CONTEXT,
  WAKU_PUBSUB_TOPIC,
  EMPTY_SOCKET_ID,
} from "./constants";
import { HttpService } from "./http";

export class WakuService extends IEvents {
  public events = new EventEmitter();
  public context = WAKU_CONTEXT;
  public subscription: Subscription[] = [];
  public server: HttpService;
  public logger: Logger;
  public namespace = WAKU_PUBSUB_TOPIC;
  public provider: IJsonRpcProvider;

  private manageSubs = false;

  constructor(server: HttpService, logger: Logger, nodeUrl: string, subscription?: Subscription[]) {
    super();
    if (subscription) {
      this.subscription = subscription;
    } else {
      this.manageSubs = true;
    }
    this.server = server;
    this.logger = generateChildLogger(logger, this.context);
    this.provider = new JsonRpcProvider(nodeUrl);
    this.initialize();
  }

  get connected() {
    return this.provider.connection.connected;
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
    if (!this.connected) return;
    await this.provider.request({ method, params });
  }

  public async getMessages(topic: string): Promise<WakuMessage[]> {
    const method = WAKU_JSONRPC.get.filter.messages;
    const params = [topic];
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
    if (this.manageSubs)
      this.subscription.push({ topic, id: EMPTY_SOCKET_ID, socketId: EMPTY_SOCKET_ID });
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
    if (this.manageSubs)
      this.subscription = this.subscription.filter(({ topic }) => topic !== subscription);
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
    this.registerNamespace();
    setInterval(() => this.poll(), WAKU_POLLING_INTERVAL);
    this.logger.trace(`Initialized`);
    this.logger.debug({ manageSubs: this.manageSubs });
  }

  private async connectProvider(): Promise<void> {
    try {
      await this.provider.connect();
    } catch (e) {
      // do nothing
    }
  }

  private registerNamespace() {
    const method = WAKU_JSONRPC.post.relay.subscriptions;
    const topic = this.namespace;
    const params = [[topic]];
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
    this.subscription.forEach(async ({ topic }) => {
      const messages = await this.getMessages(topic);
      if (messages && messages.length) {
        this.logger.trace({ method: "poll", messages: messages });
        this.events.emit("message", { topic, messages });
      }
    });
  }
}
