import SignClient from "../../src";
import { disconnectSocket } from "./ws";

export async function deleteClients(clients: { A: SignClient; B: SignClient }) {
  await disconnectSocket(clients.A.core);
  await disconnectSocket(clients.B.core);

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
