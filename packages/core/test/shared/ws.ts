import { ICore } from "@walletconnect/types";
import { throttle } from ".";

export async function disconnectSocket(core: ICore) {
  if (core.relayer.connected) {
    core.relayer.provider.on("open", () => {
      console.log("on open");
    });
    core.relayer.provider.connect = () => new Promise<void>((resolve) => resolve);
    await core.relayer.provider.connection.close();

    throttle(2_000);
    console.log("connected after", core.relayer.connected);
  }
}
