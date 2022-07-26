import SignClient from "../../src";

export function deleteClients(clients: { A: SignClient; B: SignClient }) {
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
