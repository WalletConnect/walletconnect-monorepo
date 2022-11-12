import { getSdkError, generateRandomBytes32 } from "@walletconnect/utils";
import { expect, describe, it, vi } from "vitest";
import SignClient from "../../src";
import {
  initTwoClients,
  testConnectMethod,
  TEST_SIGN_CLIENT_OPTIONS,
  deleteClients,
  disconnectSocket,
  throttle,
} from "../shared";

const generateClientDbName = (prefix: string) =>
  `./test/tmp/${prefix}_${generateRandomBytes32()}.db`;

describe("Sign Client Integration", () => {
  it("init", async () => {
    const client = await SignClient.init(TEST_SIGN_CLIENT_OPTIONS);
    expect(client).to.be.exist;
    await disconnectSocket(client.core);
  });

  describe("connect", () => {
    it("connect (with new pairing)", async () => {
      const clients = await initTwoClients();
      await testConnectMethod(clients);
      await deleteClients(clients);
    });
    it("connect (with old pairing)", async () => {
      const clients = await initTwoClients();
      const {
        pairingA: { topic: pairingTopic },
      } = await testConnectMethod(clients);
      const { A, B } = clients;
      expect(A.pairing.keys).to.eql(B.pairing.keys);
      await testConnectMethod(clients, {
        pairingTopic,
      });
      await deleteClients(clients);
    });
  });

  describe("disconnect", () => {
    describe("pairing", () => {
      it("deletes the pairing on disconnect", async () => {
        const clients = await initTwoClients();
        const {
          pairingA: { topic },
        } = await testConnectMethod(clients);
        const reason = getSdkError("USER_DISCONNECTED");
        await clients.A.disconnect({ topic, reason });
        expect(() => clients.A.pairing.get(topic)).to.throw(`No matching key. pairing: ${topic}`);
        await disconnectSocket(clients.A.core);
        await disconnectSocket(clients.B.core);
        const promise = clients.A.ping({ topic });
        await expect(promise).rejects.toThrowError(
          `No matching key. session or pairing topic doesn't exist: ${topic}`,
        );
        await deleteClients(clients);
      });
    });
    describe("session", () => {
      it("deletes the session on disconnect", async () => {
        const clients = await initTwoClients();
        const {
          sessionA: { topic },
        } = await testConnectMethod(clients);
        const reason = getSdkError("USER_DISCONNECTED");
        await clients.A.disconnect({ topic, reason });
        await disconnectSocket(clients.A.core);
        await disconnectSocket(clients.B.core);
        expect(() => clients.A.session.get(topic)).to.throw(`No matching key. session: ${topic}`);
        await deleteClients(clients);
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
      await deleteClients(clients);
    });
    describe("pairing", () => {
      describe("with existing pairing", () => {
        it("A pings B", async () => {
          const clients = await initTwoClients();
          const {
            pairingA: { topic },
          } = await testConnectMethod(clients);
          await clients.A.ping({ topic });
          await deleteClients(clients);
        });
        it("B pings A", async () => {
          const clients = await initTwoClients();
          const {
            pairingA: { topic },
          } = await testConnectMethod(clients);
          await clients.B.ping({ topic });
          await deleteClients(clients);
        });
      });
      describe("after restart", () => {
        it("clients can ping each other", async () => {
          const db_a = generateClientDbName("client_a");
          const db_b = generateClientDbName("client_b");

          const beforeClients = await initTwoClients(
            {
              storageOptions: { database: db_a },
              name: "before_client_a",
            },
            {
              storageOptions: { database: db_b },
              name: "before_client_b",
            },
          );
          const {
            pairingA: { topic },
          } = await testConnectMethod(beforeClients);

          await Promise.all([
            new Promise((resolve) => {
              // ping
              beforeClients.B.core.pairing.events.on("pairing_ping", (event: any) => {
                resolve(event);
              });
            }),
            new Promise((resolve) => {
              beforeClients.A.core.pairing.events.on("pairing_ping", (event: any) => {
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

          await deleteClients(beforeClients);

          // restart
          const afterClients = await initTwoClients(
            {
              storageOptions: { database: db_a },
            },
            {
              storageOptions: { database: db_b },
            },
            { logger: "error" },
          );

          // ping
          await afterClients.A.ping({ topic });
          await afterClients.B.ping({ topic });

          await deleteClients(afterClients);
        });
      });
    });
    describe("session", () => {
      describe("with existing session", () => {
        it("A pings B", async () => {
          const clients = await initTwoClients();
          const {
            sessionA: { topic },
          } = await testConnectMethod(clients);
          await clients.A.ping({ topic });
          await deleteClients(clients);
        });
        it("B pings A", async () => {
          const clients = await initTwoClients();
          const {
            sessionA: { topic },
          } = await testConnectMethod(clients);
          await clients.B.ping({ topic });
          await deleteClients(clients);
        });
      });
      describe("after restart", () => {
        it("clients can ping each other", async () => {
          const db_a = generateClientDbName("client_a");
          const db_b = generateClientDbName("client_b");
          const beforeClients = await initTwoClients(
            {
              storageOptions: { database: db_a },
            },
            {
              storageOptions: { database: db_b },
            },
          );
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

          // delete
          await deleteClients(beforeClients);

          // restart
          const afterClients = await initTwoClients(
            {
              storageOptions: { database: db_a },
            },
            {
              storageOptions: { database: db_b },
            },
          );

          // ping
          await afterClients.A.ping({ topic });
          await afterClients.B.ping({ topic });
          // delete
          await deleteClients(afterClients);
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
      await deleteClients(clients);
    }, 50_000);
  });

  describe("extend", () => {
    it("updates session expiry state", async () => {
      const clients = await initTwoClients();
      vi.useFakeTimers();
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
      vi.useRealTimers();
      await deleteClients(clients);
    }, 50_000);
  });
  describe("transport", () => {
    // it("should disconnect & reestablish socket transport", async () => {
    //   const clients = await initTwoClients();
    //   const {
    //     sessionA: { topic },
    //   } = await testConnectMethod(clients);

    //   await clients.A.core.relayer.transportClose();
    //   await clients.A.core.relayer.transportOpen();

    //   await clients.B.core.relayer.transportClose();
    //   await clients.B.core.relayer.transportOpen();

    //   await Promise.all([
    //     new Promise((resolve) => {
    //       clients.B.on("session_ping", (event: any) => {
    //         resolve(event);
    //       });
    //     }),
    //     new Promise((resolve) => {
    //       clients.A.on("session_ping", (event: any) => {
    //         resolve(event);
    //       });
    //     }),
    //     new Promise(async (resolve) => {
    //       await clients.A.ping({ topic });
    //       await clients.B.ping({ topic });
    //       resolve(true);
    //     }),
    //   ]);
    //   await deleteClients(clients);
    // });
    // it("should disconnect & reestablish socket transport with delay", async () => {
    //   const clients = await initTwoClients();
    //   const {
    //     sessionA: { topic },
    //   } = await testConnectMethod(clients);

    //   await clients.A.core.relayer.transportClose();
    //   await throttle(2000);
    //   await clients.A.core.relayer.transportOpen();
    //   await clients.B.core.relayer.transportClose();
    //   await throttle(2000);
    //   await clients.B.core.relayer.transportOpen();
    //   await Promise.all([
    //     new Promise((resolve) => {
    //       clients.B.on("session_ping", (event: any) => {
    //         resolve(event);
    //       });
    //     }),
    //     new Promise((resolve) => {
    //       clients.A.on("session_ping", (event: any) => {
    //         resolve(event);
    //       });
    //     }),
    //     new Promise(async (resolve) => {
    //       await clients.A.ping({ topic });
    //       await clients.B.ping({ topic });
    //       resolve(true);
    //     }),
    //   ]);
    //   await deleteClients(clients);
    // });
  });
});
