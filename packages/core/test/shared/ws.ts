import { IJsonRpcConnection } from "@walletconnect/jsonrpc-utils";
import { IRelayer } from "@walletconnect/types";
import EventEmitter from "events";

export async function disconnectSocket(relayer: IRelayer) {
  if (relayer.connected) {
    relayer.provider.events = new EventEmitter();
    relayer.core.heartbeat.events = new EventEmitter();
    relayer.provider.connection.on("open", async () => {
      await disconnect(relayer.provider.connection);
    });
    await disconnect(relayer.provider.connection);
  }
}

function disconnect(socket: IJsonRpcConnection) {
  return socket.close();
}
