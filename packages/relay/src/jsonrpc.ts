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
} from "rpc-json-utils";
import { Logger } from "pino";
import { safeJsonStringify } from "safe-json-utils";
import { RelayTypes } from "@walletconnect/types";
import { formatLoggerContext, getRelayProtocolJsonRpc } from "@walletconnect/utils";

import { RedisService } from "./redis";
import { NotificationService } from "./notification";
import { Subscription } from "./types";
import {
  isPublishParams,
  parsePublishRequest,
  parseSubscribeRequest,
  parseUnsubscribeRequest,
} from "./utils";
import { SubscriptionService } from "./subscription";
import { WebSocketService } from "./ws";

const BRIDGE_JSONRPC = getRelayProtocolJsonRpc("bridge");

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
      this.logger.info("Incoming JSON-RPC Payload");
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
    this.logger.trace({ type: "init" });
  }

  private async onPublishRequest(socketId: string, request: JsonRpcRequest) {
    this.logger.info(`Publish Request Received`);
    const params = parsePublishRequest(request);
    this.logger.debug({ type: "method", method: "onPublishRequest", params });
    const subscribers = this.subscription.getSubscribers(params.topic, socketId);
    this.logger.debug({
      type: "method",
      method: "onPublishRequest",
      subscribers: subscribers.length,
    });

    // TODO: assume all payloads are non-silent for now
    await this.notification.push(params.topic);

    if (subscribers.length) {
      await Promise.all(
        subscribers.map((subscriber: Subscription) => {
          const payload = formatJsonRpcRequest<RelayTypes.SubscriptionParams>(
            BRIDGE_JSONRPC.subscription,
            request.params,
          );
          this.socketSend(subscriber.socketId, payload);
        }),
      );
    } else {
      await this.redis.setPublished(params);
    }

    this.socketSend(socketId, formatJsonRpcResult(request.id, true));
  }

  private async onSubscribeRequest(socketId: string, request: JsonRpcRequest) {
    this.logger.info(`Subscribe Request Received`);
    const params = parseSubscribeRequest(request);
    this.logger.debug({ type: "method", method: "onSubscribeRequest", params });

    const topic = params.topic;

    const subscriber = { topic, socketId };

    this.subscription.setSubscriber(subscriber);

    const pending = await this.redis.getPublished(topic);
    this.logger.debug({ type: "method", method: "onSubscribeRequest", pending: pending.length });

    if (pending && pending.length) {
      await Promise.all(
        pending.map((message: string) => {
          const request = formatJsonRpcRequest<RelayTypes.SubscriptionParams>(
            BRIDGE_JSONRPC.subscription,
            {
              topic,
              message,
            },
          );
          this.socketSend(socketId, request);
        }),
      );
    }
  }
  private async onUnsubscribeRequest(socketId: string, request: JsonRpcRequest) {
    this.logger.info(`Unsubscribe Request Received`);
    const params = parseUnsubscribeRequest(request);
    this.logger.debug({ type: "method", method: "onUnsubscribeRequest", params });
    const topic = params.topic;

    const subscriber = { topic, socketId };

    this.subscription.removeSubscriber(subscriber);
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
      const message = safeJsonStringify(payload);
      socket.send(message);
      this.logger.info("Outgoing JSON-RPC Payload");
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
