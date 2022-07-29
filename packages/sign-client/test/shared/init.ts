import { SignClientTypes } from "@walletconnect/types";
import SignClient from "../../src";
import { TEST_SIGN_CLIENT_OPTIONS_A, TEST_SIGN_CLIENT_OPTIONS_B } from "./values";

export interface Clients {
  A: SignClient;
  B: SignClient;
}

export async function initTwoClients(clientOpts: SignClientTypes.Options = {}) {
  const A = await SignClient.init({ ...TEST_SIGN_CLIENT_OPTIONS_A, ...clientOpts });
  const B = await SignClient.init({ ...TEST_SIGN_CLIENT_OPTIONS_B, ...clientOpts });
  return { A, B };
}
