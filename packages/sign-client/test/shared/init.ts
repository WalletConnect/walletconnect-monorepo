import { PairingTypes, SessionTypes, SignClientTypes } from "@walletconnect/types";
import { createExpiringPromise } from "@walletconnect/utils";
import { testConnectMethod } from ".";
import SignClient from "../../src";
import { deleteClients, throttle } from "./helpers";
import {
  TESTS_CONNECT_RETRIES,
  TESTS_CONNECT_TIMEOUT,
  TEST_SIGN_CLIENT_OPTIONS_A,
  TEST_SIGN_CLIENT_OPTIONS_B,
} from "./values";

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
  await throttle(500);
  return { A, B };
}

export async function initTwoPairedClients(
  clientOptsA: SignClientTypes.Options = {},
  clientOptsB: SignClientTypes.Options = {},
  sharedClientOpts: SignClientTypes.Options = {},
) {
  let clients = await initTwoClients(clientOptsA, clientOptsB, sharedClientOpts);
  let pairingA;
  let sessionA;
  let retries = 0;
  while (!pairingA) {
    if (retries > TESTS_CONNECT_RETRIES) {
      throw new Error("Could not pair clients");
    }
    try {
      const settled: any = await createExpiringPromise(
        testConnectMethod(clients),
        TESTS_CONNECT_TIMEOUT,
      );
      pairingA = settled.pairingA;
      sessionA = settled.sessionA;
    } catch (e) {
      clients.A.logger.error("retrying", e);
      await deleteClients(clients);
      clients = await initTwoClients();
    }
    retries++;
  }

  return { clients, pairingA, sessionA };
}
