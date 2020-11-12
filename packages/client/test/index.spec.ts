import "mocha";
import * as chai from "chai";

import { SessionTypes, ClientOptions } from "@walletconnect/types";

import Client from "../src";
import { CLIENT_EVENTS, SESSION_EVENTS } from "../src/constants";

// TODO: Relay Provider URL needs to be set from ops
const TEST_RELAY_PROVIDER_URL = "ws://localhost:5555";

const TEST_CLIENT_OPTIONS: ClientOptions = {
  logger: "debug",
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
    chai.expect(client).to.be.exist;
  });
  it("connect two clients", async () => {
    const before = Date.now();
    const clientA = await Client.init({ ...TEST_CLIENT_OPTIONS, overrideContext: "clientA" });
    const clientB = await Client.init({ ...TEST_CLIENT_OPTIONS, overrideContext: "clientB" });
    Promise.all([
      new Promise(async (resolve, reject) => {
        const session = await clientA.connect({
          metadata: TEST_APP_METADATA_A,
          permissions: TEST_PERMISSIONS,
        });
        console.log("Session connected"); // eslint-disable-line no-console
        chai.expect(session).to.be.true;
        resolve();
      }),
      new Promise(async (resolve, reject) => {
        clientA.on(CLIENT_EVENTS.share_uri, async ({ uri }) => {
          console.log("URI Shared"); // eslint-disable-line no-console

          const topic = await clientB.respond({ approved: true, uri });

          if (typeof topic === "undefined") {
            throw new Error("topic is undefined");
          }
          console.log("Connection Responded"); // eslint-disable-line no-console

          const connection = await clientB.connection.get(topic);
          chai.expect(connection).to.be.true;
          resolve();
        });
      }),
      new Promise(async (resolve, reject) => {
        clientB.on(SESSION_EVENTS.proposed, async (proposal: SessionTypes.Proposal) => {
          console.log("Session proposed"); // eslint-disable-line no-console
          const response: SessionTypes.Response = {
            state: TEST_SESSION_STATE,
            metadata: TEST_APP_METADATA_B,
          };
          const topic = await clientB.respond({
            approved: true,
            proposal,
            response,
          });
          if (typeof topic === "undefined") {
            throw new Error("topic is undefined");
          }
          const session = await clientB.session.get(topic);
          chai.expect(session).to.be.true;
          resolve();
        });
      }),
    ]);
    const after = Date.now();
    console.log("elapsed:", after - before, "ms"); // eslint-disable-line no-console
  });
});
