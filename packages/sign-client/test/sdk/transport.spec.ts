import { describe, it } from "vitest";
import { initTwoClients, testConnectMethod, deleteClients, throttle } from "../shared";

describe("Sign Client Transport Tests", () => {
  describe("transport", () => {
    it("should disconnect & reestablish socket transport", async () => {
      const clients = await initTwoClients();
      const {
        sessionA: { topic },
      } = await testConnectMethod(clients);

      await clients.A.core.relayer.restartTransport();
      await clients.B.core.relayer.restartTransport();
      await Promise.all([
        new Promise((resolve) => {
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
          await clients.A.ping({ topic });
          await clients.B.ping({ topic });
          resolve(true);
        }),
      ]);
      await deleteClients(clients);
    });
    it("should disconnect & reestablish socket transport with delay", async () => {
      const clients = await initTwoClients();
      const {
        sessionA: { topic },
      } = await testConnectMethod(clients);
      await clients.A.core.relayer.restartTransport();
      await throttle(2000);
      await clients.B.core.relayer.restartTransport();
      await Promise.all([
        new Promise((resolve) => {
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
          await clients.A.ping({ topic });
          await clients.B.ping({ topic });
          resolve(true);
        }),
      ]);
      await deleteClients(clients);
    });
  });
});
