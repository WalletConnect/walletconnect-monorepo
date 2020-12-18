import "mocha";
import { expect } from "chai";
import Timestamp from "@pedrouid/timestamp";
import { SessionTypes, ConnectionTypes, ClientOptions } from "@walletconnect/types";

import {
  TEST_CLIENT_OPTIONS,
  TEST_PERMISSIONS,
  TEST_APP_METADATA_A,
  TEST_SESSION_STATE,
  TEST_APP_METADATA_B,
} from "./values";

import Client, { CLIENT_EVENTS, SUBSCRIPTION_EVENTS } from "../../src";
import { IntializedClients } from "./types";

interface ClientSetupOptions {
  options?: ClientOptions;
  state?: SessionTypes.State;
  metadata?: SessionTypes.Metadata;
  permissions?: SessionTypes.BasePermissions;
}

type ClientSetupOptionsMap = Record<string, ClientSetupOptions>;

interface SessionScenarioOptions {
  clients?: ClientSetupOptionsMap;
  rejectSession?: boolean;
}

interface SessionScenarioResult {
  topic: string;
  clients: IntializedClients;
}

function generateClientSetupOptions(
  label: string,
  clients?: ClientSetupOptionsMap,
): Required<ClientSetupOptions> {
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
  opts?: SessionScenarioOptions,
): Promise<SessionScenarioResult> {
  //  generate client setup for scenario
  const clientASetup = generateClientSetupOptions("a", opts?.clients);
  const clientBSetup = generateClientSetupOptions("b", opts?.clients);
  // generate user scenario
  const userApprovedSession = !opts?.rejectSession;

  // init clients
  const clientA = await Client.init(clientASetup.options);
  const clientB = await Client.init(clientBSetup.options);

  if (userApprovedSession) {
    return testSessionApprovalScenario(
      { a: clientASetup, b: clientBSetup },
      { a: clientA, b: clientB },
    );
  } else {
    return testSessionRejectionScenario(
      { a: clientASetup, b: clientBSetup },
      { a: clientA, b: clientB },
    );
  }
}

