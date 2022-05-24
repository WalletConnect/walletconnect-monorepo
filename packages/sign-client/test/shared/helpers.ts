import SignClient from "../../src";

export function deleteClients(clients: { A: SignClient; B: SignClient }) {
  delete clients.A;
  delete clients.B;
}
