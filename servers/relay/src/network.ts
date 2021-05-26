import { Logger } from "pino";
import { generateChildLogger } from "@pedrouid/pino-utils";
import { IJsonRpcProvider } from "@json-rpc-tools/utils";
import { JsonRpcProvider } from "@json-rpc-tools/provider";
import { arrayToHex } from "enc-utils";
import { PagingOptions, WakuMessagesResult, WakuMessage, Subscription } from "./types";

import {
  WAKU_JSONRPC,
  NETWORK_POLLING_INTERVAL,
  NETWORK_DEFAULT_PAGE_SIZE,
  NETWORK_CONTEXT,
  NETWORK_PUBSUB_TOPIC,
  NETWORK_EVENTS,
  SUBSCRIPTION_EVENTS,
} from "./constants";
import { HttpService } from "./http";

export class NetworkService {
  public context = NETWORK_CONTEXT;
  public server: HttpService;
  public logger: Logger;
  public namespace = NETWORK_PUBSUB_TOPIC;
  public provider: IJsonRpcProvider | undefined;

  constructor(server: HttpService, logger: Logger, nodeUrl: string) {
    this.server = server;
    this.logger = generateChildLogger(logger, this.context);
    this.provider = this.setJsonRpcProvider(nodeUrl);
    this.initialize();
  }

  get connected() {
    return this.provider?.connection.connected;
  }

  public async publish(topic: string, payload: string) {
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

  public async subscribe(topic: string) {
    // noop
  }

  public async unsubscribe(topic: string) {
    // noop
  }

  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.connectProvider();
    this.logger.trace(`Initialized`);
  }

  private async connectProvider(): Promise<void> {
    if (typeof this.provider === "undefined") return;
    try {
      await this.provider.connect();
      if (!this.connected) return;
      this.onConnect();
    } catch (e) {
      console.error(e); // eslint-disable-line
      this.provider = undefined;
    }
  }

  private onConnect() {
    this.registerNamespace();
    this.registerEventListeners();
    setInterval(() => this.poll(), NETWORK_POLLING_INTERVAL);
  }

  private registerEventListeners() {
    this.server.events.on(SUBSCRIPTION_EVENTS.added, async (subscription: Subscription) => {
      if (this.server.network) {
        await this.server.network.subscribe(subscription.topic);
      }
    });
  }

  private registerNamespace() {
    const method = WAKU_JSONRPC.post.relay.subscriptions;
    const topic = this.namespace;
    const params = [[topic]];

    if (typeof this.provider === "undefined") return;
    if (!this.connected) return;
    this.provider.request({ method, params });
  }

  private async getMessages(
    pagingOptions: PagingOptions = {
      pageSize: NETWORK_DEFAULT_PAGE_SIZE,
      forward: true,
    },
    messages: WakuMessage[] = [],
  ): Promise<WakuMessage[]> {
    const startTime: number = (Date.now() - NETWORK_POLLING_INTERVAL * 2) / 1000;
    const endTime: number = Date.now() / 1000;
    const method = WAKU_JSONRPC.get.store.messages;
    const params = [this.namespace, [], pagingOptions];
    if (typeof this.provider === "undefined") return [];
    if (!this.connected) return [];
    this.logger.trace({ type: "method", method: "getStoreMessages", params, pagingOptions });
    const result = await this.provider.request({ method, params });
    pagingOptions = result.pagingOptions;
    messages = [...messages, ...this.parseWakuMessageResult(result.messages)];
    this.logger.debug({ type: "method", method: "getMessages", pagingOptions });
    this.logger.trace({ type: "messages", messages });
    if (pagingOptions?.pageSize == 0 || !pagingOptions) return messages;
    return [...messages, ...(await this.getMessages(pagingOptions))];
  }

  private parseWakuMessageResult(result: WakuMessagesResult[]): WakuMessage[] {
    const messages: WakuMessage[] = [];
    const seenMessages = new Set();
    result.forEach((m) => {
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

  private async poll() {
    const messages = await this.getMessages();
    if (messages && messages.length) {
      this.logger.trace({ method: "poll", messages });
      messages.forEach((m) =>
        this.server.events.emit(NETWORK_EVENTS.message, m.contentTopic, m.payload),
      );
    }
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
