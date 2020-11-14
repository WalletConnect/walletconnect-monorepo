import "mocha";
import { expect } from "chai";

import { SessionTypes, ClientOptions, ConnectionTypes } from "@walletconnect/types";

import Client from "../src";
import { CLIENT_EVENTS, SUBSCRIPTION_EVENTS } from "../src/constants";

// TODO: Relay Provider URL needs to be set from ops
const TEST_RELAY_PROVIDER_URL = "ws://localhost:5555";

const TEST_CLIENT_OPTIONS: ClientOptions = {
  logger: "trace",
  relayProvider: TEST_RELAY_PROVIDER_URL,
};

const TEST_PERMISSIONS_CHAIN_IDS: string[] = ["eip155:1"];
const TEST_PERMISSIONS_JSONRPC_METHODS: string[] = [
  "eth_sendTransaction",
  "eth_signTypedData",
  "personal_sign",
];

const TEST_PERMISSIONS: SessionTypes.Permissions = {
  blockchain: {
    chainIds: TEST_PERMISSIONS_CHAIN_IDS,
  },
  jsonrpc: {
    methods: TEST_PERMISSIONS_JSONRPC_METHODS,
  },
};

const TEST_APP_METADATA_A: SessionTypes.Metadata = {
  name: "App A (Proposer)",
  description: "Description of Proposer App run by client A",
  url: "#",
  icons: ["https://walletconnect.org/walletconnect-logo.png"],
};

const TEST_APP_METADATA_B: SessionTypes.Metadata = {
  name: "App B (Responder)",
  description: "Description of ResponderApp run by client B",
  url: "#",
  icons: ["https://walletconnect.org/walletconnect-logo.png"],
};

const TEST_SESSION_ACCOUNT_IDS = ["0x1d85568eEAbad713fBB5293B45ea066e552A90De@eip155:1"];

const TEST_SESSION_STATE = {
  accountIds: TEST_SESSION_ACCOUNT_IDS,
};

describe("Client", () => {
  it("instantiate successfully", async () => {
    const client = await Client.init(TEST_CLIENT_OPTIONS);
    expect(client).to.be.exist;
  });
  it("connect two clients", async () => {
    let sessionA: SessionTypes.Created | undefined;
    let sessionB: SessionTypes.Created | undefined;
    const before = Date.now();
    const clientA = await Client.init({ ...TEST_CLIENT_OPTIONS, overrideContext: "clientA" });
    const clientB = await Client.init({ ...TEST_CLIENT_OPTIONS, overrideContext: "clientB" });
    await Promise.all([
      new Promise(async (resolve, reject) => {
        await clientA.connect({
          metadata: TEST_APP_METADATA_A,
          permissions: TEST_PERMISSIONS,
        });
        resolve();
      }),
      new Promise(async (resolve, reject) => {
        clientA.on(
          CLIENT_EVENTS.connection.proposal,
          async (proposal: ConnectionTypes.Proposal) => {
            clientA.logger.warn(`TEST >> Connection Proposed`);
            await clientB.respond({ approved: true, uri: proposal.signal.params.uri });
            clientA.logger.warn(`TEST >> Connection Responded`);
            resolve();
          },
        );
      }),
      new Promise(async (resolve, reject) => {
        clientB.on(CLIENT_EVENTS.session.proposal, async (proposal: SessionTypes.Proposal) => {
          clientB.logger.warn(`TEST >> Session proposed`);
          await clientB.respond({
            approved: true,
            proposal,
            response: {
              state: TEST_SESSION_STATE,
              metadata: TEST_APP_METADATA_B,
            },
          });
          clientB.logger.warn(`TEST >> Session Responded`);
          resolve();
        });
      }),
      new Promise(async (resolve, reject) => {
        clientA.on(CLIENT_EVENTS.session.created, async (session: SessionTypes.Created) => {
          clientA.logger.warn(`TEST >> Session Created`);
          sessionA = session;
          resolve();
        });
      }),
      new Promise(async (resolve, reject) => {
        clientB.on(CLIENT_EVENTS.session.created, async (session: SessionTypes.Created) => {
          clientB.logger.warn(`TEST >> Session Created`);
          sessionB = session;
          resolve();
        });
      }),
      new Promise(async (resolve, reject) => {
        clientB.session.pending.on(SUBSCRIPTION_EVENTS.deleted, async () => {
          clientB.logger.warn(`TEST >> Session Acknowledged`);
          const elapsed = Date.now() - before;
          clientB.logger.warn(`TEST >> Elapsed ${elapsed}ms`);
          resolve();
        });
      }),
    ]);
    if (typeof sessionA === "undefined") throw new Error("Missing session for client A");
    if (typeof sessionB === "undefined") throw new Error("Missing session for client B");
    // session data
    expect(sessionA.topic).to.eql(sessionB.topic);
    expect(sessionA.relay.protocol).to.eql(sessionB.relay.protocol);
    expect(sessionA.peer.publicKey).to.eql(sessionB.self.publicKey);
    expect(sessionA.self.publicKey).to.eql(sessionB.peer.publicKey);
    expect(sessionA.peer.metadata).to.eql(TEST_APP_METADATA_B);
    expect(sessionB.peer.metadata).to.eql(TEST_APP_METADATA_A);
    // blockchain state
    expect(sessionA.state.accountIds).to.eql(TEST_SESSION_ACCOUNT_IDS);
    expect(sessionA.state.accountIds).to.eql(sessionB.state.accountIds);
    expect(sessionA.state.controller.publicKey).to.eql(sessionB.self.publicKey);
    expect(sessionB.state.controller.publicKey).to.eql(sessionB.self.publicKey);
    // blockchain permissions
    expect(sessionA.permissions.blockchain.chainIds).to.eql(TEST_PERMISSIONS_CHAIN_IDS);
    expect(sessionA.permissions.blockchain.chainIds).to.eql(
      sessionB.permissions.blockchain.chainIds,
    );
    // jsonrpc permmissions
    expect(sessionA.permissions.jsonrpc.methods).to.eql(TEST_PERMISSIONS_JSONRPC_METHODS);
    expect(sessionA.permissions.jsonrpc.methods).to.eql(sessionB.permissions.jsonrpc.methods);
  });
});
