import { Client } from "../../src";

import { expect } from "./chai";
import {
  TEST_CLIENT_OPTIONS,
  TEST_PERMISSIONS,
  TEST_APP_METADATA_A,
  TEST_SESSION_STATE,
  TEST_APP_METADATA_B,
} from "./values";
import {
  ClientSetup,
  ClientSetupMap,
  SessionScenarioInitialized,
  SessionScenarioSetup,
} from "./types";

export function generateClientSetup(
  label: string,
  clients?: ClientSetupMap,
): Required<ClientSetup> {
  const clientSetup = typeof clients !== "undefined" ? clients[label] : undefined;
  const overrideContext = "client" + "_" + label.toUpperCase();
  const defaultSetup = {
    options: { ...TEST_CLIENT_OPTIONS, overrideContext },
    state: TEST_SESSION_STATE,
    metadata: label === "a" ? TEST_APP_METADATA_A : TEST_APP_METADATA_B,
    permissions: TEST_PERMISSIONS,
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
  opts?: SessionScenarioSetup,
): Promise<SessionScenarioInitialized> {
  //  generate client setup
  const setup = {
    a: generateClientSetup("a", opts?.setup),
    b: generateClientSetup("b", opts?.setup),
  };
  // init clients
  const clients = opts?.clients || {
    a: await Client.init(setup.a.options),
    b: await Client.init(setup.a.options),
  };
  return { setup, clients };
}
