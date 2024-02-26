import { createExpiringPromise, getSdkError } from "@walletconnect/utils";
import { expect, describe, it, beforeAll, afterAll } from "vitest";
import {
  initTwoClients,
  testConnectMethod,
  deleteClients,
  TEST_EMIT_PARAMS,
  Clients,
  TESTS_CONNECT_RETRIES,
  TESTS_CONNECT_TIMEOUT,
  initTwoPairedClients,
} from "../../shared";
import { EngineTypes, PairingTypes, SessionTypes } from "@walletconnect/types";

// skip tests as they are already tested in integration.spec.ts
describe.skip("Sign Client Events Validation", () => {
  let clients: Clients;
  let pairingA: PairingTypes.Struct;
  let sessionA: SessionTypes.Struct;

  beforeAll(async () => {
    ({ clients, pairingA, sessionA } = await initTwoPairedClients());
  });

  afterAll(async () => {
    await deleteClients(clients);
  });

  describe("session", () => {
    describe("session_update", () => {
      it("emits and handles a valid session_update", async () => {
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
      });
    });
    describe("session_ping", () => {
      it("emits and handles a valid session_ping", async () => {
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
      });
    });
    describe("session_event", () => {
      it("emits and handles a valid session_event", async () => {
        const eventPayload: EngineTypes.EmitParams = {
          topic: sessionA.topic,
          ...TEST_EMIT_PARAMS,
        };

        await new Promise<void>(async (resolve, reject) => {
          try {
            clients.B.on("session_event", (event) => {
              expect(TEST_EMIT_PARAMS).to.eql(event.params);
              expect(eventPayload.topic).to.eql(event.topic);
              resolve();
            });

            await clients.A.emit(eventPayload);
          } catch (e) {
            reject(e);
          }
        });
      });
    });
    describe("session_delete", () => {
      it("emits and handles a valid session_delete", async () => {
        const eventPayload: EngineTypes.EmitParams = {
          topic: sessionA.topic,
          ...TEST_EMIT_PARAMS,
        };

        const activeSessions = clients.B.session.getAll();
        expect(activeSessions.length).to.eql(1);

        await new Promise<void>(async (resolve, reject) => {
          try {
            clients.B.on("session_delete", (event) => {
              expect(eventPayload.topic).to.eql(event.topic);

              const sessionsLeft = clients.B.session.getAll();
              expect(sessionsLeft.length).to.eql(0);
              resolve();
            });
            await clients.A.disconnect({
              topic: sessionA.topic,
              reason: getSdkError("USER_DISCONNECTED"),
            });
          } catch (e) {
            reject(e);
          }
        });
      });
    });
  });
});
