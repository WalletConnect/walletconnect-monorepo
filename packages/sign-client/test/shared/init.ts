import { SignClientTypes } from "@walletconnect/types";
import SignClient from "../../src";
import { TEST_SIGN_CLIENT_OPTIONS_A, TEST_SIGN_CLIENT_OPTIONS_B } from "./values";

export interface Clients {
  A: SignClient;
  B: SignClient;
}

export async function initTwoClients(
  clientOptsA: SignClientTypes.Options = {},
  clientOptsB: SignClientTypes.Options = {},
  sharedClientOpts: SignClientTypes.Options = {},
) {
  const A = await SignClient.init({
    ...TEST_SIGN_CLIENT_OPTIONS_A,
    ...sharedClientOpts,
    ...clientOptsA,
  });
  const B = await SignClient.init({
    ...TEST_SIGN_CLIENT_OPTIONS_B,
    ...sharedClientOpts,
    ...clientOptsB,
  });
  return { A, B };
}
