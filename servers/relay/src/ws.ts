import { Logger } from "pino";
import client from "prom-client";
import { safeJsonParse, safeJsonStringify } from "safe-json-utils";
import { isJsonRpcPayload, JsonRpcPayload } from "@json-rpc-tools/utils";
import { generateChildLogger } from "@pedrouid/pino-utils";

import config from "./config";
import { JsonRpcService } from "./jsonrpc";
import { LegacySocketMessage, Socket } from "./types";
import {
  generateRandomBytes32,
  isJsonRpcDisabled,
  isLegacyDisabled,
  isLegacySocketMessage,
} from "./utils";

import { LegacyService } from "./legacy";
import { HttpService } from "./http";
import { SERVER_EVENTS, WEBSOCKET_CONTEXT, WEBSOCKET_EVENTS } from "./constants";

export class WebSocketService {
  public jsonrpc: JsonRpcService;
  public legacy: LegacyService;
  public sockets = new Map<string, Socket>();

  public context = WEBSOCKET_CONTEXT;

  private metrics;

  constructor(public server: HttpService, public logger: Logger) {
    this.server = server;
    this.logger = generateChildLogger(logger, this.context);
    this.jsonrpc = new JsonRpcService(this.server, this.logger);
    this.legacy = new LegacyService(this.server, this.logger);
    this.metrics = {
      newConnection: new client.Counter({
        name: `${this.server.context}_${this.context}_new_connections`,
        help: "Sum of opened ws connection",
        registers: [this.server.metrics.register],
      }),
      closeConnection: new client.Counter({
        name: `${this.server.context}_${this.context}_closed_connections`,
        help: "Sum of closed ws connections",
        registers: [this.server.metrics.register],
      }),
      totalMessages: new client.Counter({
        name: `${this.server.context}_${this.context}_messages_total`,
        help: "Total amount of messages",
        registers: [this.server.metrics.register],
      }),
    };

    this.initialize();
  }

  public send(socketId: string, msg: string | JsonRpcPayload | LegacySocketMessage): boolean {
    const socket = this.getSocket(socketId);
    if (typeof socket === "undefined") return false;
    const message = typeof msg === "string" ? msg : safeJsonStringify(msg);
    this.logger.debug(`Outgoing Socket Message`);
    this.logger.trace({ type: "message", direction: "outgoing", message });
    socket.send(message);
    return true;
  }

  public getSocket(socketId: string): Socket | undefined {
    const socket = this.sockets.get(socketId);
    if (typeof socket === "undefined") {
      this.logger.error(`Socket not found with socketId: ${socketId}`);
      return;
    }
    return socket;
  }

  public isSocketConnected(socketId: string): boolean {
    try {
      const socket = this.getSocket(socketId);
      if (typeof socket == "undefined") return false;
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
    this.server.events.emit(WEBSOCKET_EVENTS.open, socketId);
    socket.on("message", async data => {
      this.metrics.totalMessages.inc();
      const message = data.toString();
      this.logger.debug(`Incoming Socket Message`);
      this.logger.trace({ type: "message", direction: "incoming", message });

      if (!message || !message.trim()) {
        this.send(socketId, "Missing or invalid socket data");
        return;
      }
      const payload = safeJsonParse(message);
      if (typeof payload === "string") {
        this.send(socketId, "Socket message is invalid");
        return;
      } else if (isLegacySocketMessage(payload)) {
        if (isLegacyDisabled(config.mode)) {
          this.send(socketId, "Legacy messages are disabled");
          return;
        }
        this.legacy.onRequest(socketId, payload);
      } else if (isJsonRpcPayload(payload)) {
        if (isJsonRpcDisabled(config.mode)) {
          this.send(socketId, "JSON-RPC messages are disabled");
          return;
        }
        this.jsonrpc.onPayload(socketId, payload);
      } else {
        this.send(socketId, "Socket message unsupported");
        return;
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
      this.server.events.emit(WEBSOCKET_EVENTS.close, socketId);
    });
  }

  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.logger.trace(`Initialized`);
    this.registerEventListeners();
  }

  private registerEventListeners() {
    this.server.events.on(SERVER_EVENTS.beat, () => this.clearInactiveSockets());
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
        this.server.events.emit(WEBSOCKET_EVENTS.close, socketId);
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
