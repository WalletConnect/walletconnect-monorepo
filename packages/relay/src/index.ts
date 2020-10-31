import Helmet from "fastify-helmet";
import { Logger } from "pino";
import fastify, { RequestGenericInterface } from "fastify";
import { getLoggerOptions } from "@walletconnect/utils";

import { assertType } from "./utils";
import config from "./config";
import { RedisService } from "./redis";
import { WebSocketService } from "./ws";

const app = fastify({
  logger: getLoggerOptions(config.debug ? "debug" : "warn"),
});

const logger = app.log.child({ context: "server" }) as Logger;
const redis = new RedisService(logger);

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

    await redis.setNotification({
      topic: req.body.topic,
      webhook: req.body.webhook,
    });

    res.status(200).send({ success: true });
  } catch (e) {
    res.status(400).send({ message: `Error: ${e.message}` });
  }
});

app.ready(() => {
  new WebSocketService(logger, app.server, redis);
});

app.listen(+config.port, config.host, (err, address) => {
  if (err) throw err;
  logger.info(`Server listening on ${address}`);
});
