import { Client } from "../../src";

import {
  TEST_CLIENT_OPTIONS,
  TEST_PERMISSIONS,
  TEST_APP_METADATA_A,
  TEST_SESSION_STATE,
  TEST_APP_METADATA_B,
} from "./values";
import { ClientSetup, ClientSetupMap, CientSetupInitialized, ClientSetupOptions } from "./types";

export function generateClientSetup(
  label: string,
  clients?: ClientSetupMap,
  sharedSetup?: ClientSetup,
): Required<ClientSetup> {
  const clientSetup = typeof clients !== "undefined" ? clients[label] : undefined;
  const clientMetdata = label === "a" ? TEST_APP_METADATA_A : TEST_APP_METADATA_B;
  const overrideContext = "client" + "_" + label.toUpperCase();
  const defaultSetup = {
    options: { ...TEST_CLIENT_OPTIONS, ...sharedSetup?.options, overrideContext },
    state: { ...TEST_SESSION_STATE, ...sharedSetup?.state },
    metadata: { ...clientMetdata, ...sharedSetup?.metadata },
    permissions: { ...TEST_PERMISSIONS, ...sharedSetup?.permissions },
  };
  return typeof clientSetup !== "undefined"
    ? {
        options: { ...defaultSetup.options, ...clientSetup.options },
        state: { ...defaultSetup.state, ...clientSetup.state },
        metadata: { ...defaultSetup.metadata, ...clientSetup.metadata },
        permissions: { ...defaultSetup.permissions, ...clientSetup.permissions },
      }
    : defaultSetup;
}

export async function setupClientsForTesting(
  opts?: ClientSetupOptions,
): Promise<CientSetupInitialized> {
  //  generate client setup
  const setup = {
    a: generateClientSetup("a", opts?.setup, opts?.shared),
    b: generateClientSetup("b", opts?.setup, opts?.shared),
  };
  // init clients
  const clients = opts?.clients || {
    a: await Client.init(setup.a.options),
    b: await Client.init(setup.a.options),
  };
  return { setup, clients };
}
