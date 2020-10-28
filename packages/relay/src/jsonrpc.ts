import {
  formatJsonRpcError,
  formatJsonRpcRequest,
  formatJsonRpcResult,
  getError,
  INVALID_REQUEST,
  isJsonRpcRequest,
  JsonRpcError,
  JsonRpcRequest,
  JsonRpcResult,
  METHOD_NOT_FOUND,
  PARSE_ERROR,
  payloadId,
} from "rpc-json-utils";
import { Logger } from "pino";
import { safeJsonParse, safeJsonStringify } from "safe-json-utils";
import { RelayTypes } from "@walletconnect/types";
import { formatLoggerContext, getRelayProtocolJsonRpc } from "@walletconnect/utils";

import { RedisStore } from "./redis";
import { NotificationServer } from "./notification";
import { Subscription, Socket, SocketData } from "./types";
import {
  isPublishParams,
  parsePublishRequest,
  parseSubscribeRequest,
  parseUnsubscribeRequest,
} from "./utils";

const BRIDGE_JSONRPC = getRelayProtocolJsonRpc("bridge");
const WAKU_JSONRPC = getRelayProtocolJsonRpc("waku");

export class JsonRpcServer {
  public context = "jsonrpc";

  constructor(
    public logger: Logger,
    public store: RedisStore,
    public notification: NotificationServer,
  ) {
    this.logger = logger.child({ context: formatLoggerContext(logger, this.context) });
    this.store = store;
    this.notification = notification;
  }

  public async onRequest(socket: Socket, data: SocketData): Promise<void> {
    const message = String(data);

    if (!message || !message.trim()) {
      const code = getError(INVALID_REQUEST);
      this.logger.error({ type: "incoming", code, message });
      this.socketSend(socket, formatJsonRpcError(payloadId(), code));
      return;
    }

    try {
      const request = safeJsonParse<JsonRpcRequest>(message);

      if (typeof request === "string") {
        const code = getError(PARSE_ERROR);
        this.logger.error({ type: "incoming", code, message });
        this.socketSend(socket, formatJsonRpcError(payloadId(), code));
        return;
      } else {
        this.logger.info({ type: "incoming", request });
      }

      switch (request.method) {
        case WAKU_JSONRPC.publish:
        case BRIDGE_JSONRPC.publish:
          await this.onPublishRequest(socket, request as JsonRpcRequest<RelayTypes.PublishParams>);
          break;
        case WAKU_JSONRPC.subscribe:
        case BRIDGE_JSONRPC.subscribe:
          await this.onSubscribeRequest(
            socket,
            request as JsonRpcRequest<RelayTypes.SubscribeParams>,
          );
          break;

        case WAKU_JSONRPC.unsubscribe:
        case BRIDGE_JSONRPC.unsubscribe:
          await this.onUnsubscribeRequest(
            socket,
            request as JsonRpcRequest<RelayTypes.UnsubscribeParams>,
          );
          break;
        default:
          this.socketSend(socket, formatJsonRpcError(payloadId(), getError(METHOD_NOT_FOUND)));
          return;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      this.socketSend(socket, formatJsonRpcError(payloadId(), e.message));
    }
  }
  // ---------- Private ----------------------------------------------- //
  private async onPublishRequest(socket: Socket, request: JsonRpcRequest) {
    const params = parsePublishRequest(request);
    this.logger.info({ method: "onPublishRequest", params });
    const subscribers = this.store.getSub(params.topic, socket);
    this.logger.info({ method: "onPublishRequest", subscribers: subscribers.length });

    // TODO: assume all payloads are non-silent for now
    await this.notification.push(params.topic);

    if (subscribers.length) {
      await Promise.all(
        subscribers.map((subscriber: Subscription) => this.socketSend(subscriber.socket, request)),
      );
    } else {
      await this.store.setPub(params);
    }

    this.socketSend(socket, formatJsonRpcResult(request.id, true));
  }

  private async onSubscribeRequest(socket: Socket, request: JsonRpcRequest) {
    const params = parseSubscribeRequest(request);
    this.logger.info({ method: "onSubscribeRequest", params });

    const topic = params.topic;

    const subscriber = { topic, socket };

    this.store.setSub(subscriber);

    const pending = await this.store.getPub(topic);
    this.logger.info({ method: "onSubscribeRequest", pending: pending.length });

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
          this.socketSend(socket, request);
        }),
      );
    }
  }
  private async onUnsubscribeRequest(socket: Socket, request: JsonRpcRequest) {
    const params = parseUnsubscribeRequest(request);
    this.logger.info({ method: "onUnsubscribeRequest", params });
    const topic = params.topic;

    const subscriber = { topic, socket };

    this.store.removeSub(subscriber);
  }

  private async socketSend(socket: Socket, payload: JsonRpcRequest | JsonRpcResult | JsonRpcError) {
    if (socket.readyState === 1) {
      const message = safeJsonStringify(payload);
      socket.send(message);
      this.logger.info({ type: "outgoing", payload });
    } else {
      if (isJsonRpcRequest(payload)) {
        const params = payload.params;
        if (isPublishParams(params)) {
          await this.store.setPub(params);
        }
      }
    }
  }
}
