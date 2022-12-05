import SignClient from "../../src";
import { disconnectSocket } from "./ws";

export async function deleteClients(clients: {
  A: SignClient | undefined;
  B: SignClient | undefined;
}) {
  await throttle(1_000);
  if (clients.A) await disconnectSocket(clients.A.core);
  if (clients.B) await disconnectSocket(clients.B.core);

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
