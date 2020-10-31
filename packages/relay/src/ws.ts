import { Server } from "http";
import WebSocket from "ws";
import { formatLoggerContext } from "@walletconnect/utils";
import { Logger } from "pino";

import { RedisService } from "./redis";
import { NotificationService } from "./notification";
import { BridgeService } from "./bridge";
import { JsonRpcService } from "./jsonrpc";
import { Socket } from "./types";
import { uuid } from "./utils";

export class WebSocketService {
  public ws: WebSocket.Server;
  public notification: NotificationService;
  public bridge: BridgeService;
  public jsonrpc: JsonRpcService;

  public sockets = new Map<string, Socket>();

  public context = "websocket";

  constructor(public logger: Logger, public http: Server, public redis: RedisService) {
    this.logger = logger.child({ context: formatLoggerContext(logger, this.context) });
    this.redis = redis;
    this.ws = new WebSocket.Server({ server: http });
    this.notification = new NotificationService(logger, redis);
    this.bridge = new BridgeService(logger, redis);
    this.jsonrpc = new JsonRpcService(logger, redis, this, this.bridge, this.notification);
    this.initialize();
  }

  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.logger.trace({ type: "init" });

    this.ws.on("connection", (socket: Socket) => {
      const socketId = uuid();
      this.sockets.set(socketId, socket);
      socket.on("message", async data => {
        this.jsonrpc.onRequest(socketId, data);
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
        const sockets: any = this.ws.clients;
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
