import { ICore } from "@walletconnect/types";

export async function disconnect(core: ICore | undefined): Promise<void> {
  if (core?.relayer?.connected) {
    await core.relayer.transportClose();
  }
}
