import { ICore } from "@walletconnect/types";

export async function disconnectSocket(core: ICore) {
  await new Promise<void>((resolve) => setTimeout(resolve, 500));
  if (core.relayer.connected) {
    await disconnect(core);
    core.events.removeAllListeners();
    core.relayer.events.removeAllListeners();
    core.heartbeat.stop();
    core.relayer.provider.events.removeAllListeners();
    core.relayer.subscriber.events.removeAllListeners();
    core.relayer.provider.connection.events.removeAllListeners();
  }
}

async function disconnect(core: ICore) {
  return await core.relayer.transportClose();
}
