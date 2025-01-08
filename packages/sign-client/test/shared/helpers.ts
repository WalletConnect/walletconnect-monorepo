import SignClient from "../../src";
import { disconnectSocket } from "./ws";

export async function deleteClients(clients: {
  A: SignClient | undefined;
  B: SignClient | undefined;
}) {
  for (const client of [clients.A, clients.B]) {
    if (!client) continue;
    client.core.events.removeAllListeners();
    client.core.relayer.events.removeAllListeners();
    client.core.heartbeat.stop();
    client.core.relayer?.provider?.events?.removeAllListeners();
    client.core.relayer.subscriber.events.removeAllListeners();
    client.core.relayer?.provider?.connection?.events?.removeAllListeners();
    client.events.removeAllListeners();
    await disconnectSocket(client.core);
  }
  delete clients.A;
  delete clients.B;
}

export async function throttle(timeout: number) {
  return await new Promise<void>((resolve) =>
    setTimeout(() => {
      resolve();
    }, timeout),
  );
}
