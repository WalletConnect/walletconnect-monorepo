import { Logger } from "pino";
import { generateChildLogger } from "@pedrouid/pino-utils";
import { IJsonRpcProvider } from "@json-rpc-tools/utils";
import { JsonRpcProvider } from "@json-rpc-tools/provider";
import { HttpConnection } from "@json-rpc-tools/http-connection";
import { arrayToHex } from "enc-utils";
import { isFloat } from "./utils";
import { PagingOptions, WakuMessagesResult, WakuMessage, Subscription } from "./types";

import {
  WAKU_JSONRPC,
  NETWORK_POLLING_INTERVAL,
  NETWORK_DEFAULT_PAGE_SIZE,
  NETWORK_CONTEXT,
  NETWORK_PUBSUB_TOPIC,
  NETWORK_EVENTS,
  SUBSCRIPTION_EVENTS,
  NETWORK_RECONNECT_INTERVAL,
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

  public publish(topic: string, payload: string) {
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
    this.request({ method, params });
  }

  public async subscribe(topic: string) {
    // noop
  }

  public async unsubscribe(topic: string) {
    // noop
  }

  // ---------- Private ----------------------------------------------- //

  private async initialize(): Promise<void> {
    await this.connectProvider();
    if (!this.provider?.connection.connected) this.reconnectProvider();
    this.logger.debug(`Initialized`);
  }

  private async connectProvider(): Promise<void> {
    if (typeof this.provider === "undefined") return;
    try {
      await this.provider.connect();
      if (!this.connected) {
        this.provider.disconnect();
        return;
      }
      this.onConnect();
    } catch (e) {
      this.logger.error({ "Provider Error": e.message });
    }
  }

  private reconnectProvider(): void {
    const connectInterval = setInterval(() => {
      if (this.connected) {
        clearInterval(connectInterval);
      } else {
        this.connectProvider();
      }
    }, NETWORK_RECONNECT_INTERVAL);
  }

  private onConnect() {
    this.registerNamespace();
    this.registerEventListeners();
    this.getStoreMessages();
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
    this.request({ method, params });
  }

  private async getMessages(topic = this.namespace): Promise<WakuMessage[]> {
    const method = WAKU_JSONRPC.get.relay.messages;
    const params = [topic];
    const result = await this.request({ method, params });
    if (!result) return [];
    const messages = this.parseWakuMessageResult(result);
    this.logger.trace({ type: "method", topic, method: "getMessages", messages });
    return messages;
  }

  private async getStoreMessages(
    pagingOptions: PagingOptions = {
      pageSize: NETWORK_DEFAULT_PAGE_SIZE,
      forward: true,
    },
    messages: WakuMessage[] = [],
  ): Promise<WakuMessage[]> {
    const startTime: number = 0.001;
    let endTime: number = Date.now() / 1000;
    if (isFloat(endTime)) endTime += 0.001;
    const method = WAKU_JSONRPC.get.store.messages;
    const params = [this.namespace, [], startTime, endTime, pagingOptions];
    if (typeof this.provider === "undefined") return [];
    if (!this.connected) return [];
    this.logger.debug({ type: "method", method: "getStoreMessages", params });
    const result = await this.request({ method, params });
    if (!result) return [];
    pagingOptions = result.pagingOptions;
    messages = [...messages, ...this.parseWakuMessageResult(result.messages)];
    if (pagingOptions?.pageSize == 0 || !pagingOptions) return messages;
    return [...messages, ...(await this.getStoreMessages(pagingOptions))];
  }

  private async request(payload: { method; params }): Promise<any> {
    try {
      if (typeof this.provider === "undefined") throw "Provider not defined";
      if (!this.connected) throw "Not connected";
      return await this.provider.request(payload);
    } catch (e) {
      this.logger.error({ "Request Error": e });
      if (e.includes("get_waku_v2_relay_v1_messages")) {
        this.provider?.disconnect();
        this.logger.info("Attempting to reconnect...");
        this.reconnectProvider();
      }
      return;
    }
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

  private async poll() {
    const messages = await this.getMessages();
    if (messages && messages.length) {
      this.logger.trace({ method: "poll", messages });
      messages.forEach(m =>
        this.server.events.emit(NETWORK_EVENTS.message, m.contentTopic, m.payload),
      );
    }
  }

  private setJsonRpcProvider(nodeUrl: string): JsonRpcProvider | undefined {
    let provider: JsonRpcProvider | undefined;
    try {
      provider = new JsonRpcProvider(new HttpConnection(nodeUrl));
    } catch (e) {
      this.logger.error({ "Setting RpcProvider Error": e.message });
    }
    return provider;
  }
}
