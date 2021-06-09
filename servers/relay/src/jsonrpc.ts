import {
  formatJsonRpcError,
  formatJsonRpcResult,
  getError,
  isJsonRpcRequest,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcPayload,
  METHOD_NOT_FOUND,
} from "@json-rpc-tools/utils";
import { Logger } from "pino";
import {
  RELAY_JSONRPC,
  RelayJsonRpc,
  parsePublishRequest,
  parseSubscribeRequest,
  parseUnsubscribeRequest,
} from "relay-provider";
import { generateChildLogger } from "@pedrouid/pino-utils";

import config from "./config";
import { HttpService } from "./http";
import { Subscription } from "./types";
import {
  JSONRPC_CONTEXT,
  EMPTY_SOCKET_ID,
  JSONRPC_EVENTS,
  MESSAGE_EVENTS,
  SUBSCRIPTION_EVENTS,
} from "./constants";

export class JsonRpcService {
  public context = JSONRPC_CONTEXT;

  constructor(public server: HttpService, public logger: Logger) {
    this.server = server;
    this.logger = generateChildLogger(logger, this.context);
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
      this.logger.debug({ type: "payload", direction: "incoming", payload: request, socketId });

      switch (request.method) {
        case RELAY_JSONRPC.waku.publish:
          await this.onPublishRequest(
            socketId,
            request as JsonRpcRequest<RelayJsonRpc.PublishParams>,
          );
          break;
        case RELAY_JSONRPC.waku.subscribe:
          await this.onSubscribeRequest(
            socketId,
            request as JsonRpcRequest<RelayJsonRpc.SubscribeParams>,
          );
          break;

        case RELAY_JSONRPC.waku.unsubscribe:
          await this.onUnsubscribeRequest(
            socketId,
            request as JsonRpcRequest<RelayJsonRpc.UnsubscribeParams>,
          );
          break;

        default:
          this.server.ws.send(socketId, formatJsonRpcError(request.id, getError(METHOD_NOT_FOUND)));
          return;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      this.server.ws.send(socketId, formatJsonRpcError(request.id, e.message));
    }
  }

  public async onResponse(socketId: string, response: JsonRpcResponse): Promise<void> {
    this.logger.info(`Incoming JSON-RPC Payload`);
    this.logger.debug({ type: "payload", direction: "incoming", payload: response, socketId });
    await this.server.message.ackMessage(response.id);
  }

  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.registerEventListeners();
    this.logger.trace(`Initialized`);
  }

  private registerEventListeners(): void {
    this.server.events.on(
      MESSAGE_EVENTS.added,
      async (params: RelayJsonRpc.PublishParams, socketId = EMPTY_SOCKET_ID) =>
        await this.checkActiveSubscriptions(socketId, params),
    );
    this.server.events.on(SUBSCRIPTION_EVENTS.added, async (subscription: Subscription) => {
      if (!subscription.legacy) {
        await this.checkCachedMessages(subscription);
      }
    });
  }

  private async onPublishRequest(socketId: string, request: JsonRpcRequest) {
    const params = parsePublishRequest(request);
    if (params.ttl > config.REDIS_MAX_TTL) {
      const errorMessage = `requested ttl is above ${config.REDIS_MAX_TTL} seconds`;
      this.logger.error(errorMessage);
      this.server.ws.send(
        socketId,
        formatJsonRpcError(request.id, `requested ttl is above ${config.REDIS_MAX_TTL} seconds`),
      );
      return;
    }
    this.logger.debug(`Publish Request Received`);
    this.logger.trace({ type: "method", method: "onPublishRequest", socketId, params });
    await this.server.message.setMessage(params, socketId);
    this.server.ws.send(socketId, formatJsonRpcResult(request.id, true));
    this.server.events.emit(JSONRPC_EVENTS.publish, params, socketId);
  }

  private async onSubscribeRequest(socketId: string, request: JsonRpcRequest) {
    const params = parseSubscribeRequest(request);
    this.logger.debug(`Subscribe Request Received`);
    this.logger.trace({ type: "method", method: "onSubscribeRequest", socketId, params });
    const id = this.server.subscription.set({ topic: params.topic, socketId });
    this.server.ws.send(socketId, formatJsonRpcResult(request.id, id));
    const subscription = { id, topic: params.topic, socketId };
    this.server.events.emit(JSONRPC_EVENTS.subscribe, subscription);
  }

  private async onUnsubscribeRequest(socketId: string, request: JsonRpcRequest) {
    const params = parseUnsubscribeRequest(request);
    this.logger.debug(`Unsubscribe Request Received`);
    this.logger.trace({ type: "method", method: "onUnsubscribeRequest", socketId, params });
    this.server.subscription.remove(params.id);
    this.server.ws.send(socketId, formatJsonRpcResult(request.id, true));
    this.server.events.emit(JSONRPC_EVENTS.unsubscribe, params.id);
  }

  private async checkActiveSubscriptions(socketId: string, params: RelayJsonRpc.PublishParams) {
    this.logger.debug(`Checking Active subscriptions`);
    this.logger.trace({ type: "method", method: "checkActiveSubscriptions", socketId, params });
    const { topic, message } = params;
    const subscriptions = this.server.subscription.get(topic, socketId);
    this.logger.debug(`Found ${subscriptions.length} subscriptions`);
    this.logger.trace({ type: "method", method: "checkActiveSubscriptions", subscriptions });
    if (subscriptions.length) {
      await Promise.all(
        subscriptions.map(async (subscription: Subscription) => {
          await this.server.message.pushMessage(subscription, message);
        }),
      );
    }
  }

  private async checkCachedMessages(subscription: Subscription) {
    const { socketId } = subscription;
    this.logger.debug(`Checking Cached Messages`);
    this.logger.trace({ type: "method", method: "checkCachedMessages", socketId });
    const messages = await this.server.message.getMessages(subscription.topic);
    this.logger.debug(`Found ${messages.length} cached messages`);
    this.logger.trace({ type: "method", method: "checkCachedMessages", messages });
    if (messages && messages.length) {
      await Promise.all(
        messages.map(async (message: string) => {
          await this.server.message.pushMessage(subscription, message);
        }),
      );
    }
  }
}
