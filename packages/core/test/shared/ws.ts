import { ICore } from "@walletconnect/types";
import { throttle } from ".";

export async function disconnectSocket(core: ICore) {
  if (core.relayer.connected) {
    core.relayer.provider.connection?.on("open", () => {
      delete core.relayer.provider.connection;
    });

    await core.relayer.provider.disconnect();
    // await abit for socket to disconnect
    await throttle(500);
  }
}
