import client, { Metric } from "prom-client";
import { EventEmitter } from "events";
import { Server } from "http";
import WebSocket from "ws";
import { Logger } from "pino";
import { safeJsonParse } from "safe-json-utils";
import { isJsonRpcPayload } from "@json-rpc-tools/utils";
import { generateChildLogger } from "@pedrouid/pino-utils";

import register from "./metrics";
import { RedisService } from "./redis";
import { NotificationService } from "./notification";
import { JsonRpcService } from "./jsonrpc";
import { Socket } from "./types";
import { generateRandomBytes32, isLegacySocketMessage } from "./utils";

import { LegacyService } from "./legacy";
import { TEN_SECONDS } from "./constants";

export class WebSocketService {
  public server: WebSocket.Server;
  public jsonrpc: JsonRpcService;
  public legacy: LegacyService;

  public sockets = new Map<string, Socket>();

  public events = new EventEmitter();

  public context = "websocket";

  private metrics;

  constructor(
    server: Server,
    public logger: Logger,
    public redis: RedisService,
    public notification: NotificationService,
  ) {
    this.logger = generateChildLogger(logger, this.context);
    this.redis = redis;
    this.notification = this.notification;
    this.server = new WebSocket.Server({ server });
    this.jsonrpc = new JsonRpcService(this.logger, this.redis, this, this.notification);
    this.legacy = new LegacyService(this.logger, this.redis, this, this.notification);
    this.metrics = {
      newConnection: new client.Counter({
        name: "relay_" + this.context + "_new_connections",
        help: "Sum of opened ws connection",
        registers: [register],
      }),
      closeConnection: new client.Counter({
        name: "relay_" + this.context + "_closed_connections",
        help: "Sum of closed ws connections",
        registers: [register],
      }),
      totalMessages: new client.Counter({
        name: "relay_" + this.context + "_messages_total",
        help: "Total amount of messages",
        registers: [register],
      }),
    };

    this.initialize();
  }

  public on(event: string, listener: any): void {
    this.events.on(event, listener);
  }

  public once(event: string, listener: any): void {
    this.events.once(event, listener);
  }

  public off(event: string, listener: any): void {
    this.events.off(event, listener);
  }

  public removeListener(event: string, listener: any): void {
    this.events.removeListener(event, listener);
  }

  public send(socketId: string, message: string) {
    if (!this.isSocketConnected(socketId)) {
      throw new Error(`Socket not active with socketId: ${socketId}`);
    }
    const socket = this.getSocket(socketId);
    socket.send(message);
  }

  public getSocket(socketId: string): Socket {
    const socket = this.sockets.get(socketId);
    if (typeof socket === "undefined") {
      throw new Error(`Socket not found with socketId: ${socketId}`);
    }
    return socket;
  }

  public isSocketConnected(socketId: string): boolean {
    try {
      const socket = this.getSocket(socketId);
      return socket.readyState === 1;
    } catch (e) {
      return false;
    }
  }

  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.logger.trace(`Initialized`);

    this.server.on("connection", (socket: Socket) => {
      const socketId = generateRandomBytes32();
      this.metrics.newConnection.inc();
      this.logger.info(`New Socket Connected`);
      this.logger.debug({ type: "event", event: "connection", socketId });
      this.sockets.set(socketId, socket);
      this.events.emit("socket_open", socketId);
      socket.on("message", async data => {
        this.metrics.totalMessages.inc();
        const message = data.toString();
        this.logger.debug(`Incoming WebSocket Message`);
        this.logger.trace({ type: "message", direction: "incoming", message });

        let response: string;
        if (!message || !message.trim()) {
          response = "Missing or invalid socket data";
          this.logger.debug(`Outgoing WebSocket Message`);
          this.logger.trace({ type: "message", direction: "outgoing", response });
          socket.send(response);
          return;
        }
        const payload = safeJsonParse(message);
        if (typeof payload === "string") {
          response = "Socket message is invalid";
          this.logger.debug(`Outgoing WebSocket Message`);
          this.logger.trace({ type: "message", direction: "outgoing", response });
          socket.send(response);
        } else if (isLegacySocketMessage(payload)) {
          this.legacy.onRequest(socketId, payload);
        } else if (isJsonRpcPayload(payload)) {
          this.jsonrpc.onPayload(socketId, payload);
        } else {
          response = "Socket message unsupported";
          this.logger.debug(`Outgoing WebSocket Message`);
          this.logger.trace({ type: "message", direction: "outgoing", response });
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
        this.logger.error(e);
      });

      socket.on("close", () => {
        this.metrics.closeConnection.inc();
        this.sockets.delete(socketId);
        this.events.emit("socket_close", socketId);
      });
    });

    setInterval(() => this.clearInactiveSockets(), TEN_SECONDS * 1000);
  }

  private clearInactiveSockets() {
    const socketIds = Array.from(this.sockets.keys());
    socketIds.forEach((socketId: string) => {
      const socket = this.sockets.get(socketId);

      if (typeof socket === "undefined") {
        return;
      }
      if (socket.isAlive === false) {
        this.sockets.delete(socketId);
        socket.terminate();
        this.events.emit("socket_close", socketId);
        return;
      }

      function noop() {
        // empty
      }

      socket.isAlive = false;
      socket.ping(noop);
    });
  }
}
