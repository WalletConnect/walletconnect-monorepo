import { ICore } from "@walletconnect/types";
import { throttle } from ".";

export async function disconnectSocket(core: ICore) {
  if (core.relayer.connected) {
    await core.relayer.provider.connection.close();
    delete core.relayer.provider.connection;
    core.relayer.provider.connect = () => new Promise<void>((resolve) => resolve);
  }
}
