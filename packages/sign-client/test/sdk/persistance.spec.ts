import { generateRandomBytes32 } from "@walletconnect/utils";
import { describe, it } from "vitest";
import { initTwoClients, testConnectMethod, deleteClients, throttle } from "../shared";

const generateClientDbName = (prefix: string) =>
  `./test/tmp/${prefix}_${generateRandomBytes32()}.db`;

describe("Sign Client Persistance", () => {
  describe("ping", () => {
    describe("pairing", () => {
      describe("after restart", () => {
        it("clients can ping each other", async () => {
          const db_a = generateClientDbName("client_a");
          const db_b = generateClientDbName("client_b");

          let clients = await initTwoClients(
            {
              name: "pairing -> after restart A before",
              storageOptions: { database: db_a },
            },
            {
              name: "pairing -> after restart B before",
              storageOptions: { database: db_b },
            },
            { logger: "error" },
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

          await throttle(1_000);
          // restart
          clients = await initTwoClients(
            {
              name: "pairing -> after restart A after",
              storageOptions: { database: db_a },
            },
            {
              name: "pairing -> after restart B after",
              storageOptions: { database: db_b },
            },
            { logger: "error" },
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
              name: "session -> after restart A before",
              storageOptions: { database: db_a },
            },
            {
              name: "session -> after restart B before",
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

          await throttle(1_000);
          // restart
          clients = await initTwoClients(
            {
              name: "session -> after restart A after",
              storageOptions: { database: db_a },
            },
            {
              name: "session -> after restart B after",
              storageOptions: { database: db_b },
            },
          );

          // ping
          await clients.A.ping({ topic });
          await clients.B.ping({ topic });
          // delete
          await deleteClients(clients);
        });
      });
    });
  });
});
