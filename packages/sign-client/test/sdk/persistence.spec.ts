import { formatJsonRpcError, JsonRpcError } from "@walletconnect/jsonrpc-utils";
import { generateRandomBytes32, getSdkError } from "@walletconnect/utils";
import { describe, expect, it } from "vitest";
import { SignClient } from "../../src";
import {
  initTwoClients,
  testConnectMethod,
  deleteClients,
  throttle,
  TEST_REQUEST_PARAMS,
  TEST_SIGN_CLIENT_OPTIONS_B,
  TEST_SIGN_CLIENT_OPTIONS_A,
} from "../shared";

const generateClientDbName = (prefix: string) =>
  `./test/tmp/${prefix}_${generateRandomBytes32()}.db`;

describe("Sign Client Persistence", () => {
  describe("ping", () => {
    describe("pairing", () => {
      describe("after restart", () => {
        it("clients can ping each other", async () => {
          const db_a = generateClientDbName("client_a");
          const db_b = generateClientDbName("client_b");

          let clients = await initTwoClients(
            {
              storageOptions: { database: db_a },
            },
            {
              storageOptions: { database: db_b },
            },
          );

          const {
            pairingA: { topic },
          } = await testConnectMethod(clients);

          await Promise.all([
            new Promise((resolve) => {
              // ping
              clients.B.core.pairing.events.on("pairing_ping", (event: any) => {
                resolve(event);
              });
            }),
            new Promise((resolve) => {
              clients.A.core.pairing.events.on("pairing_ping", (event: any) => {
                resolve(event);
              });
            }),
            new Promise(async (resolve) => {
              // ping
              await clients.A.ping({ topic });
              await clients.B.ping({ topic });
              resolve(true);
            }),
          ]);

          await deleteClients(clients);
          // restart
          clients = await initTwoClients(
            {
              storageOptions: { database: db_a },
            },
            {
              storageOptions: { database: db_b },
            },
          );

          // ping
          await clients.A.ping({ topic });
          await clients.B.ping({ topic });

          await deleteClients(clients);
        });
      });
    });
    describe("session", () => {
      describe("after restart", () => {
        it("clients can ping each other", async () => {
          const db_a = generateClientDbName("client_a");
          const db_b = generateClientDbName("client_b");
          let clients = await initTwoClients(
            {
              storageOptions: { database: db_a },
            },
            {
              storageOptions: { database: db_b },
            },
          );
          const {
            sessionA: { topic },
          } = await testConnectMethod(clients);

          await Promise.all([
            new Promise((resolve) => {
              // ping
              clients.B.on("session_ping", (event: any) => {
                resolve(event);
              });
            }),
            new Promise((resolve) => {
              clients.A.on("session_ping", (event: any) => {
                resolve(event);
              });
            }),
            new Promise(async (resolve) => {
              // ping
              await clients.A.ping({ topic });
              await clients.B.ping({ topic });
              resolve(true);
            }),
          ]);

          // delete
          await deleteClients(clients);

          await throttle(2_000);
          // restart
          clients = await initTwoClients(
            {
              storageOptions: { database: db_a },
            },
            {
              storageOptions: { database: db_b },
            },
          );

          // ping
          await clients.A.ping({ topic });
          await clients.B.ping({ topic });
          // delete
          await deleteClients(clients);
        });

        it("should respond to pending request after restart", async () => {
          const db_a = generateClientDbName("client_a");
          const db_b = generateClientDbName("client_b");
          const clients = await initTwoClients(
            {
              storageOptions: { database: db_a },
            },
            {
              storageOptions: { database: db_b },
            },
          );
          const {
            sessionA: { topic },
          } = await testConnectMethod(clients);

          let rejection: JsonRpcError;

          await Promise.all([
            new Promise<void>((resolve) => {
              clients.B.on("session_request", async (args) => {
                // delete client B so it can be reinstated
                await deleteClients({ A: undefined, B: clients.B });

                await throttle(1_000);

                // restart
                clients.B = await SignClient.init({
                  ...TEST_SIGN_CLIENT_OPTIONS_B,
                  storageOptions: { database: db_b },
                });
                const pendingRequests = clients.B.getPendingSessionRequests();
                const { id, topic, params } = pendingRequests[0];
                expect(params).toEqual(args.params);
                expect(topic).toEqual(args.topic);
                expect(id).toEqual(args.id);
                rejection = formatJsonRpcError(id, getSdkError("USER_REJECTED_METHODS").message);

                await clients.B.respond({
                  topic,
                  response: rejection,
                });

                resolve();
              });
            }),
            new Promise<void>(async (resolve) => {
              try {
                await clients.A.request({
                  topic,
                  ...TEST_REQUEST_PARAMS,
                });
              } catch (err) {
                expect(err.message).toMatch(rejection.error.message);
                resolve();
              }
            }),
          ]);

          // delete
          await deleteClients(clients);
        });
      });
    });
  });
  describe("mailbox", () => {
    /**
     * this test simulates case where a dapp is offline while the wallet performs normal operations such as adding new accounts & emitting events
     * the dapp should receive all requests when it comes back online and process them in the expected order
     */
    it("should process incoming mailbox messages after restart", async () => {
      const chains = ["eip155:1"];
      const accounts = ["0x0000000", "0x1111111", "0x2222222"];
      const requiredNamespaces = {
        eip155: {
          chains,
          methods: ["eth_sendTransaction"],
          events: ["chainChanged", "accountsChanged"],
        },
      };

      const approvedNamespaces = {
        eip155: {
          ...requiredNamespaces.eip155,
          accounts: [`${chains[0]}:${accounts[0]}`],
        },
      };

      const db_a = generateClientDbName("client_a");
      const clients = await initTwoClients({
        storageOptions: { database: db_a },
      });
      const {
        sessionA: { topic },
      } = await testConnectMethod(clients, {
        requiredNamespaces,
        namespaces: approvedNamespaces,
      });

      // delete client B
      await deleteClients({ A: clients.A, B: undefined });
      await throttle(500);
      await clients.B.update({
        topic,
        namespaces: {
          eip155: {
            ...approvedNamespaces.eip155,
            accounts: approvedNamespaces.eip155.accounts.concat([`${chains[0]}:${accounts[1]}`]),
          },
        },
      });
      await throttle(500);
      const lastWalletSessionNamespacesValue = {
        eip155: {
          ...approvedNamespaces.eip155,
          accounts: approvedNamespaces.eip155.accounts.concat([
            `${chains[0]}:${accounts[1]}`,
            `${chains[0]}:${accounts[2]}`,
          ]),
        },
      };

      await clients.B.update({
        topic,
        namespaces: lastWalletSessionNamespacesValue,
      });
      await clients.B.emit({
        topic,
        event: {
          name: "accountsChanged",
          data: [`${chains[0]}:${accounts[1]}`],
        },
        chainId: "eip155:1",
      });
      await throttle(500);
      await clients.B.emit({
        topic,
        event: {
          name: "accountsChanged",
          data: [`${chains[0]}:${accounts[2]}`],
        },
        chainId: "eip155:1",
      });

      const lastAccountsChangedValue = [`${chains[0]}:${accounts[1]}`];
      await clients.B.emit({
        topic,
        event: {
          name: "accountsChanged",
          data: lastAccountsChangedValue,
        },
        chainId: "eip155:1",
      });
      // restart the client
      clients.A = await SignClient.init({
        ...TEST_SIGN_CLIENT_OPTIONS_A,
        storageOptions: { database: db_a },
      });
      let lastAccountEvent: any;
      clients.A.on("session_event", (event) => {
        lastAccountEvent = event.params.event.data;
      });
      await throttle(10_000);
      const session = clients.A.session.get(topic);
      expect(session).toBeDefined();

      expect(session.namespaces).toEqual(lastWalletSessionNamespacesValue);
      expect(lastAccountEvent).toEqual(lastAccountsChangedValue);

      await deleteClients(clients);
    });
  });
});
