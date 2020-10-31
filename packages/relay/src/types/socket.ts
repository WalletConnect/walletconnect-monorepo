import WebSocket from "ws";

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
  socketId: string;
}
