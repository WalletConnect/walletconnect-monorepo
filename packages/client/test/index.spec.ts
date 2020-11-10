import { SessionTypes } from "@walletconnect/types";

import Client from "../src";
import { CLIENT_EVENTS, SESSION_EVENTS } from "../src/constants";

// TODO: Relay Provider URL needs to be set from ops
const TEST_RELAY_PROVIDER_URL = "ws://localhost:5555";

const TEST_CLIENT_OPTIONS = { logger: "debug", relayProvider: TEST_RELAY_PROVIDER_URL };

const TEST_SESSION_CHAINS = ["eip155:1"];
const TEST_SESSION_METHODS = ["eth_sendTransaction", "eth_signTypedData", "personal_sign"];

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

const TEST_SESSION_ACCOUNTS = ["0x1d85568eEAbad713fBB5293B45ea066e552A90De@eip155:1"];

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
        async function onSharedUri({ uri }) {
          console.log("URI Shared"); // eslint-disable-line no-console

          clientB.on(SESSION_EVENTS.proposed, onSessionProposal);

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
        }

        async function onSessionProposal(proposal: SessionTypes.Proposal) {
          console.log("Session proposed"); // eslint-disable-line no-console
          // expect(proposal.proposer.metadata.toString()).toEqual(TEST_APP_METADATA_A.toString());
          // expect(proposal.setting.state.accounts.params.chains.toString()).toEqual(
          //   TEST_SESSION_CHAINS.toString(),
          // );
          // expect(proposal.setting.methods.toString()).toEqual(TEST_SESSION_METHODS.toString());
          const topic = await clientB.respond({
            approved: true,
            proposal,
            response: {
              app: TEST_APP_METADATA_B,
              accounts: TEST_SESSION_ACCOUNTS,
            },
          });
          if (typeof topic === "undefined") {
            throw new Error("topic is undefined");
          }
          const session = await clientB.session.get(topic);
          expect(session).toBeTruthy();
          expect(session.setting.state.accounts.data).toEqual(TEST_SESSION_ACCOUNTS);
          expect(session.setting.methods).toEqual(TEST_SESSION_METHODS);
          resolve();
        }

        clientA.on(CLIENT_EVENTS.share_uri, onSharedUri);
      }),
      new Promise(async (resolve, reject) => {
        const session = await clientA.connect({
          app: TEST_APP_METADATA_A,
          chains: TEST_SESSION_CHAINS,
          methods: TEST_SESSION_METHODS,
        });
        console.log("Session connected"); // eslint-disable-line no-console
        expect(session).toBeTruthy();
        expect(session.setting.state.accounts.data.toString()).toEqual(
          TEST_SESSION_ACCOUNTS.toString(),
        );
        expect(session.setting.methods.toString()).toEqual(TEST_SESSION_METHODS.toString());
      }),
    ]);
  });
});
