import { Server } from "http";
import WebSocket from "ws";
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
      this.sockets.set(socketId, socket);
      socket.on("message", async data => {
        const message = String(data);

        if (!message || !message.trim()) {
          socket.send("Missing or invalid socket data");
          return;
        }
        const payload = safeJsonParse(message);
        if (isJsonRpcRequest(payload)) {
          this.jsonrpc.onRequest(socketId, payload);
        } else if (isLegacySocketMessage(payload)) {
          this.legacy.onRequest(socketId, payload);
        } else {
          socket.send("Socket message unsupported");
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
