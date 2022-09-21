import { getSdkError, parseUri } from "@walletconnect/utils";
import { expect, describe, it, beforeEach, afterEach } from "vitest";
import SignClient from "../../src";
import {
  initTwoClients,
  testConnectMethod,
  TEST_SIGN_CLIENT_OPTIONS,
  deleteClients,
  TEST_NAMESPACES,
  TEST_REQUIRED_NAMESPACES,
  TEST_EMIT_PARAMS,
} from "../shared";
import { EngineTypes, PairingTypes, SessionTypes } from "@walletconnect/types";

describe("Sign Client Events Validation", () => {
  it("init", async () => {
    const client = await SignClient.init(TEST_SIGN_CLIENT_OPTIONS);
    expect(client).to.be.exist;
  });

  describe("session", () => {
    let clients;
    beforeEach(async () => {
      clients = await initTwoClients();
    });
    afterEach(async (done) => {
      const { result } = done.meta;
      if (result?.state.toString() !== "pass") {
        console.log(
          `Test ${
            done.meta.name
          } failed with client ids: A:'${await clients.A.core.crypto.getClientId()}';B:'${await clients.B.core.crypto.getClientId()}'`,
        );
      }
    });
    describe("session_proposal", () => {
      it("emits and handles a valid session_proposal", async () => {
        const { A, B } = clients;

        const connectParams: EngineTypes.ConnectParams = {
          requiredNamespaces: TEST_REQUIRED_NAMESPACES,
          relays: undefined,
          pairingTopic: undefined,
        };

        const approveParams: Omit<EngineTypes.ApproveParams, "id"> = {
          namespaces: TEST_NAMESPACES,
        };

        const { uri, approval } = await A.connect(connectParams);

        let pairingA: PairingTypes.Struct | undefined;
        let pairingB: PairingTypes.Struct | undefined;

        if (!uri) throw new Error("uri is missing");

        const uriParams = parseUri(uri);

        // eslint-disable-next-line prefer-const
        pairingA = A.pairing.get(uriParams.topic);
        expect(pairingA.topic).to.eql(uriParams.topic);
        expect(pairingA.relay).to.eql(uriParams.relay);

        if (!pairingA) throw new Error("expect pairing A to be defined");

        let sessionA: SessionTypes.Struct;
        let sessionB: SessionTypes.Struct;

        await Promise.all([
          new Promise<void>((resolve, reject) => {
            B.once("session_proposal", async (proposal) => {
              try {
                expect(proposal.params.requiredNamespaces).to.eql(connectParams.requiredNamespaces);
                const { acknowledged } = await B.approve({
                  id: proposal.id,
                  ...approveParams,
                });
                if (!sessionB) {
                  sessionB = await acknowledged();
                }
                resolve();
              } catch (e) {
                reject(e);
              }
            });
          }),
          new Promise<void>(async (resolve, reject) => {
            try {
              if (uri) {
                pairingB = await B.pair({ uri });
                if (!pairingA) throw new Error("pairingA is missing");
                expect(pairingB.topic).to.eql(pairingA.topic);
                expect(pairingB.relay).to.eql(pairingA.relay);
                resolve();
              } else {
                reject(new Error("missing uri"));
              }
            } catch (error) {
              reject(error);
            }
          }),
          new Promise<void>(async (resolve, reject) => {
            try {
              if (!sessionA) {
                sessionA = await approval();
              }
              resolve();
            } catch (error) {
              reject(error);
            }
          }),
        ]);

        deleteClients(clients);
      });
    });
    describe("session_update", () => {
      it("emits and handles a valid session_update", async () => {
        const { sessionA } = await testConnectMethod(clients);

        await new Promise<void>(async (resolve, reject) => {
          try {
            const namespacesBefore = sessionA.namespaces;
            const namespacesAfter = {
              ...namespacesBefore,
              eip9001: {
                accounts: ["eip9001:1:0x000000000000000000000000000000000000dead"],
                methods: ["eth_sendTransaction"],
                events: ["accountsChanged"],
              },
            };

            clients.B.once("session_update", () => {
              expect(clients.A.session.get(sessionA.topic).namespaces).to.eql(namespacesAfter);
              resolve();
            });

            const { acknowledged } = await clients.A.update({
              topic: sessionA.topic,
              namespaces: namespacesAfter,
            });
            await acknowledged();
          } catch (e) {
            reject(e);
          }
        });

        deleteClients(clients);
      });
    });
    describe("session_ping", () => {
      it("emits and handles a valid session_ping", async () => {
        const { sessionA } = await testConnectMethod(clients);

        await new Promise<void>(async (resolve, reject) => {
          try {
            clients.B.once("session_ping", (event) => {
              expect(sessionA.topic).to.eql(event.topic);
              resolve();
            });

            await clients.A.ping({ topic: sessionA.topic });
          } catch (e) {
            reject(e);
          }
        });

        deleteClients(clients);
      });
    });
    describe("session_event", () => {
      it("emits and handles a valid session_event", async () => {
        const connectParams: EngineTypes.ConnectParams = {
          requiredNamespaces: TEST_REQUIRED_NAMESPACES,
          relays: undefined,
          pairingTopic: undefined,
        };

        const { sessionA } = await testConnectMethod(clients, connectParams);

        const eventPayload: EngineTypes.EmitParams = {
          topic: sessionA.topic,
          ...TEST_EMIT_PARAMS,
        };

        await new Promise<void>((resolve, reject) => {
          try {
            clients.B.on("session_event", (event) => {
              expect(TEST_EMIT_PARAMS).to.eql(event.params);
              expect(eventPayload.topic).to.eql(event.topic);
              resolve();
            });

            clients.A.emit(eventPayload);
          } catch (e) {
            reject(e);
          }
        });
        deleteClients(clients);
      });
    });
    describe("session_delete", () => {
      it("emits and handles a valid session_delete", async () => {
        const connectParams: EngineTypes.ConnectParams = {
          requiredNamespaces: TEST_REQUIRED_NAMESPACES,
          relays: undefined,
          pairingTopic: undefined,
        };

        const { sessionA } = await testConnectMethod(clients, connectParams);

        const eventPayload: EngineTypes.EmitParams = {
          topic: sessionA.topic,
          ...TEST_EMIT_PARAMS,
        };

        await new Promise<void>((resolve, reject) => {
          try {
            clients.B.on("session_delete", (event) => {
              expect(eventPayload.topic).to.eql(event.topic);
              resolve();
            });

            clients.A.disconnect({ topic: sessionA.topic, reason: getSdkError("USER_DISCONNECTED") });
          } catch (e) {
            reject(e);
          }
        });
        deleteClients(clients);
      });
    });
  });
});
