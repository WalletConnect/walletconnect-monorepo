import "mocha";
import { use, expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import Timestamp from "@pedrouid/timestamp";
import { SessionTypes, PairingTypes, ClientOptions, SignalTypes } from "@walletconnect/types";

import {
  TEST_CLIENT_OPTIONS,
  TEST_PERMISSIONS,
  TEST_APP_METADATA_A,
  TEST_SESSION_STATE,
  TEST_APP_METADATA_B,
} from "./values";

import Client, { CLIENT_EVENTS, SUBSCRIPTION_EVENTS } from "../../src";
import { IntializedClients } from "./types";

use(chaiAsPromised);

interface ClientSetup {
  options?: ClientOptions;
  state?: SessionTypes.State;
  metadata?: SessionTypes.Metadata;
  permissions?: SessionTypes.BasePermissions;
}

type ClientSetupMap = Record<string, ClientSetup>;

interface SessionScenarioSetup {
  clients?: IntializedClients;
  setup?: ClientSetupMap;
  pairing?: SignalTypes.ParamsPairing;
  rejectSession?: boolean;
}

interface SessionScenarioResult {
  topic: string;
  clients: IntializedClients;
}

function generateClientSetup(label: string, clients?: ClientSetupMap): Required<ClientSetup> {
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

export async function testSessionScenarios(
  opts?: SessionScenarioSetup,
): Promise<SessionScenarioResult> {
  //  generate client setup for scenario
  const setup = {
    a: generateClientSetup("a", opts?.setup),
    b: generateClientSetup("b", opts?.setup),
  };
  // init clients
  const clients = opts?.clients || {
    a: await Client.init(setup.a.options),
    b: await Client.init(setup.a.options),
  };

  if (!opts?.rejectSession) {
    return testSessionApprovalScenario(setup, clients, opts?.pairing);
  } else {
    return testSessionRejectionScenario(setup, clients, opts?.pairing);
  }
}

async function testSessionApprovalScenario(
  setup: Record<string, Required<ClientSetup>>,
  clients: IntializedClients,
  pairing?: SignalTypes.ParamsPairing,
): Promise<SessionScenarioResult> {
  const { a: clientA, b: clientB } = clients;

  // testing data points
  let sessionA: SessionTypes.Created | undefined;
  let sessionB: SessionTypes.Created | undefined;

  // timestamps & elapsed time
  const time = new Timestamp();

  // connect two clients
  await Promise.all([
    new Promise<void>(async (resolve, reject) => {
      time.start("connect");
      await clientA.connect({
        metadata: setup.a.metadata,
        permissions: setup.a.permissions,
        pairing,
      });
      time.stop("connect");
      resolve();
    }),
    new Promise<void>(async (resolve, reject) => {
      if (typeof pairing !== "undefined") {
        return resolve();
      }
      // Client A shares pairing proposal out-of-band with Client B
      clientA.on(CLIENT_EVENTS.pairing.proposal, async (proposal: PairingTypes.Proposal) => {
        clientB.logger.warn(`TEST >> Pairing Proposal`);
        await clientB.pair({ uri: proposal.signal.params.uri });
        clientB.logger.warn(`TEST >> Pairing Responded`);
        resolve();
      });
    }),
    new Promise<void>(async (resolve, reject) => {
      clientB.on(CLIENT_EVENTS.session.proposal, async (proposal: SessionTypes.Proposal) => {
        clientB.logger.warn(`TEST >> Session Proposal`);
        const response: SessionTypes.Response = {
          state: setup.b.state,
          metadata: setup.b.metadata,
        };
        await clientB.approve({ proposal, response });
        clientB.logger.warn(`TEST >> Session Responded`);
        resolve();
      });
    }),

    new Promise<void>(async (resolve, reject) => {
      clientA.on(CLIENT_EVENTS.session.created, async (session: SessionTypes.Created) => {
        clientA.logger.warn(`TEST >> Session Created`);
        sessionA = session;
        resolve();
      });
    }),
    new Promise<void>(async (resolve, reject) => {
      clientB.on(CLIENT_EVENTS.session.created, async (session: SessionTypes.Created) => {
        clientB.logger.warn(`TEST >> Session Created`);
        sessionB = session;
        resolve();
      });
    }),
    new Promise<void>(async (resolve, reject) => {
      if (typeof pairing !== "undefined") {
        return resolve();
      }
      clientA.pairing.pending.on(SUBSCRIPTION_EVENTS.created, async () => {
        clientA.logger.warn(`TEST >> Pairing Proposed`);
        time.start("pairing");
        resolve();
      });
    }),
    new Promise<void>(async (resolve, reject) => {
      if (typeof pairing !== "undefined") {
        return resolve();
      }
      clientB.pairing.pending.on(SUBSCRIPTION_EVENTS.deleted, async () => {
        clientB.logger.warn(`TEST >> Pairing Acknowledged`);
        time.stop("pairing");
        resolve();
      });
    }),
    new Promise<void>(async (resolve, reject) => {
      clientA.session.pending.on(SUBSCRIPTION_EVENTS.created, async () => {
        clientA.logger.warn(`TEST >> Session Proposed`);
        time.start("session");
        resolve();
      });
    }),
    new Promise<void>(async (resolve, reject) => {
      clientB.session.pending.on(SUBSCRIPTION_EVENTS.deleted, async () => {
        clientB.logger.warn(`TEST >> Session Acknowledged`);
        time.stop("session");
        resolve();
      });
    }),
  ]);

  // log elapsed times
  if (typeof pairing === "undefined") {
    clientB.logger.warn(`TEST >> Pairing Elapsed Time: ${time.elapsed("pairing")}ms`);
  }
  clientB.logger.warn(`TEST >> Session Elapsed Time: ${time.elapsed("session")}ms`);
  clientB.logger.warn(`TEST >> Connect Elapsed Time: ${time.elapsed("connect")}ms`);

  // session data
  expect(sessionA?.topic).to.eql(sessionB?.topic);
  expect(sessionA?.relay.protocol).to.eql(sessionB?.relay.protocol);
  expect(sessionA?.peer.publicKey).to.eql(sessionB?.self.publicKey);
  expect(sessionA?.self.publicKey).to.eql(sessionB?.peer.publicKey);
  expect(sessionA?.peer.metadata).to.eql(setup.b.metadata);
  expect(sessionB?.peer.metadata).to.eql(setup.a.metadata);
  // blockchain state
  expect(sessionA?.state.accountIds).to.eql(setup.b.state.accountIds);
  expect(sessionA?.state.accountIds).to.eql(sessionB?.state.accountIds);
  // blockchain permissions
  expect(sessionA?.permissions.state.controller.publicKey).to.eql(sessionB?.self.publicKey);
  expect(sessionB?.permissions.state.controller.publicKey).to.eql(sessionB?.self.publicKey);
  expect(sessionA?.permissions.notifications.controller.publicKey).to.eql(sessionB?.self.publicKey);
  expect(sessionB?.permissions.notifications.controller.publicKey).to.eql(sessionB?.self.publicKey);
  expect(sessionA?.permissions.blockchain.chainIds).to.eql(setup.b.permissions.blockchain.chainIds);
  expect(sessionA?.permissions.blockchain.chainIds).to.eql(
    sessionB?.permissions.blockchain.chainIds,
  );
  // jsonrpc permmissions
  expect(sessionA?.permissions.jsonrpc.methods).to.eql(setup.b.permissions.jsonrpc.methods);
  expect(sessionA?.permissions.jsonrpc.methods).to.eql(sessionB?.permissions.jsonrpc.methods);

  return { topic: sessionA?.topic || "", clients: { a: clientA, b: clientB } };
}

async function testSessionRejectionScenario(
  setup: Record<string, Required<ClientSetup>>,
  clients: IntializedClients,
  pairing?: SignalTypes.ParamsPairing,
): Promise<SessionScenarioResult> {
  const { a: clientA, b: clientB } = clients;

  await Promise.all([
    new Promise<void>(async (resolve, reject) => {
      const promise = clientA.connect({
        metadata: setup.a.metadata,
        permissions: setup.a.permissions,
        pairing,
      });
      // FIXME: chai-as-promised assertions are not typed hence need to be ignored
      // @ts-ignore
      await expect(promise).to.eventually.be.rejectedWith("Session not approved");
      resolve();
    }),
    new Promise<void>(async (resolve, reject) => {
      if (typeof pairing !== "undefined") {
        return resolve();
      }
      // Client A shares pairing proposal out-of-band with Client B
      clientA.on(CLIENT_EVENTS.pairing.proposal, async (proposal: PairingTypes.Proposal) => {
        clientB.logger.warn(`TEST >> Pairing Proposal`);
        await clientB.pair({ uri: proposal.signal.params.uri });
        clientB.logger.warn(`TEST >> Pairing Responded`);
        resolve();
      });
    }),
    // Client B receives session proposal and rejects it
    new Promise<void>(async (resolve, reject) => {
      clientB.on(CLIENT_EVENTS.session.proposal, async (proposal: SessionTypes.Proposal) => {
        clientB.logger.warn(`TEST >> Session Proposal`);
        await clientB.reject({ proposal });
        clientB.logger.warn(`TEST >> Session Responded`);
        resolve();
      });
    }),
  ]);

  return { topic: "", clients: { a: clientA, b: clientB } };
}
