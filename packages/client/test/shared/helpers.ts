import Client from "../../src";

export function deleteClients(clients: { A: Client; B: Client }) {
  delete clients.A;
  delete clients.B;
}
