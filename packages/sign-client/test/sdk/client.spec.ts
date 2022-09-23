import { getSdkError, generateRandomBytes32 } from "@walletconnect/utils";
import { expect, describe, it, vi, beforeEach, afterEach } from "vitest";
import SignClient from "../../src";
import {
  initTwoClients,
  testConnectMethod,
  TEST_SIGN_CLIENT_OPTIONS,
  deleteClients,
  Clients,
} from "../shared";

const generateClientDbName = (prefix: string) =>
  `./test/tmp/${prefix}_${generateRandomBytes32()}.db`;

describe("Sign Client Integration", () => {
  it("init", async () => {
    const client = await SignClient.init(TEST_SIGN_CLIENT_OPTIONS);
    expect(client).to.be.exist;
  });

  describe("connect", () => {
    it("connect (with new pairing)", async () => {
      const clients = await initTwoClients();
      await testConnectMethod(clients);
      deleteClients(clients);
    });
    it("connect (with old pairing)", async () => {
      const clients = await initTwoClients();
      await testConnectMethod(clients);
      const { A, B } = clients;
      expect(A.pairing.keys).to.eql(B.pairing.keys);
      const { topic: pairingTopic } = A.pairing.get(A.pairing.keys[0]);
      await testConnectMethod(clients, {
        pairingTopic,
      });
      deleteClients(clients);
    });
  });

  describe("disconnect", () => {
    let clients;
    beforeEach(async () => {
      clients = await initTwoClients();
    });
    afterEach(async (done) => {
      const { result } = done.meta;
      if (result?.state.toString() !== "pass") {
        if (!clients || !clients.A || !clients.B) {
          console.log("Clients failed to initialize");
          return;
        }
        console.log(
          `Test ${
            done.meta.name
          } failed with client ids: A:'${await clients.A.core.crypto.getClientId()}';B:'${await clients.B.core.crypto.getClientId()}'`,
        );
      }
    });
    describe("pairing", () => {
      it("deletes the pairing on disconnect", async () => {
        const {
          pairingA: { topic },
        } = await testConnectMethod(clients);
        const reason = getSdkError("USER_DISCONNECTED");
        await clients.A.disconnect({ topic, reason });
        expect(() => clients.A.pairing.get(topic)).to.throw(`No matching key. pairing: ${topic}`);
        const promise = clients.A.ping({ topic });
        await expect(promise).rejects.toThrowError(
          `No matching key. session or pairing topic doesn't exist: ${topic}`,
        );
        deleteClients(clients);
      });
    });
    describe("session", () => {
      it("deletes the session on disconnect", async () => {
        const {
          sessionA: { topic },
        } = await testConnectMethod(clients);
        const reason = getSdkError("USER_DISCONNECTED");
        await clients.A.disconnect({ topic, reason });
        expect(() => clients.A.session.get(topic)).to.throw(`No matching key. session: ${topic}`);
        const promise = clients.A.ping({ topic });
        await expect(promise).rejects.toThrowError(
          `No matching key. session or pairing topic doesn't exist: ${topic}`,
        );
        deleteClients(clients);
      });
    });
  });

  describe("ping", () => {
    it("throws if the topic is not a known pairing or session topic", async () => {
      const clients = await initTwoClients();
      const fakeTopic = "nonsense";
      await expect(clients.A.ping({ topic: fakeTopic })).rejects.toThrowError(
        `No matching key. session or pairing topic doesn't exist: ${fakeTopic}`,
      );
      deleteClients(clients);
    });
    describe("pairing", () => {
      describe("with existing pairing", () => {
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
        it("A pings B", async () => {
          const {
            pairingA: { topic },
          } = await testConnectMethod(clients);
          await clients.A.ping({ topic });
          deleteClients(clients);
        });
        it("B pings A", async () => {
          const {
            pairingA: { topic },
          } = await testConnectMethod(clients);
          await clients.B.ping({ topic });
          deleteClients(clients);
        });
      });
      describe("after restart", () => {
        let beforeClients: Clients;
        let afterClients: Clients;
        const db_a = generateClientDbName("client_a");
        const db_b = generateClientDbName("client_b");
        beforeEach(async () => {
          beforeClients = await initTwoClients(
            {
              storageOptions: { database: db_a },
              name: "before_client_a",
            },
            {
              storageOptions: { database: db_b },
              name: "before_client_b",
            },
          );
        });
        afterEach(async (done) => {
          const { result } = done.meta;
          if (result?.state.toString() !== "pass") {
            if (!beforeClients || !beforeClients.A || !beforeClients.B) {
              console.log("Clients failed to initialize or removed");
            } else {
              console.log(
                `Test ${
                  done.meta.name
                } failed with before client ids: A:'${await beforeClients.A.core.crypto.getClientId()}';B:'${await beforeClients.B.core.crypto.getClientId()}'`,
              );
            }

            if (!afterClients || !afterClients.A || !afterClients.B) {
              console.log("afterClients failed to initialize or removed");
              return;
            }
            console.log(
              `Test ${
                done.meta.name
              } failed with after client ids: A:'${await afterClients.A.core.crypto.getClientId()}';B:'${await afterClients.B.core.crypto.getClientId()}'`,
            );
          }
        });
        it("clients can ping each other", async () => {
          const {
            pairingA: { topic },
          } = await testConnectMethod(beforeClients);

          await Promise.all([
            new Promise((resolve) => {
              // ping
              beforeClients.B.on("pairing_ping", (event: any) => {
                resolve(event);
              });
            }),
            new Promise((resolve) => {
              beforeClients.A.on("pairing_ping", (event: any) => {
                resolve(event);
              });
            }),
            new Promise(async (resolve) => {
              // ping
              await beforeClients.A.ping({ topic });
              await beforeClients.B.ping({ topic });
              resolve(true);
            }),
          ]);

          beforeClients.A.core.relayer.provider.disconnect();
          beforeClients.B.core.relayer.provider.disconnect();

          deleteClients(beforeClients);

          await new Promise((resolve) => {
            setTimeout(() => {
              resolve(true);
            }, 500);
          });

          // restart
          afterClients = await initTwoClients(
            {
              storageOptions: { database: db_a },
              name: "client_a",
            },
            {
              storageOptions: { database: db_b },
              name: "client_b",
            },
            { logger: "error" },
          );

          await testConnectMethod(afterClients);

          await new Promise((resolve) => {
            setTimeout(() => {
              resolve(true);
            }, 500);
          });
          // ping
          await afterClients.A.ping({ topic });
          await afterClients.B.ping({ topic });
          deleteClients(afterClients);
        });
      });
    });
    describe("session", () => {
      describe("with existing session", () => {
        let clients: Clients;
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
        it("A pings B", async () => {
          const {
            sessionA: { topic },
          } = await testConnectMethod(clients);
          await clients.A.ping({ topic });
          deleteClients(clients);
        });
        it("B pings A", async () => {
          const {
            sessionA: { topic },
          } = await testConnectMethod(clients);
          await clients.B.ping({ topic });
          deleteClients(clients);
        });
      });
      describe("after restart", () => {
        let beforeClients: Clients;
        let afterClients: Clients;
        const db_a = generateClientDbName("client_a");
        const db_b = generateClientDbName("client_b");
        beforeEach(async () => {
          beforeClients = await initTwoClients(
            {
              storageOptions: { database: db_a },
            },
            {
              storageOptions: { database: db_b },
            },
          );
        });
        afterEach(async (done) => {
          const { result } = done.meta;
          if (result?.state.toString() !== "pass") {
            if (!beforeClients || !beforeClients.A || !beforeClients.B) {
              console.log("Clients failed to initialize or removed");
            } else {
              console.log(
                `Test ${
                  done.meta.name
                } failed with before client ids: A:'${await beforeClients.A.core.crypto.getClientId()}';B:'${await beforeClients.B.core.crypto.getClientId()}'`,
              );
            }

            if (!afterClients || !afterClients.A || !afterClients.B) {
              console.log("afterClients failed to initialize or removed");
              return;
            }
            console.log(
              `Test ${
                done.meta.name
              } failed with after client ids: A:'${await afterClients.A.core.crypto.getClientId()}';B:'${await afterClients.B.core.crypto.getClientId()}'`,
            );
          }
        });
        it("clients can ping each other", async () => {
          const {
            sessionA: { topic },
          } = await testConnectMethod(beforeClients);

          await Promise.all([
            new Promise((resolve) => {
              // ping
              beforeClients.B.on("session_ping", (event: any) => {
                resolve(event);
              });
            }),
            new Promise((resolve) => {
              beforeClients.A.on("session_ping", (event: any) => {
                resolve(event);
              });
            }),
            new Promise(async (resolve) => {
              // ping
              await beforeClients.A.ping({ topic });
              await beforeClients.B.ping({ topic });
              resolve(true);
            }),
          ]);

          beforeClients.A.core.relayer.provider.disconnect();
          beforeClients.B.core.relayer.provider.disconnect();
          // delete
          deleteClients(beforeClients);
          await new Promise((resolve) => {
            setTimeout(() => {
              resolve(true);
            }, 500);
          });
          // restart
          afterClients = await initTwoClients(
            {
              storageOptions: { database: db_a },
            },
            {
              storageOptions: { database: db_b },
            },
          );

          await new Promise((resolve) => {
            setTimeout(() => {
              resolve(true);
            }, 500);
          });
          // ping
          await afterClients.A.ping({ topic });
          await afterClients.B.ping({ topic });
          deleteClients(afterClients);
        });
      });
    });
  });

  describe("update", () => {
    it("updates session namespaces state with provided namespaces", async () => {
      const clients = await initTwoClients();
      const {
        sessionA: { topic },
      } = await testConnectMethod(clients);
      const namespacesBefore = clients.A.session.get(topic).namespaces;
      const namespacesAfter = {
        ...namespacesBefore,
        eip9001: {
          accounts: ["eip9001:1:0x000000000000000000000000000000000000dead"],
          methods: ["eth_sendTransaction"],
          events: ["accountsChanged"],
        },
      };
      const { acknowledged } = await clients.A.update({
        topic,
        namespaces: namespacesAfter,
      });
      await acknowledged();
      const result = clients.A.session.get(topic).namespaces;
      expect(result).to.eql(namespacesAfter);
      deleteClients(clients);
    }, 20_000);
  });

  describe("extend", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("updates session expiry state", async () => {
      const clients = await initTwoClients();
      const {
        sessionA: { topic },
      } = await testConnectMethod(clients);
      const prevExpiry = clients.A.session.get(topic).expiry;

      // Fast-forward system time by 60 seconds after expiry was first set.
      vi.setSystemTime(Date.now() + 60_000);

      const { acknowledged } = await clients.A.extend({
        topic,
      });
      await acknowledged();
      const updatedExpiry = clients.A.session.get(topic).expiry;
      expect(updatedExpiry).to.be.greaterThan(prevExpiry);
      deleteClients(clients);
    }, 20_000);
  });
});
