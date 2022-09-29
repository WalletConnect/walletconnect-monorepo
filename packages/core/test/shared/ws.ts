import { IRelayer } from "@walletconnect/types";
import EventEmitter from "events";

export async function disconnectSocket(relayer: IRelayer) {
  if (relayer.connected) {
    // override the events to disable reconnection
    relayer.provider.events = new EventEmitter();
    await relayer.provider.connection.close();
  }
}
