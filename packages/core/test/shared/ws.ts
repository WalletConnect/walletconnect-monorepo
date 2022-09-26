import { ICore } from "@walletconnect/types";
import { throttle } from ".";

export async function disconnectSocket(core: ICore) {
  if (core.relayer.connected) {
    await core.relayer.provider.connection.close();
  }
}
