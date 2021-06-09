import { Logger } from "pino";
import { RelayJsonRpc, RELAY_JSONRPC } from "relay-provider";
import { generateChildLogger } from "@pedrouid/pino-utils";

import { sha256 } from "./utils";
import { HttpService } from "./http";
import { Subscription } from "./types";
import {
  EMPTY_SOCKET_ID,
  MESSAGE_CONTEXT,
  MESSAGE_EVENTS,
  MESSAGE_RETRIAL_MAX,
  MESSAGE_RETRIAL_TIMEOUT,
  SIX_HOURS,
  NETWORK_EVENTS,
} from "./constants";
import { JsonRpcRequest } from "@json-rpc-tools/types";
import { formatJsonRpcRequest } from "@json-rpc-tools/utils";

export class MessageService {
  public context = MESSAGE_CONTEXT;

  private timeout = new Map<number, { counter: number; timeout: NodeJS.Timeout }>();

  constructor(public server: HttpService, public logger: Logger) {
    this.server = server;
    this.logger = generateChildLogger(logger, this.context);
    this.initialize();
  }

  public async setMessage(
    params: RelayJsonRpc.PublishParams,
    socketId = EMPTY_SOCKET_ID,
  ): Promise<void> {
    const message = await this.server.redis.getMessage(params.topic, sha256(params.message));
    if (!message) {
      await this.server.redis.setMessage(params);
      this.server.events.emit(MESSAGE_EVENTS.added, params, socketId);
      if (this.server.network) {
        this.server.network.publish(params.topic, params.message);
      }
    }
  }

  public async getMessages(topic: string): Promise<string[]> {
    return this.server.redis.getMessages(topic);
  }

  public async pushMessage(subscription: Subscription, message: string): Promise<void> {
    const request = formatJsonRpcRequest<RelayJsonRpc.SubscriptionParams>(
      RELAY_JSONRPC.waku.subscription,
      {
        id: subscription.id,
        data: {
          topic: subscription.topic,
          message,
        },
      },
    );

    await this.server.redis.setPendingRequest(subscription.topic, request.id, message);
    const success = this.server.ws.send(subscription.socketId, request);
    if (success) this.setTimeout(subscription.socketId, request);
  }

  public async ackMessage(id: number): Promise<void> {
    const pending = await this.server.redis.getPendingRequest(id);
    if (pending) {
      await this.server.redis.deletePendingRequest(id);
      this.deleteTimeout(id);
    }
  }

  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.registerEventListeners();
    this.logger.trace(`Initialized`);
  }

  private registerEventListeners(): void {
    if (typeof this.server.network === "undefined") return;
    this.server.events.on(NETWORK_EVENTS.message, (topic, message) =>
      this.setMessage({ topic, message, ttl: SIX_HOURS }),
    );
  }

  private setTimeout(socketId: string, request: JsonRpcRequest) {
    if (this.timeout.has(request.id)) return;
    const timeout = setTimeout(() => this.onTimeout(socketId, request), MESSAGE_RETRIAL_TIMEOUT);
    this.timeout.set(request.id, { counter: 1, timeout });
  }

  private async onTimeout(socketId: string, request: JsonRpcRequest) {
    const record = this.timeout.get(request.id);
    if (typeof record === "undefined") return;
    const counter = record.counter + 1;
    if (counter < MESSAGE_RETRIAL_MAX) {
      const success = this.server.ws.send(socketId, request);
      if (success) {
        this.timeout.set(request.id, { counter, timeout: record.timeout });
      } else {
        // if failed considered acknowledged
        await this.ackMessage(request.id);
      }
    } else {
      // stop trying and consider as acknowledged
      await this.ackMessage(request.id);
    }
  }

  private deleteTimeout(id: number): void {
    if (!this.timeout.has(id)) return;
    const record = this.timeout.get(id);
    if (typeof record === "undefined") return;
    clearTimeout(record.timeout);
  }
}
