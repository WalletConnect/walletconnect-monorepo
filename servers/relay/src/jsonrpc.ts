import {
  formatJsonRpcError,
  formatJsonRpcRequest,
  formatJsonRpcResult,
  getError,
  isJsonRpcRequest,
  JsonRpcError,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcResult,
  JsonRpcPayload,
  METHOD_NOT_FOUND,
  payloadId,
} from "@json-rpc-tools/utils";
import { Logger } from "pino";
import { safeJsonStringify } from "safe-json-utils";
import {
  RELAY_JSONRPC,
  RelayJsonRpc,
  isPublishParams,
  parsePublishRequest,
  parseSubscribeRequest,
  parseUnsubscribeRequest,
} from "relay-provider";
import { generateChildLogger } from "@pedrouid/pino-utils";

import config from "./config";
import { RedisService } from "./redis";
import { NotificationService } from "./notification";
import { Subscription } from "./types";

import { SubscriptionService } from "./subscription";
import { WebSocketService } from "./ws";

export class JsonRpcService {
  public subscription: SubscriptionService;
  public context = "jsonrpc";

  constructor(
    public logger: Logger,
    public redis: RedisService,
    public ws: WebSocketService,
    public notification: NotificationService,
  ) {
    this.logger = generateChildLogger(logger, this.context);
    this.redis = redis;
    this.ws = ws;
    this.notification = notification;
    this.subscription = new SubscriptionService(this.logger, this.redis, this.ws);
    this.initialize();
  }

  public async onPayload(socketId: string, payload: JsonRpcPayload): Promise<void> {
    if (isJsonRpcRequest(payload)) {
      this.onRequest(socketId, payload);
    } else {
      this.onResponse(socketId, payload);
    }
  }

  public async onRequest(socketId: string, request: JsonRpcRequest): Promise<void> {
    try {
      this.logger.info(`Incoming JSON-RPC Payload`);
      this.logger.debug({ type: "payload", direction: "incoming", payload: request });

      switch (request.method) {
        case RELAY_JSONRPC.bridge.publish:
          await this.onPublishRequest(
            socketId,
            request as JsonRpcRequest<RelayJsonRpc.PublishParams>,
          );
          break;
        case RELAY_JSONRPC.bridge.subscribe:
          await this.onSubscribeRequest(
            socketId,
            request as JsonRpcRequest<RelayJsonRpc.SubscribeParams>,
          );
          break;

        case RELAY_JSONRPC.bridge.unsubscribe:
          await this.onUnsubscribeRequest(
            socketId,
            request as JsonRpcRequest<RelayJsonRpc.UnsubscribeParams>,
          );
          break;

        default:
          this.socketSend(socketId, formatJsonRpcError(payloadId(), getError(METHOD_NOT_FOUND)));
          return;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      this.socketSend(socketId, formatJsonRpcError(payloadId(), e.message));
    }
  }

  public async onResponse(socketId: string, response: JsonRpcResponse): Promise<void> {
    this.logger.info(`Incoming JSON-RPC Payload`);
    this.logger.debug({ type: "payload", direction: "incoming", payload: response });
    const result = await this.redis.getPendingRequest(response.id);
    if (result) {
      await this.redis.deletePendingRequest(response.id);
    }
  }

  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.logger.trace(`Initialized`);
  }

  private async onPublishRequest(socketId: string, request: JsonRpcRequest) {
    const params = parsePublishRequest(request);
    if (params.ttl > config.REDIS_MAX_TTL) {
      const errorMessage = `requested ttl is above ${config.REDIS_MAX_TTL} seconds`;
      this.logger.error(errorMessage);
      this.socketSend(
        socketId,
        formatJsonRpcError(payloadId(), `requested ttl is above ${config.REDIS_MAX_TTL} seconds`),
      );
      return;
    }
    this.logger.debug(`Publish Request Received`);
    this.logger.trace({ type: "method", method: "onPublishRequest", socketId, params });

    await this.notification.push(params.topic);
    await this.redis.setMessage(params);
    await this.searchSubscriptions(socketId, params);

    this.socketSend(socketId, formatJsonRpcResult(request.id, true));
  }

  private async onSubscribeRequest(socketId: string, request: JsonRpcRequest) {
    const params = parseSubscribeRequest(request);
    this.logger.debug(`Subscribe Request Received`);
    this.logger.trace({ type: "method", method: "onSubscribeRequest", socketId, params });
    const id = this.subscription.set({ topic: params.topic, socketId });
    await this.socketSend(socketId, formatJsonRpcResult(request.id, id));
    await this.pushCachedMessages({ id, topic: params.topic, socketId });
  }

  private async onUnsubscribeRequest(socketId: string, request: JsonRpcRequest) {
    const params = parseUnsubscribeRequest(request);
    this.logger.debug(`Unsubscribe Request Received`);
    this.logger.trace({ type: "method", method: "onUnsubscribeRequest", socketId, params });

    this.subscription.remove(params.id);

    await this.socketSend(socketId, formatJsonRpcResult(request.id, true));
  }

  private async searchSubscriptions(socketId: string, params: RelayJsonRpc.PublishParams) {
    this.logger.debug(`Searching subscriptions`);
    this.logger.trace({ type: "method", method: "searchSubscriptions", socketId, params });
    const subscriptions = this.subscription.get(params.topic, socketId);
    this.logger.debug(`Found ${subscriptions.length} subscriptions`);
    this.logger.trace({ type: "method", method: "searchSubscriptions", subscriptions });
    if (subscriptions.length) {
      await Promise.all(
        subscriptions.map((subscriber: Subscription) => {
          this.pushSubscription(subscriber, params.message);
        }),
      );
    }
  }

  private async pushCachedMessages(subscription: Subscription) {
    const { socketId } = subscription;
    this.logger.debug(`Pushing Cached Messages`);
    this.logger.trace({ type: "method", method: "pushCachedMessages", socketId });
    const messages = await this.redis.getMessages(subscription.topic);
    this.logger.debug(`Found ${messages.length} cached messages`);
    this.logger.trace({ type: "method", method: "pushCachedMessages", messages });
    if (messages && messages.length) {
      await Promise.all(
        messages.map((message: string) => {
          this.pushSubscription(subscription, message);
        }),
      );
    }
  }

  private async pushSubscription(subscription: Subscription, message: string): Promise<void> {
    const request = formatJsonRpcRequest<RelayJsonRpc.SubscriptionParams>(
      RELAY_JSONRPC.bridge.subscription,
      {
        id: subscription.id,
        data: {
          topic: subscription.topic,
          message,
        },
      },
    );
    await this.redis.setPendingRequest(subscription.topic, request.id, message);
    await this.socketSend(subscription.socketId, request);
  }

  private async socketSend(
    socketId: string,
    payload: JsonRpcRequest | JsonRpcResult | JsonRpcError,
  ) {
    try {
      this.ws.send(socketId, safeJsonStringify(payload));
      this.logger.info(`Outgoing JSON-RPC Payload`);
      this.logger.debug({ type: "payload", direction: "outgoing", payload, socketId });
    } catch (e) {
      this.onFailedPush(payload);
    }
  }

  private async onFailedPush(
    payload: JsonRpcRequest | JsonRpcResult | JsonRpcError,
  ): Promise<void> {
    if (isJsonRpcRequest(payload)) {
      if (isPublishParams(payload.params)) {
        await this.redis.setMessage(payload.params);
      }
    }
  }
}
