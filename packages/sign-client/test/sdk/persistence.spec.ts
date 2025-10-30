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
  TEST_NAMESPACES,
  TEST_APP_METADATA_A,
  TEST_SIGN_CLIENT_NAME_A,
} from "../shared";
import { Core, RELAYER_EVENTS } from "@walletconnect/core";
import { RelayerTypes } from "@walletconnect/types";

const generateClientDbName = (prefix: string) =>
  `./test/tmp/${prefix}_${generateRandomBytes32()}.db`;

describe("Sign Client Persistence", () => {
  describe("ping", () => {
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
            new Promise<void>(async (resolve, reject) => {
              try {
                await clients.A.ping({ topic });
                await clients.B.ping({ topic });
                resolve();
              } catch (error) {
                reject(error);
              }
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

          // delete client B so it can be reinstated
          await deleteClients({ A: undefined, B: clients.B });
          let rejection: JsonRpcError;
          let requestsReceived = 0;
          await Promise.all([
            new Promise<void>(async (resolve) => {
              await throttle(3_000);
              // restart
              clients.B = await SignClient.init({
                ...TEST_SIGN_CLIENT_OPTIONS_B,
                storageOptions: { database: db_b },
                signConfig: {
                  disableRequestQueue: true,
                },
              });

              clients.B.on("session_request", async (args) => {
                requestsReceived++;
                await throttle(3_000);
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
          // validate that the pending request was received only once
          expect(requestsReceived).toBe(1);
          // delete
          await deleteClients(clients);
        });

        it("should complete a session after dapp restart", async () => {
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

          const wallet = clients.B;

          const { uri } = await clients.A.connect({});

          if (!uri) {
            throw new Error("uri is undefined");
          }

          await deleteClients({ A: clients.A, B: undefined });

          const dapp = await SignClient.init({
            ...TEST_SIGN_CLIENT_OPTIONS_A,
            storageOptions: { database: db_a },
          });

          let dappSessionTopic: string | undefined;
          let walletSessionTopic: string | undefined;

          await Promise.all([
            new Promise<void>((resolve) => {
              dapp.on("session_connect", ({ session }) => {
                expect(session).to.exist;
                dappSessionTopic = session.topic;
                resolve();
              });
            }),
            new Promise<void>((resolve) => {
              wallet.on("session_proposal", async (args) => {
                const { id } = args;
                const session = await wallet.approve({ id, namespaces: TEST_NAMESPACES });
                walletSessionTopic = session.topic;
                resolve();
              });
            }),
            wallet.pair({ uri }),
          ]);

          expect(dappSessionTopic).to.be.a("string");
          expect(walletSessionTopic).to.be.a("string");
          expect(dappSessionTopic).toEqual(walletSessionTopic);

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
      await Promise.all([
        new Promise<void>((resolve) => {
          clients.A.on("session_update", (event) => {
            resolve();
          });
        }),
        new Promise<void>((resolve) => {
          clients.A.on("session_event", (event) => {
            lastAccountEvent = event.params.event.data;
            if (lastAccountEvent[0] === lastAccountsChangedValue[0]) {
              resolve();
            }
          });
        }),
      ]);

      await throttle(2_000);

      const session = clients.A.session.get(topic);
      expect(session).toBeDefined();
      expect(session.namespaces).toEqual(lastWalletSessionNamespacesValue);
      expect(lastAccountEvent).toEqual(lastAccountsChangedValue);

      await deleteClients(clients);
    });
    /**
     * this test simulates a case where `Core` receives a message mid initialization
     * before the implementing client (sign-client) is ready to process it
     * the message should be queued and processed after the client is ready
     */
    // NOTE: this test is no longer applicable as we no longer await the relayer to connect during init
    it.skip("should process pending messages after restart", async () => {
      const db_a = generateClientDbName("client_a");
      const clients = await initTwoClients(
        {
          storageOptions: { database: db_a },
        },
        {},
      );
      const {
        sessionA: { topic },
      } = await testConnectMethod(clients);
      let messageEvent: RelayerTypes.MessageEvent;
      await Promise.all([
        new Promise<void>((resolve) => {
          clients.A.core.relayer.once(
            RELAYER_EVENTS.message,
            (event: RelayerTypes.MessageEvent) => {
              messageEvent = event;
              resolve();
            },
          );
        }),
        clients.B.ping({ topic }),
      ]);
      await clients.A.core.relayer.transportClose();
      await throttle(1000);
      const core = new Core({
        storageOptions: { database: db_a },
        projectId: process.env.TEST_PROJECT_ID,
      });
      let onMessageEventTimestamp: number;
      core.relayer.on(RELAYER_EVENTS.connect, async () => {
        // delete the message from the relayer so it can be processed again
        await core.relayer.messages.del(topic);
        // @ts-expect-error - private method
        await core.relayer.onMessageEvent(messageEvent);
        onMessageEventTimestamp = Date.now();
        if (core.relayer.messages.messagesWithoutClientAck.size !== 1) {
          throw new Error("message not queued for processing");
        }
      });

      const wallet = await SignClient.init({
        name: TEST_SIGN_CLIENT_NAME_A,
        metadata: TEST_APP_METADATA_A,
        core,
      });
      const walletInitTimestamp = Date.now();

      // validate that the message was received before the wallet was initialized
      expect(walletInitTimestamp).toBeGreaterThan(onMessageEventTimestamp);
      // validate that the message was processed by the wallet even though it was received before the wallet was initialized
      await new Promise<void>((resolve) => {
        wallet.on("session_ping", () => {
          resolve();
        });
      });
      await throttle(1000);
      expect(core.relayer.messages.messagesWithoutClientAck.size).toBe(0);
      await deleteClients({ A: wallet, B: clients.B });
    });
  });
});
