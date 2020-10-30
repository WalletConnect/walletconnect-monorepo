import Logger from "pino";
import { SessionTypes } from "@walletconnect/types";

import Client from "../src";
import { CLIENT_EVENTS, SESSION_EVENTS } from "../src/constants";
import { getLoggerOptions } from "@walletconnect/utils";

const TEST_RELAY_PROVIDER_URL = "ws://localhost:5555";

const TEST_CLIENT_OPTIONS = { logger: "trace", relayProvider: TEST_RELAY_PROVIDER_URL };

const TEST_SESSION_CHAINS = ["eip155:1"];
const TEST_SESSION_JSONRPC = ["eth_sendTransaction", "eth_signTypedData", "personal_sign"];

const TEST_APP_METADATA_A: SessionTypes.Metadata = {
  name: "App A",
  description: "Description of App run by client A",
  url: "#",
  icons: ["https://walletconnect.org/walletconnect-logo.png"],
};

const TEST_APP_METADATA_B: SessionTypes.Metadata = {
  name: "App B",
  description: "Description of App run by client B",
  url: "#",
  icons: ["https://walletconnect.org/walletconnect-logo.png"],
};

const TEST_SESSION_STATE = {
  accounts: ["0x1d85568eEAbad713fBB5293B45ea066e552A90De@eip155:1"],
};

describe("Client", () => {
  it("instantiate successfully", async () => {
    const client = await Client.init(TEST_CLIENT_OPTIONS);
    expect(client).toBeTruthy();
  });
  it("connect two clients", async () => {
    const clientA = await Client.init({ ...TEST_CLIENT_OPTIONS, overrideContext: "clientA" });
    const clientB = await Client.init({ ...TEST_CLIENT_OPTIONS, overrideContext: "clientB" });
    await Promise.all([
      new Promise(async (resolve, reject) => {
        clientA.on(CLIENT_EVENTS.share_uri, async ({ uri }) => {
          const topic = await clientB.respond({
            approved: true,
            proposal: uri,
          });

          if (typeof topic === "undefined") {
            throw new Error("topic is undefined");
          }
          const connection = await clientB.connection.get(topic);
          expect(connection).toBeTruthy();
          resolve();
        });
      }),
      new Promise(async (resolve, reject) => {
        clientB.on(SESSION_EVENTS.proposed, async (proposal: SessionTypes.Proposal) => {
          expect(proposal.peer.metadata).toEqual(TEST_APP_METADATA_A);
          expect(proposal.stateParams.chains).toEqual(TEST_SESSION_CHAINS);
          expect(proposal.ruleParams.jsonrpc).toEqual(TEST_SESSION_JSONRPC);
          const topic = await clientB.respond({
            approved: true,
            proposal,
            response: {
              app: TEST_APP_METADATA_B,
              state: TEST_SESSION_STATE,
            },
          });
          if (typeof topic === "undefined") {
            throw new Error("topic is undefined");
          }
          const session = await clientB.connection.get(topic);
          expect(session).toBeTruthy();
          expect(session.state).toEqual(TEST_SESSION_STATE);
          expect(session.rules.jsonrpc).toEqual(TEST_SESSION_JSONRPC);
        });
      }),
      new Promise(async (resolve, reject) => {
        const session = await clientA.connect({
          app: TEST_APP_METADATA_A,
          chains: TEST_SESSION_CHAINS,
          jsonrpc: TEST_SESSION_JSONRPC,
        });
        expect(session).toBeTruthy();
        expect(session.state).toEqual(TEST_SESSION_STATE);
        expect(session.rules.jsonrpc).toEqual(TEST_SESSION_JSONRPC);
      }),
    ]);
  });
});
