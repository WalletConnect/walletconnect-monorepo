import { IRelayer } from "@walletconnect/types";
import { throttle } from ".";
import { RELAYER_PROVIDER_EVENTS } from "../../src";

export async function disconnectSocket(relayer: IRelayer, testName = "") {
  if (relayer.connected) {
    relayer.provider.events.emit(RELAYER_PROVIDER_EVENTS.disconnect);
    await relayer.provider.disconnect();
    // await abit for socket to disconnect
    await throttle(2_000);

    console.log("disconnect", relayer.connected, testName);
  }
}
