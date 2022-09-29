import { IJsonRpcConnection } from "@walletconnect/jsonrpc-utils";
import { ICore } from "@walletconnect/types";
import EventEmitter from "events";

export async function disconnectSocket(core: ICore) {
  if (core.relayer.connected) {
    core.relayer.provider.events = new EventEmitter();
    core.relayer.provider.connection.on("open", async () => {
      await disconnect(core.relayer.provider.connection);
    });
    await disconnect(core.relayer.provider.connection);
  }
}

function disconnect(socket: IJsonRpcConnection) {
  return socket.close();
}
