import { describe, it } from "vitest";
import { initTwoClients, testConnectMethod, deleteClients, throttle } from "../shared";

describe("Sign Client Transport Tests", () => {
  describe("transport", () => {
    it("should disconnect & reestablish socket transport", async () => {
      const clients = await initTwoClients(
        { name: "disconnect & reestablish socket transport A" },
        { name: "disconnect & reestablish socket transpor B" },
      );
      const {
        sessionA: { topic },
      } = await testConnectMethod(clients);

      console.log("closing transports");
      await clients.A.core.relayer.restartTransport();
      await clients.B.core.relayer.restartTransport();
      console.log("opened transports");

      await throttle(2000);
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
      const clients = await initTwoClients(
        { name: "disconnect & reestablish socket transport with delay A" },
        { name: "disconnect & reestablish socket transport with delay B" },
      );
      const {
        sessionA: { topic },
      } = await testConnectMethod(clients);
      console.log("closing transport A");
      await clients.A.core.relayer.transportClose();
      await throttle(2000);
      console.log("opening transport A");
      await clients.A.core.relayer.transportOpen();
      console.log("closing transport B");
      await clients.B.core.relayer.transportClose();
      await throttle(2000);
      console.log("opening transport B");
      await clients.B.core.relayer.transportOpen();
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
