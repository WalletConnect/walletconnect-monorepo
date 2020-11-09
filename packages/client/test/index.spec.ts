import { SessionTypes } from "@walletconnect/types";

import Client from "../src";
import { CLIENT_EVENTS, SESSION_EVENTS } from "../src/constants";

// TODO: Relay Provider URL needs to be set from ops
const TEST_RELAY_PROVIDER_URL = "ws://localhost:5555";

const TEST_CLIENT_OPTIONS = { logger: "debug", relayProvider: TEST_RELAY_PROVIDER_URL };

const TEST_SESSION_CHAINS = ["eip155:1"];
const TEST_SESSION_JSONRPC = ["eth_sendTransaction", "eth_signTypedData", "personal_sign"];

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

const TEST_SESSION_STATE = {
  accounts: ["0x1d85568eEAbad713fBB5293B45ea066e552A90De@eip155:1"],
};

describe("Client", () => {
  // it("instantiate successfully", async () => {
  //   const client = await Client.init(TEST_CLIENT_OPTIONS);
  //   expect(client).toBeTruthy();
  // });
  it("connect two clients", async () => {
    const clientA = await Client.init({ ...TEST_CLIENT_OPTIONS, overrideContext: "clientA" });
    const clientB = await Client.init({ ...TEST_CLIENT_OPTIONS, overrideContext: "clientB" });
    await Promise.all([
      new Promise(async (resolve, reject) => {
        clientA.on(CLIENT_EVENTS.share_uri, async ({ uri }) => {
          console.log("URI Shared"); // eslint-disable-line no-console

          clientB.on(SESSION_EVENTS.proposed, async (proposal: SessionTypes.Proposal) => {
            console.log("Session proposed"); // eslint-disable-line no-console
            expect(proposal.proposer.metadata).toEqual(TEST_APP_METADATA_A);
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
            const session = await clientB.session.get(topic);
            expect(session).toBeTruthy();
            expect(session.state.accounts).toEqual(TEST_SESSION_STATE.accounts);
            expect(session.rules.jsonrpc).toEqual(TEST_SESSION_JSONRPC);
            resolve();
          });

          const topic = await clientB.respond({
            approved: true,
            proposal: uri,
          });

          if (typeof topic === "undefined") {
            throw new Error("topic is undefined");
          }
          console.log("Connection Responded"); // eslint-disable-line no-console

          const connection = await clientB.connection.get(topic);
          expect(connection).toBeTruthy();
        });
      }),
      new Promise(async (resolve, reject) => {
        const session = await clientA.connect({
          app: TEST_APP_METADATA_A,
          chains: TEST_SESSION_CHAINS,
          jsonrpc: TEST_SESSION_JSONRPC,
        });
        expect(session).toBeTruthy();
        expect(session.state.accounts).toEqual(TEST_SESSION_STATE.accounts);
        expect(session.rules.jsonrpc).toEqual(TEST_SESSION_JSONRPC);
      }),
    ]);
  });
});
