import { SignClientTypes } from "@walletconnect/types";
import SignClient from "../../src";
import { logClientIds } from "./helpers";
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
  console.log("initializing client A");
  const A = await SignClient.init({
    ...TEST_SIGN_CLIENT_OPTIONS_A,
    ...sharedClientOpts,
    ...clientOptsA,
  });
  console.log("clientId A", await A.core.crypto.getClientId());

  console.log("initializing client B");
  const B = await SignClient.init({
    ...TEST_SIGN_CLIENT_OPTIONS_B,
    ...sharedClientOpts,
    ...clientOptsB,
  });

  console.log("clientId B", await B.core.crypto.getClientId());
  return { A, B };
}
