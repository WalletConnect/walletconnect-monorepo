import { ICore } from "@walletconnect/types";

export async function disconnectSocket(core: ICore) {
  if (core.relayer.connected) {
    core.relayer.provider.connect = () => new Promise<void>((resolve) => resolve);
    core.relayer.provider.connection.on("open", async () => await disconnectSocket(core));
    await disconnect(core.relayer.provider.connection);
  }
}

async function disconnect(socket: any) {
  if (socket.connected) {
    await socket.close();
  }
}
