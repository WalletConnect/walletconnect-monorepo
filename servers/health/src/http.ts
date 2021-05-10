import fastify, { FastifyInstance } from "fastify";
import helmet from "fastify-helmet";
import pino, { Logger } from "pino";
import { getDefaultLoggerOptions, generateChildLogger } from "@pedrouid/pino-utils";

import config from "./config";
import { assertType } from "./utils";
import { HttpServiceOptions, PostTestRequest } from "./types";
import { testRelayProvider } from "./test";

export class HttpService {
  public app: FastifyInstance;
  public logger: Logger;

  public context = "server";

  constructor(opts: HttpServiceOptions) {
    const logger =
      typeof opts?.logger !== "undefined" && typeof opts?.logger !== "string"
        ? opts.logger
        : pino(getDefaultLoggerOptions({ level: opts?.logger }));
    this.app = fastify({ logger });
    this.logger = generateChildLogger(logger, this.context);
    this.initialize();
  }

  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.logger.trace(`Initialized`);

    this.app.register(helmet);

    this.app.get("/health", (_, res) => {
      res.status(204).send();
    });

    this.app.get("/hello", (_, res) => {
      res
        .status(200)
        .send(`Hello World, this is Health Server v${config.VERSION}@${config.GITHASH}`);
    });

    this.app.post<PostTestRequest>("/test", async (req, res) => {
      try {
        assertType(req, "body", "object");

        assertType(req.body, "relayProvider");

        const result = await testRelayProvider(req.body.relayProvider);

        res.status(200).send(result);
      } catch (e) {
        res.status(400).send({ message: `Error: ${e.message}` });
      }
    });
  }
}
