import { IRelayer } from "@walletconnect/types";
import { throttle } from ".";

export async function disconnectSocket(relayer: IRelayer) {
  if (relayer.connected) {
    console.log("disconnect");
    await relayer.provider.disconnect();
    // await abit for socket to disconnect
    await throttle(2_000);
  }
}
