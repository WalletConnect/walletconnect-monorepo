import { ICore } from "@walletconnect/types";
import { throttle } from ".";

export async function disconnectSocket(core: ICore) {
  if (core.relayer.connected) {
    await core.relayer.provider.connection.close();
    delete core.relayer.provider.connection;
    // await abit for socket to disconnect
    await throttle(500);
  }
}
