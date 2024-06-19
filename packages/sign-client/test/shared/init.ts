/* eslint-disable no-console */
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
    name: "A",
    ...TEST_SIGN_CLIENT_OPTIONS_A,
    ...sharedClientOpts,
    ...clientOptsA,
  });

  const B = await SignClient.init({
    name: "B",
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
  let clients: Clients;
  let pairingA;
  let sessionA;
  let retries = 0;
  while (!pairingA) {
    if (retries > TESTS_CONNECT_RETRIES) {
      throw new Error("Could not pair clients");
    }
    try {
      clients = (await createExpiringPromise(
        initTwoClients(clientOptsA, clientOptsB, sharedClientOpts),
        TESTS_CONNECT_TIMEOUT,
      )) as Clients;
      const settled: any = await createExpiringPromise(
        testConnectMethod(clients),
        TESTS_CONNECT_TIMEOUT * 2,
      );
      pairingA = settled.pairingA;
      sessionA = settled.sessionA;
    } catch (e) {
      console.error("Error initTwoPairedClients, attempts: ", retries, e);
    }
    retries++;
  }

  return { clients, pairingA, sessionA };
}
