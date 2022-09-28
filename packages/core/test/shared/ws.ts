import { IRelayer } from "@walletconnect/types";

export async function disconnectSocket(relayer: IRelayer) {
  if (relayer.connected) {
    relayer.provider.connect = () => new Promise<void>((resolve) => resolve);
    await relayer.provider.connection.close();
  }
}
