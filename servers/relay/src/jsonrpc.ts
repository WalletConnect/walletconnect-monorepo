import {
  formatJsonRpcError,
  formatJsonRpcRequest,
  formatJsonRpcResult,
  getError,
  isJsonRpcRequest,
  JsonRpcError,
  JsonRpcRequest,
  JsonRpcResult,
  METHOD_NOT_FOUND,
  payloadId,
} from "@json-rpc-tools/utils";
import { Logger } from "pino";
import { safeJsonStringify } from "safe-json-utils";
import { RelayTypes } from "@walletconnect/types";
import {
  formatLoggerContext,
  isPublishParams,
  parsePublishRequest,
  parseSubscribeRequest,
  parseUnsubscribeRequest,
} from "./utils";

import { RedisService } from "./redis";
import { NotificationService } from "./notification";
import { Subscription } from "./types";

import { SubscriptionService } from "./subscription";
import { WebSocketService } from "./ws";
import { BRIDGE_JSONRPC } from "./constants";

export class JsonRpcService {
  public subscription: SubscriptionService;

  public context = "jsonrpc";

  constructor(
    public logger: Logger,
    public redis: RedisService,
    public ws: WebSocketService,
    public notification: NotificationService,
  ) {
    this.logger = logger.child({ context: formatLoggerContext(logger, this.context) });
    this.redis = redis;
    this.ws = ws;
    this.notification = notification;
    this.subscription = new SubscriptionService(this.logger, this.redis);
    this.initialize();
  }

  public async onRequest(socketId: string, request: JsonRpcRequest): Promise<void> {
    try {
      this.logger.info(`Incoming JSON-RPC Payload`);
      this.logger.debug({ type: "payload", direction: "incoming", payload: request });

      switch (request.method) {
        case BRIDGE_JSONRPC.publish:
          await this.onPublishRequest(
            socketId,
            request as JsonRpcRequest<RelayTypes.PublishParams>,
          );
          break;
        case BRIDGE_JSONRPC.subscribe:
          await this.onSubscribeRequest(
            socketId,
            request as JsonRpcRequest<RelayTypes.SubscribeParams>,
          );
          break;

        case BRIDGE_JSONRPC.unsubscribe:
          await this.onUnsubscribeRequest(
            socketId,
            request as JsonRpcRequest<RelayTypes.UnsubscribeParams>,
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
  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.logger.trace(`Initialized`);
  }

  private async onPublishRequest(socketId: string, request: JsonRpcRequest) {
    const params = parsePublishRequest(request);
    this.logger.debug(`Publish Request Received`);
    this.logger.trace({ type: "method", method: "onPublishRequest", params });
    const subscriptions = this.subscription.get(params.topic, socketId);

    // TODO: assume all payloads are non-silent for now
    await this.notification.push(params.topic);

    if (subscriptions.length) {
      await Promise.all(
        subscriptions.map((subscriber: Subscription) => {
          this.pushSubscription(subscriber, params.message);
        }),
      );
    } else {
      await this.redis.setPublished(params);
    }

    this.socketSend(socketId, formatJsonRpcResult(request.id, true));
  }

  private async onSubscribeRequest(socketId: string, request: JsonRpcRequest) {
    const params = parseSubscribeRequest(request);
    this.logger.debug(`Subscribe Request Received`);
    this.logger.trace({ type: "method", method: "onSubscribeRequest", params });

    const id = this.subscription.set({ topic: params.topic, socketId });

    await this.socketSend(socketId, formatJsonRpcResult(request.id, id));

    await this.pushPendingPublished({ id, topic: params.topic, socketId });
  }

  private async onUnsubscribeRequest(socketId: string, request: JsonRpcRequest) {
    const params = parseUnsubscribeRequest(request);
    this.logger.debug(`Unsubscribe Request Received`);
    this.logger.trace({ type: "method", method: "onUnsubscribeRequest", params });

    this.subscription.remove(params.id);

    await this.socketSend(socketId, formatJsonRpcResult(request.id, true));
  }

  private async pushPendingPublished(subscription: Subscription) {
    const pending = await this.redis.getPublished(subscription.topic);
    this.logger.debug(`Pushing Pending Published`);
    this.logger.trace({ type: "method", method: "pushPendingPublished", pending });

    if (pending && pending.length) {
      await Promise.all(
        pending.map((message: string) => {
          this.pushSubscription(subscription, message);
        }),
      );
    }
  }

  private async pushSubscription(subscription: Subscription, message: string): Promise<void> {
    const request = formatJsonRpcRequest<RelayTypes.SubscriptionParams>(
      BRIDGE_JSONRPC.subscription,
      {
        id: subscription.id,
        data: {
          topic: subscription.topic,
          message,
        },
      },
    );
    this.socketSend(subscription.socketId, request);
  }

  private async socketSend(
    socketId: string,
    payload: JsonRpcRequest | JsonRpcResult | JsonRpcError,
  ) {
    const socket = this.ws.sockets.get(socketId);
    if (typeof socket === "undefined") {
      // TODO: handle this error better
      throw new Error("socket missing or invalid");
    }
    if (socket.readyState === 1) {
      socket.send(safeJsonStringify(payload));
      this.logger.info(`Outgoing JSON-RPC Payload`);
      this.logger.debug({ type: "payload", direction: "outgoing", payload });
    } else {
      if (isJsonRpcRequest(payload)) {
        const params = payload.params;
        if (isPublishParams(params)) {
          await this.redis.setPublished(params);
        }
      }
    }
  }
}
