import client from "prom-client";
import { EventEmitter } from "events";
import { Logger } from "pino";
import { safeJsonParse } from "safe-json-utils";
import { isJsonRpcPayload } from "@json-rpc-tools/utils";
import { generateChildLogger } from "@pedrouid/pino-utils";

import config from "./config";
import register from "./metrics";
import { RedisService } from "./redis";
import { NotificationService } from "./notification";
import { JsonRpcService } from "./jsonrpc";
import { Socket } from "./types";
import {
  generateRandomBytes32,
  isJsonRpcDisabled,
  isLegacyDisabled,
  isLegacySocketMessage,
} from "./utils";

import { LegacyService } from "./legacy";
import { TEN_SECONDS } from "./constants";

export class WebSocketService {
  public jsonrpc: JsonRpcService;
  public legacy: LegacyService;

  public sockets = new Map<string, Socket>();

  public events = new EventEmitter();

  public context = "websocket";

  private metrics;

  constructor(
    public logger: Logger,
    public redis: RedisService,
    public notification: NotificationService,
  ) {
    this.logger = generateChildLogger(logger, this.context);
    this.redis = redis;
    this.notification = this.notification;
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
    this.logger.debug(`Outgoing Socket Message`);
    this.logger.trace({ type: "message", direction: "outgoing", message });
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

  public addNewSocket(socket: Socket) {
    const socketId = generateRandomBytes32();
    this.metrics.newConnection.inc();
    this.logger.info(`New Socket Connected`);
    this.logger.debug({ type: "event", event: "connection", socketId });
    this.sockets.set(socketId, socket);
    this.events.emit("socket_open", socketId);
    socket.on("message", async data => {
      this.metrics.totalMessages.inc();
      const message = data.toString();
      this.logger.debug(`Incoming Socket Message`);
      this.logger.trace({ type: "message", direction: "incoming", message });

      if (!message || !message.trim()) {
        return this.send(socketId, "Missing or invalid socket data");
      }
      const payload = safeJsonParse(message);
      if (typeof payload === "string") {
        return this.send(socketId, "Socket message is invalid");
      } else if (isLegacySocketMessage(payload)) {
        if (isLegacyDisabled(config.mode)) {
          return this.send(socketId, "Legacy messages are disabled");
        }
        this.legacy.onRequest(socketId, payload);
      } else if (isJsonRpcPayload(payload)) {
        if (isJsonRpcDisabled(config.mode)) {
          return this.send(socketId, "JSON-RPC messages are disabled");
        }
        this.jsonrpc.onPayload(socketId, payload);
      } else {
        return this.send(socketId, "Socket message unsupported");
      }
    });

    socket.on("pong", () => {
      socket.isAlive = true;
    });

    socket.on("error", (e: Error) => {
      if (!e.message.includes("Invalid WebSocket frame")) {
        this.logger.fatal(e);
        throw e;
      }
      this.logger.error({ "Socket Error": e.message });
    });

    socket.on("close", () => {
      this.metrics.closeConnection.inc();
      this.sockets.delete(socketId);
      this.events.emit("socket_close", socketId);
    });
  }

  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.logger.trace(`Initialized`);
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
