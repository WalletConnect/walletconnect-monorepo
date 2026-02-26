import { SignClient } from "@walletconnect/sign-client/dist/types/client";
import UniversalProvider from "../../src";
import { disconnectSocket } from "./index";

export async function deleteProviders(providers: { A: UniversalProvider; B: UniversalProvider }) {
  await deleteClients({ A: providers.A.client, B: providers.B.client });
  delete providers.A;
  delete providers.B;
}

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
