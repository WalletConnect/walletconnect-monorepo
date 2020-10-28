import WebSocket from "ws";
import Helmet from "fastify-helmet";
import { Logger } from "pino";
import fastify, { RequestGenericInterface } from "fastify";
import { getLoggerOptions } from "@walletconnect/utils";

import { assertType } from "./utils";
import config from "./config";
import { Socket } from "./types";
import { RedisStore } from "./redis";
import { JsonRpcServer } from "./jsonrpc";
import { NotificationServer } from "./notification";

const app = fastify({
  logger: getLoggerOptions(config.debug ? "debug" : "warn"),
});

const logger = app.log.child({ context: "server" }) as Logger;
const store = new RedisStore(logger);

app.register(Helmet);

app.get("/health", (_, res) => {
  res.status(204).send();
});

app.get("/hello", (req, res) => {
  res.status(200).send(`Hello World, this is WalletConnect`);
});

interface PostSubscribeRequest extends RequestGenericInterface {
  Body: {
    topic: string;
    webhook: string;
  };
}

app.post<PostSubscribeRequest>("/subscribe", async (req, res) => {
  try {
    assertType(req, "body", "object");

    assertType(req.body, "topic");
    assertType(req.body, "webhook");

    await store.setNotification({
      topic: req.body.topic,
      webhook: req.body.webhook,
    });

    res.status(200).send({ success: true });
  } catch (e) {
    res.status(400).send({ message: `Error: ${e.message}` });
  }
});

app.ready(() => {
  const wsServer = new WebSocket.Server({ server: app.server });
  const notification = new NotificationServer(logger, store);
  const jsonRpcServer = new JsonRpcServer(logger, store, notification);

  wsServer.on("connection", (socket: Socket) => {
    socket.on("message", async data => {
      jsonRpcServer.onRequest(socket, data);
    });

    socket.on("pong", () => {
      socket.isAlive = true;
    });

    socket.on("error", (e: Error) => {
      if (!e.message.includes("Invalid WebSocket frame")) {
        throw e;
      }
      logger.warn({ type: e.name, message: e.message });
    });
  });

  setInterval(
    () => {
      const sockets: any = wsServer.clients;
      sockets.forEach((socket: Socket) => {
        if (socket.isAlive === false) {
          return socket.terminate();
        }

        function noop() {
          // empty
        }

        socket.isAlive = false;
        socket.ping(noop);
      });
    },
    10000, // 10 seconds
  );
});

app.listen(+config.port, config.host, (err, address) => {
  if (err) throw err;
  logger.info(`Server listening on ${address}`);
});