async function testSessionApprovalScenario(
  setup: Record<string, Required<ClientSetupOptions>>,
  clients: IntializedClients,
): Promise<SessionScenarioResult> {
  const { a: clientASetup, b: clientBSetup } = setup;
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
        metadata: clientASetup.metadata,
        permissions: clientASetup.permissions,
      });
      time.stop("connect");
      resolve();
    }),
    new Promise<void>(async (resolve, reject) => {
      // Client A shares connection proposal out-of-band with Client B
      clientA.on(CLIENT_EVENTS.connection.proposal, async (proposal: ConnectionTypes.Proposal) => {
        clientB.logger.warn(`TEST >> Connection Proposal`);
        await clientB.tether({ uri: proposal.signal.params.uri });
        clientB.logger.warn(`TEST >> Connection Responded`);
        resolve();
      });
    }),
    new Promise<void>(async (resolve, reject) => {
      clientB.on(CLIENT_EVENTS.session.proposal, async (proposal: SessionTypes.Proposal) => {
        clientB.logger.warn(`TEST >> Session Proposal`);
        const response: SessionTypes.Response = {
          state: clientBSetup.state,
          metadata: clientBSetup.metadata,
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
      clientA.connection.pending.on(SUBSCRIPTION_EVENTS.created, async () => {
        clientA.logger.warn(`TEST >> Connection Proposed`);
        time.start("connection");
        resolve();
      });
    }),
    new Promise<void>(async (resolve, reject) => {
      clientB.connection.pending.on(SUBSCRIPTION_EVENTS.deleted, async () => {
        clientB.logger.warn(`TEST >> Connection Acknowledged`);
        time.stop("connection");
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
  clientB.logger.warn(`TEST >> Connection Elapsed Time: ${time.elapsed("connection")}ms`);
  clientB.logger.warn(`TEST >> Session Elapsed Time: ${time.elapsed("session")}ms`);
  clientB.logger.warn(`TEST >> Connect Elapsed Time: ${time.elapsed("connect")}ms`);

  // session data
  expect(sessionA?.topic).to.eql(sessionB?.topic);
  expect(sessionA?.relay.protocol).to.eql(sessionB?.relay.protocol);
  expect(sessionA?.peer.publicKey).to.eql(sessionB?.self.publicKey);
  expect(sessionA?.self.publicKey).to.eql(sessionB?.peer.publicKey);
  expect(sessionA?.peer.metadata).to.eql(clientBSetup.metadata);
  expect(sessionB?.peer.metadata).to.eql(clientASetup.metadata);
  // blockchain state
  expect(sessionA?.state.accountIds).to.eql(clientBSetup.state.accountIds);
  expect(sessionA?.state.accountIds).to.eql(sessionB?.state.accountIds);
  // blockchain permissions
  expect(sessionA?.permissions.state.controller.publicKey).to.eql(sessionB?.self.publicKey);
  expect(sessionB?.permissions.state.controller.publicKey).to.eql(sessionB?.self.publicKey);
  expect(sessionA?.permissions.notifications.controller.publicKey).to.eql(sessionB?.self.publicKey);
  expect(sessionB?.permissions.notifications.controller.publicKey).to.eql(sessionB?.self.publicKey);
  expect(sessionA?.permissions.blockchain.chainIds).to.eql(
    clientBSetup.permissions.blockchain.chainIds,
  );
  expect(sessionA?.permissions.blockchain.chainIds).to.eql(
    sessionB?.permissions.blockchain.chainIds,
  );
  // jsonrpc permmissions
  expect(sessionA?.permissions.jsonrpc.methods).to.eql(clientBSetup.permissions.jsonrpc.methods);
  expect(sessionA?.permissions.jsonrpc.methods).to.eql(sessionB?.permissions.jsonrpc.methods);

  return { topic: sessionA?.topic || "", clients: { a: clientA, b: clientB } };
}

async function testSessionRejectionScenario(
  setup: Record<string, Required<ClientSetupOptions>>,
  clients: IntializedClients,
): Promise<SessionScenarioResult> {
  const { a: clientASetup, b: clientBSetup } = setup;
  const { a: clientA, b: clientB } = clients;

  // testing data points
  let sessionA: SessionTypes.Created | undefined;
  let sessionB: SessionTypes.Created | undefined;

  // timestamps & elapsed time
  const time = new Timestamp();

  await Promise.all([
    new Promise<void>(async (resolve, reject) => {
      time.start("connect");
      try {
        await clientA.connect({
          metadata: clientASetup.metadata,
          permissions: clientASetup.permissions,
        });
        time.stop("connect");
        resolve();
      } catch (e) {
        // ignore error
        time.stop("connect");
        resolve();
      }
    }),
    new Promise<void>(async (resolve, reject) => {
      // Client A shares connection proposal out-of-band with Client B
      clientA.on(CLIENT_EVENTS.connection.proposal, async (proposal: ConnectionTypes.Proposal) => {
        clientB.logger.warn(`TEST >> Connection Proposal`);
        await clientB.tether({ uri: proposal.signal.params.uri });
        clientB.logger.warn(`TEST >> Connection Responded`);
        resolve();
      });
    }),
    new Promise<void>(async (resolve, reject) => {
      clientB.on(CLIENT_EVENTS.session.proposal, async (proposal: SessionTypes.Proposal) => {
        clientB.logger.warn(`TEST >> Session Proposal`);

        await clientB.reject({ proposal });
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
      clientA.connection.pending.on(SUBSCRIPTION_EVENTS.created, async () => {
        clientA.logger.warn(`TEST >> Connection Proposed`);
        time.start("connection");
        resolve();
      });
    }),
    new Promise<void>(async (resolve, reject) => {
      clientB.connection.pending.on(SUBSCRIPTION_EVENTS.deleted, async () => {
        clientB.logger.warn(`TEST >> Connection Acknowledged`);
        time.stop("connection");
        resolve();
      });
    }),
  ]);

  expect(sessionA).to.be.undefined;
  expect(sessionB).to.be.undefined;

  return { topic: "", clients: { a: clientA, b: clientB } };
}
