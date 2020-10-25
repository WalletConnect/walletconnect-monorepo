import http from "http";
import WebSocket from "ws";

import { Socket, Logger } from "./types";
import jsonRpcServer from "./jsonrpc";
import { notificationMiddleware } from "./notification";

export function initWebSocketServer(server: http.Server, logger: Logger) {
  const wsServer = new WebSocket.Server({ server });

  wsServer.on("connection", (socket: Socket) => {
    socket.on("message", async (data) => {
      jsonRpcServer(socket, data, logger, notificationMiddleware);
    });

    socket.on("pong", () => {
      socket.isAlive = true;
    });
    socket.on("error", (e: Error) => {
      if (!e.message.includes("Invalid WebSocket frame")) {
        throw e
      }
      logger.warn({type: e.name, message: e.message})
    })
  });

  setInterval(
    () => {
      const sockets: any = wsServer.clients;
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
    10000 // 10 seconds
  );
}
