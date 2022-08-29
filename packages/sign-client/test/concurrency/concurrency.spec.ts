import { getSdkError } from "@walletconnect/utils";
import SignClient from "../../src";
import {
  initTwoClients,
  testConnectMethod,
  TEST_SIGN_CLIENT_OPTIONS,
  uploadLoadTestConnectionDataToCloudWatch,
  deleteClients,
  Clients,
  TEST_EMIT_PARAMS,
  throttle,
  batchArray,
} from "./../shared";
import { TEST_RELAY_URL } from "./../shared/values";
import { describe, it, expect } from "vitest";

const environment = process.env.ENVIRONMENT || "dev";

describe("Sign Client Concurrency", () => {
  it("should successfully handle concurrent clients", async () => {
    const clientPairs = process.env.CLIENTS ? parseInt(process.env.CLIENTS) : 300000;
    const messagesToBeExchanged = process.env.MESSAGES_PER_CLIENT
      ? parseInt(process.env.MESSAGES_PER_CLIENT)
      : 1000; // minimum messages to be exchanged between clients
    const relayUrl =
      process.env.RELAY_URL || process.env.TEST_RELAY_URL || TEST_SIGN_CLIENT_OPTIONS.relayUrl;
    const heartbeatIntervalMs = process.env.HEARTBEAT_INTERVAL
      ? parseInt(process.env.HEARTBEAT_INTERVAL)
      : 3000;

    const pairings: any[] = [];
    const messagesReceived: any = {};

    const log = (log: string) => {
      // eslint-disable-next-line no-console
      console.log(log);
    };

    const heartBeat = setInterval(() => {
      log(`initialized pairs - ${pairings.length}`);
      log(
        `total messages exchanged - ${Object.values(messagesReceived).reduce(
          (messagesSum: any, messages: any) => parseInt(messagesSum) + parseInt(messages.length),
          0,
        )}`,
      );
    }, heartbeatIntervalMs);

    const processMessages = async (data: any, clientIndex: number) => {
      const { clients, sessionA } = data;
      const eventPayload: any = {
        topic: sessionA.topic,
        ...TEST_EMIT_PARAMS,
      };
      messagesReceived[clientIndex] = [];

      await new Promise<void>(async (resolve, reject) => {
        try {
          const clientsArr = [clients.A, clients.B];

          for await (const client of [clients.A, clients.B]) {
            client.on("session_ping", (event: any) => {
              expect(sessionA.topic).to.eql(event.topic);
              messagesReceived[clientIndex].push(event);
              validate();
            });

            client.on("session_event", (event: any) => {
              expect(TEST_EMIT_PARAMS).to.eql(event.params);
              expect(eventPayload.topic).to.eql(event.topic);
              messagesReceived[clientIndex].push(event);
              validate();
            });

            client.on("session_update", (event: any) => {
              expect(client.session.get(sessionA.topic).namespaces).to.eql(namespacesAfter);
              messagesReceived[clientIndex].push(event);
              validate();
            });
          }

          const namespacesBefore = sessionA.namespaces;
          const namespacesAfter = {
            ...namespacesBefore,
            eip9001: {
              accounts: ["eip9001:1:0x000000000000000000000000000000000000dead"],
              methods: ["eth_sendTransaction"],
              events: ["accountsChanged"],
            },
          };

          const emit = async (client: any) => {
            await client.emit(eventPayload);
          };

          const validate = () => {
            if (messagesReceived[clientIndex].length >= messagesToBeExchanged) {
              resolve();
            }
          };

          for (const i of Array.from(Array(messagesToBeExchanged).keys())) {
            const client: any = Math.floor(Math.random() * clientsArr.length);
            await emit(clientsArr[client]);
            await throttle(10); // throttle the messages/s to avoid being blocked by the relay
          }
        } catch (e) {
          reject(e);
        }
      });
    };

    // init clients and pair
    // we connect 10 clients at a time
    for await (const batch of batchArray(Array.from(Array(clientPairs).keys()), 100)) {
      const successfullyConnectedLatencies: number[] = await Promise.all(
        batch.map((i) => {
          return new Promise<number>(async (resolve) => {
            const timeout = setTimeout(() => {
              log(`Client ${i} hung up`);
              resolve(-1);
            }, 90_000);

            const now = new Date().getTime();
            const clients: Clients = await initTwoClients({ relayUrl });
            await throttle(10);
            expect(clients.A instanceof SignClient).to.eql(true);
            expect(clients.B instanceof SignClient).to.eql(true);
            const { sessionA } = await testConnectMethod(clients);
            pairings.push({ clients, sessionA });
            clearTimeout(timeout);
            const latency = new Date().getTime() - now;
            resolve(latency);
          });
        })
        .filter((i: number) => i !== -1),
      );
      const averageConnectLatency = successfullyConnectedLatencies.reduce((a, b) => a + b, 0) / successfullyConnectedLatencies.length;
      const failures =  batch.length - successfullyConnectedLatencies.length;
      log(`${successfullyConnectedLatencies.length} out of ${batch.length} connected (${averageConnectLatency}ms avg connection latency)`);

      const metric_prefix = `Pairing`;
      await uploadLoadTestConnectionDataToCloudWatch(
        environment,
        TEST_RELAY_URL,
        metric_prefix,
        successfullyConnectedLatencies.length,
        failures,
        averageConnectLatency
      );
    }

    // process all messages between clients in parallel
    await Promise.all(
      pairings.map(({ clients, sessionA }, i) => {
        return new Promise<void>(async (resolve) => {
          await processMessages({ clients, sessionA }, i);
          resolve();
        });
      }),
    );

    for await (const data of pairings) {
      const { clients, sessionA } = data;

      await Promise.all([
        new Promise<void>(async (resolve, reject) => {
          const eventPayload: any = {
            topic: sessionA.topic,
            ...TEST_EMIT_PARAMS,
          };

          try {
            clients.B.on("session_delete", (event: any) => {
              expect(eventPayload.topic).to.eql(event.topic);
              resolve();
            });
          } catch (e) {
            reject();
          }
        }),
        new Promise<void>((resolve) => {
          clients.A.disconnect({
            topic: sessionA.topic,
            reason: getSdkError("USER_DISCONNECTED"),
          });
          resolve();
        }),
      ]);
    }

    for (const data of pairings) {
      deleteClients(data.clients);
    }
    clearInterval(heartBeat);
  }, 600000);
});
