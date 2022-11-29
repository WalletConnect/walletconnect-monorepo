import { IRelayer } from "@walletconnect/types";

export async function disconnectSocket(relayer: IRelayer) {
  if (relayer.connected) {
    await relayer.transportClose();
  }
}
