import { Server } from "http";
import WebSocket from "ws";
import * as encUtils from "enc-utils";
import { formatLoggerContext } from "@walletconnect/utils";
import { Logger } from "pino";

import { RedisService } from "./redis";
import { NotificationService } from "./notification";
import { JsonRpcService } from "./jsonrpc";
import { Socket } from "./types";
import { isLegacySocketMessage, uuid } from "./utils";
import { safeJsonParse } from "safe-json-utils";
import { isJsonRpcRequest } from "rpc-json-utils";
import { LegacyService } from "./legacy";

export class WebSocketService {
  public server: WebSocket.Server;
  public jsonrpc: JsonRpcService;
  public legacy: LegacyService;

  public sockets = new Map<string, Socket>();

  public context = "websocket";

  constructor(
    server: Server,
    public logger: Logger,
    public redis: RedisService,
    public notification: NotificationService,
  ) {
    this.logger = logger.child({ context: formatLoggerContext(logger, this.context) });
    this.redis = redis;
    this.notification = this.notification;
    this.server = new WebSocket.Server({ server });
    this.jsonrpc = new JsonRpcService(this.logger, this.redis, this, this.notification);
    this.legacy = new LegacyService(this.logger, this.redis, this, this.notification);
    this.initialize();
  }

  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.logger.trace({ type: "init" });

    this.server.on("connection", (socket: Socket) => {
      const socketId = uuid();
      this.logger.info("New Socket Connected");
      this.logger.debug({ type: "event", event: "connection", socketId });
      this.sockets.set(socketId, socket);
      socket.on("message", async data => {
        const message = typeof data === "string" ? data : encUtils.bufferToUtf8(Buffer.from(data));
        this.logger.info("Incoming WebSocket Message");
        this.logger.debug({ type: "message", direction: "incoming", message });

        let response: string;
        if (!message || !message.trim()) {
          response = "Missing or invalid socket data";
          this.logger.info("Outgoing WebSocket Message");
          this.logger.debug({ type: "message", direction: "outgoing", response });
          socket.send(response);
          return;
        }
        const payload = safeJsonParse(message);
        if (typeof payload === "string") {
          response = "Socket message is invalid";
          this.logger.info("Outgoing WebSocket Message");
          this.logger.debug({ type: "message", direction: "outgoing", response });
          socket.send(response);
        } else if (isJsonRpcRequest(payload)) {
          this.jsonrpc.onRequest(socketId, payload);
        } else if (isLegacySocketMessage(payload)) {
          this.legacy.onRequest(socketId, payload);
        } else {
          response = "Socket message unsupported";
          this.logger.info("Outgoing WebSocket Message");
          this.logger.debug({ type: "message", direction: "outgoing", response });
          socket.send(response);
        }
      });

      socket.on("pong", () => {
        socket.isAlive = true;
      });

      socket.on("error", (e: Error) => {
        if (!e.message.includes("Invalid WebSocket frame")) {
          throw e;
        }
        this.logger.warn({ type: e.name, message: e.message });
      });
    });

    setInterval(
      () => {
        const sockets: any = this.server.clients;
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
  }
}
