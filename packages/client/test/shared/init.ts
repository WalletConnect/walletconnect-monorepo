import { ClientTypes } from "@walletconnect/types";
import "mocha";
// import { expect } from "chai";

import Client from "../../src";

import { TEST_CLIENT_OPTIONS_A, TEST_CLIENT_OPTIONS_B } from "./values";

export interface Clients {
  A: Client;
  B: Client;
}

export async function initTwoClients(clientOpts: ClientTypes.Options = {}) {
  const A = await Client.init({ ...TEST_CLIENT_OPTIONS_A, ...clientOpts });
  const B = await Client.init({ ...TEST_CLIENT_OPTIONS_B, ...clientOpts });
  return { A, B };
}
