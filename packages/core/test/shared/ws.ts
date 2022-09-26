import { IRelayer } from "@walletconnect/types";
import { throttle } from ".";

export async function disconnectSocket(relayer: IRelayer) {
  if (relayer?.connected) {
    await relayer?.provider.disconnect();
  }

  await throttle(100);
}
