import { getSdkError } from "@walletconnect/utils";
import {
  initTwoClients,
  testConnectMethod,
  deleteClients,
  uploadCanaryResultsToCloudWatch,
  throttle,
  publishToStatusPage,
} from "../shared";
import { TEST_RELAY_URL } from "../shared/values";
import { describe, it, expect, afterEach } from "vitest";

const environment = process.env.ENVIRONMENT || "dev";

const timeout = environment === "prod" ? 610_000 : 70_000;

const log = (log: string) => {
  // eslint-disable-next-line no-console
  console.log(log);
};

describe("Lifecycle", () => {
  describe("Reconnect", () => {
    it("reconnects", async () => {
      const start = Date.now();
      const clients = await initTwoClients();
      const handshakeLatencyMs = Date.now() - start;
      log(
        `Clients initialized (relay '${TEST_RELAY_URL}'), client ids: A:'${await clients.A.core.crypto.getClientId()}';B:'${await clients.B.core.crypto.getClientId()}'`,
      );
      const humanInputLatencyMs = 600;
      const { pairingA, sessionA, clientAConnectLatencyMs, settlePairingLatencyMs } =
        await testConnectMethod(clients, { qrCodeScanLatencyMs: humanInputLatencyMs });
      log(
        `Clients connected (relay '${TEST_RELAY_URL}', client ids: A:'${await clients.A.core.crypto.getClientId()}';B:'${await clients.B.core.crypto.getClientId()}' pairing topic '${
          pairingA.topic
        }', session topic '${sessionA.topic}')`,
      );

      // Send a ping
      await throttle(humanInputLatencyMs); // Introduce some realistic timeout and allow backend to replicate

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

      log(`Going to wait for 70s until pinging again`);

      // Send a ping
      await throttle(humanInputLatencyMs); // Introduce some realistic timeout and allow backend to replicate
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

      await throttle(timeout); // Wait to trigger the reconnection logic

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

      const clientDisconnect = new Promise<void>((resolve, reject) => {
        try {
          clients.B.on("session_delete", (event: any) => {
            expect(sessionA.topic).to.eql(event.topic);
            resolve();
          });
        } catch (e) {
          reject();
        }
      });

      await clients.A.disconnect({
        topic: sessionA.topic,
        reason: getSdkError("USER_DISCONNECTED"),
      });
      await clientDisconnect;
      log("Clients disconnected");
      deleteClients(clients);
      log("Clients deleted");
    }, 70000_000);
  });
  afterEach(async (done) => {
    const { result } = done.meta;
    const nowTimestamp = Date.now();
    const latencyMs = nowTimestamp - (result?.startTime || nowTimestamp);
    log(`Lifecycle test finished in state ${result?.state} took ${latencyMs}ms`);
  });
});
