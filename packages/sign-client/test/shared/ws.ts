import { ICore } from "@walletconnect/types";
import EventEmitter from "events";

export async function disconnectSocket(core: ICore) {
  if (core.relayer.connected) {
    core.relayer.provider.connect = () => new Promise<void>((resolve) => resolve);
    core.relayer.provider.connection.on("open", async () => {
      await disconnectSocket(core);
    });
    core.relayer.provider.events = new EventEmitter();
    core.relayer.provider.connection.events = new EventEmitter();
    await disconnect(core.relayer.provider.connection);
  }
}

async function disconnect(socket: any) {
  if (socket.connected) {
    await socket.close();
  }
}
