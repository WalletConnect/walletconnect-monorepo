import { Client } from "../../src";

import {
  TEST_CLIENT_OPTIONS,
  TEST_PERMISSIONS,
  TEST_APP_METADATA_A,
  TEST_SESSION_STATE,
  TEST_APP_METADATA_B,
  TEST_ETHEREUM_CHAIN_ID,
  TEST_PERMISSIONS_CHAINS,
} from "./values";
import { ClientSetup, ClientSetupMap, CientSetupInitialized, ClientSetupOptions } from "./types";

export function generateClientSetup(
  label: string,
  clients?: ClientSetupMap,
  sharedSetup?: ClientSetup,
): Required<ClientSetup> {
  const clientSetup = typeof clients !== "undefined" ? clients[label] : undefined;
  const metadata = label === "a" ? TEST_APP_METADATA_A : TEST_APP_METADATA_B;
  const controller = label === "a" ? false : true;
  const name = "client" + "_" + label.toUpperCase();
  // console.log("sharedSetup?.permissions", sharedSetup?.permissions?.blockchain?.chains); // eslint-disable-line
  // console.log("TEST_ETHEREUM_CHAIN_ID", TEST_ETHEREUM_CHAIN_ID); // eslint-disable-line
  // console.log("TEST_PERMISSIONS_CHAINS", TEST_PERMISSIONS_CHAINS); // eslint-disable-line
  // console.log("TEST_PERMISSIONS", TEST_PERMISSIONS?.blockchain?.chains); // eslint-disable-line
  const defaultSetup = {
    options: { ...TEST_CLIENT_OPTIONS, ...sharedSetup?.options, name, metadata, controller },
    state: { ...TEST_SESSION_STATE, ...sharedSetup?.state },
    permissions: { ...TEST_PERMISSIONS, ...sharedSetup?.permissions },
  };
  // console.log("defaultSetup.permissions", defaultSetup.permissions?.blockchain?.chains); // eslint-disable-line
  // console.log("clientSetup?.permissions", clientSetup?.permissions?.blockchain?.chains); // eslint-disable-line
  return typeof clientSetup !== "undefined"
    ? {
        options: { ...defaultSetup.options, ...clientSetup.options },
        state: { ...defaultSetup.state, ...clientSetup.state },
        permissions: { ...defaultSetup.permissions, ...clientSetup.permissions },
      }
    : defaultSetup;
}

export async function setupClientsForTesting(
  opts?: ClientSetupOptions,
): Promise<CientSetupInitialized> {
  // console.log("opts", opts); // eslint-disable-line
  //  generate client setup
  const setup = {
    a: generateClientSetup("a", opts?.setup, opts?.shared),
    b: generateClientSetup("b", opts?.setup, opts?.shared),
  };
  // console.log("setup.a", setup.a.permissions.blockchain.chains); // eslint-disable-line
  // console.log("setup.a", setup.b.permissions.blockchain.chains); // eslint-disable-line
  // init clients
  const clients = opts?.clients || {
    a: await Client.init(setup.a.options),
    b: await Client.init(setup.b.options),
  };

  return { setup, clients };
}
