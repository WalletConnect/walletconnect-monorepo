import { ICore } from "@walletconnect/types";
import EventEmitter from "events";

export async function disconnectSocket(core: ICore) {
  if (core.relayer.connected) {
    // override the events to disable reconnection
    core.relayer.provider.events = new EventEmitter();
    await core.relayer.provider.connection.close();
  }
}
