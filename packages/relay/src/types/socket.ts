import WebSocket from "ws";
import * as fastify from "fastify";

export type Logger = fastify.FastifyLoggerInstance;

export type SocketData = WebSocket.Data;

export interface Socket extends WebSocket {
  isAlive: boolean;
}

export interface Notification {
  topic: string;
  webhook: string;
}

export interface Subscription {
  topic: string;
  socket: Socket;
}
