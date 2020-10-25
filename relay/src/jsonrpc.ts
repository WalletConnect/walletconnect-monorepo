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

import { pushNotification } from "./notification";
import { setSub, getSub, setPub, getPub } from "./keystore";
import {
  Subscription,
  Socket,
  SocketData,
  Logger,
  JsonRpcMiddleware,
  BridgeSubscriptionParams,
  BridgeSubscribeParams,
  BridgePublishParams,
} from "./types";
import {
  isBridgePublish,
  parseBridgePublish,
  parseBridgeSubscribe,
} from "./utils";
import { BRIDGE_JSONRPC } from "./constants";

async function socketSend(
  socket: Socket,
  request: JsonRpcRequest | JsonRpcResult | JsonRpcError,
  logger: Logger
) {
  if (socket.readyState === 1) {
    const message = JSON.stringify(request);
    socket.send(message);
    logger.info({ type: "outgoing", message });
  } else {
    if (isJsonRpcRequest(request)) {
      const params = request.params;
      if (isBridgePublish(params)) {
        await setPub(params);
      }
    }
  }
}

async function handleSubscribe(
  socket: Socket,
  request: JsonRpcRequest,
  logger: Logger
) {
  const params = parseBridgeSubscribe(request);
  const topic = params.topic;

  const subscriber = { topic, socket };

  await setSub(subscriber);

  const pending = await getPub(topic);

  if (pending && pending.length) {
    await Promise.all(
      pending.map((message: string) =>
        socketSend(
          socket,
          formatJsonRpcRequest(BRIDGE_JSONRPC.subscription, {
            topic,
            message,
          } as BridgeSubscriptionParams),
          logger
        )
      )
    );
  }
}

async function handlePublish(
  socket: Socket,
  request: JsonRpcRequest,
  logger: Logger
) {
  const params = parseBridgePublish(request);
  const subscribers = await getSub(params.topic);

  // TODO: assume all payloads are non-silent for now
  await pushNotification(params.topic);

  if (subscribers.length) {
    await Promise.all(
      subscribers.map((subscriber: Subscription) =>
        socketSend(subscriber.socket, request, logger)
      )
    );
  } else {
    await setPub(params);
  }

  socketSend(socket, formatJsonRpcResult(request.id, true), logger);
}

async function jsonRpcServer(
  socket: Socket,
  data: SocketData,
  logger: Logger,
  middleware?: JsonRpcMiddleware
): Promise<void> {
  const message = String(data);

  if (!message || !message.trim()) {
    socketSend(
      socket,
      formatJsonRpcError(payloadId(), getError(INVALID_REQUEST)),
      logger
    );
    return;
  }

  logger.info({ type: "incoming", message });

  try {
    let request: JsonRpcRequest | undefined;

    try {
      request = JSON.parse(message);
    } catch (e) {
      // do nothing
    }

    if (typeof request === "undefined") {
      socketSend(
        socket,
        formatJsonRpcError(payloadId(), getError(PARSE_ERROR)),
        logger
      );
      return;
    }

    if (middleware) {
      middleware(request);
    }

    switch (request.method) {
      case BRIDGE_JSONRPC.subscribe:
        await handleSubscribe(
          socket,
          request as JsonRpcRequest<BridgeSubscribeParams>,
          logger
        );
        break;
      case BRIDGE_JSONRPC.publish:
        await handlePublish(
          socket,
          request as JsonRpcRequest<BridgePublishParams>,
          logger
        );
        break;
      case BRIDGE_JSONRPC.unsubscribe:
        // TODO: implement handleUnsubscribe
        break;
      default:
        socketSend(
          socket,
          formatJsonRpcError(payloadId(), getError(METHOD_NOT_FOUND)),
          logger
        );
        return;
    }
  } catch (e) {
    console.error(e);
    socketSend(socket, formatJsonRpcError(payloadId(), e.message), logger);
  }
}

export default jsonRpcServer;
