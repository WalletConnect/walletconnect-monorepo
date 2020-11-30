import WebSocket from "ws";

export type SocketData = WebSocket.Data;

export interface Socket extends WebSocket {
  isAlive: boolean;
}
