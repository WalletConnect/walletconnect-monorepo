import Helmet from "fastify-helmet";
import pino, { Logger } from "pino";
import fastify, { FastifyInstance } from "fastify";
import { getLoggerOptions } from "@walletconnect/utils";

import { assertType } from "./utils";
import { RedisService } from "./redis";
import { WebSocketService } from "./ws";
import { NotificationService } from "./notification";
import { HttpServiceOptions, PostSubscribeRequest } from "./types";

export class HttpService {
  public app: FastifyInstance;
  public logger: Logger;
  public redis: RedisService;

  public ws: WebSocketService | undefined;
  public notification: NotificationService | undefined;

  public context = "server";

  constructor(opts: HttpServiceOptions) {
    const logger =
      typeof opts?.logger !== "undefined" && typeof opts?.logger !== "string"
        ? opts.logger
        : pino(getLoggerOptions(opts?.logger));
    this.app = fastify({ logger });
    this.logger = logger.child({ context: "server" });
    this.redis = new RedisService(this.logger);
    this.initialize();
  }

  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.logger.trace({ type: "init" });

    this.app.register(Helmet);

    this.app.get("/health", (_, res) => {
      res.status(204).send();
    });

    this.app.get("/hello", (req, res) => {
      res.status(200).send(`Hello World, this is WalletConnect`);
    });

    this.app.post<PostSubscribeRequest>("/subscribe", async (req, res) => {
      try {
        assertType(req, "body", "object");

        assertType(req.body, "topic");
        assertType(req.body, "webhook");

        await this.redis.setNotification({
          topic: req.body.topic,
          webhook: req.body.webhook,
        });

        res.status(200).send({ success: true });
      } catch (e) {
        res.status(400).send({ message: `Error: ${e.message}` });
      }
    });

    this.app.ready(() => {
      this.notification = new NotificationService(this.logger, this.redis);
      this.ws = new WebSocketService(this.app.server, this.logger, this.redis, this.notification);
    });
  }
}
