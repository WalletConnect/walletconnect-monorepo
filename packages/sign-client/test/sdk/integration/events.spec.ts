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
} from "../../shared";
import { EngineTypes } from "@walletconnect/types";

describe("Sign Client Events Validation", () => {
  let clients: Clients;
  let pairingA: any;
  let sessionA: any;
  beforeAll(async () => {
    clients = await initTwoClients();
    let retries = 0;
    while (!pairingA) {
      if (retries > TESTS_CONNECT_RETRIES) {
        throw new Error("Could not pair clients");
      }
      try {
        const settled: any = await createExpiringPromise(
          testConnectMethod(clients),
          TESTS_CONNECT_TIMEOUT,
        );
        pairingA = settled.pairingA;
        sessionA = settled.sessionA;
      } catch (e) {
        clients.A.logger.error("retrying", e);
        await deleteClients(clients);
        clients = await initTwoClients();
      }
      retries++;
    }
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

        await new Promise<void>(async (resolve, reject) => {
          try {
            clients.B.on("session_delete", (event) => {
              expect(eventPayload.topic).to.eql(event.topic);
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
