import { SessionTypes, ClientOptions, SignalTypes } from "@walletconnect/types";

import {
  TEST_CLIENT_OPTIONS,
  TEST_PERMISSIONS,
  TEST_APP_METADATA_A,
  TEST_SESSION_STATE,
  TEST_APP_METADATA_B,
} from "./values";

import { Client } from "../../src";

import { InitializedClients } from "./types";

interface ClientSetup {
  options?: ClientOptions;
  state?: SessionTypes.State;
  metadata?: SessionTypes.Metadata;
  permissions?: SessionTypes.BasePermissions;
}

type ClientSetupMap = Record<string, ClientSetup>;
type InitializedSetup = Record<string, Required<ClientSetup>>;

interface SessionScenarioInitialized {
  clients: InitializedClients;
  setup: InitializedSetup;
}

interface SessionScenarioSetup {
  clients?: InitializedClients;
  setup?: ClientSetupMap;
  pairing?: SignalTypes.ParamsPairing;
  scenario?: string;
}

interface SessionScenarioResult {
  topic: string;
  clients: InitializedClients;
}

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
