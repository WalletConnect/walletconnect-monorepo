import { getSdkError } from "@walletconnect/utils";
import {
  initTwoClients,
  testConnectMethod,
  deleteClients,
  uploadCanaryResultsToCloudWatch,
  throttle,
  publishToStatusPage,
} from "../shared";
import { TEST_RELAY_URL } from "./../shared/values";
import { describe, it, expect, afterEach } from "vitest";

const environment = process.env.ENVIRONMENT || "dev";
const region = process.env.REGION || "unknown";

const log = (log: string) => {
  // eslint-disable-next-line no-console
  console.log(log);
};

describe("Canary", () => {
  describe("HappyPath", () => {
    it("connects", async () => {
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

      const metric_prefix = "HappyPath.connects";
      const successful = true;
      const pairingLatencyMs = Date.now() - start - humanInputLatencyMs;

      // Send a ping
      await throttle(humanInputLatencyMs); // Introduce some realistic timeout and allow backend to replicate
      const pingStart = Date.now();
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
      const pingLatencyMs = Date.now() - pingStart;
      const latencyMs = Date.now() - start - 2 * humanInputLatencyMs;

      console.log(`Clients paired after ${pairingLatencyMs}ms`);
      if (environment !== "dev") {
        await uploadCanaryResultsToCloudWatch(
          environment,
          region,
          TEST_RELAY_URL,
          metric_prefix,
          successful,
          latencyMs,
          [
            { handshakeLatency: handshakeLatencyMs },
            { proposePairingLatency: clientAConnectLatencyMs },
            { settlePairingLatency: settlePairingLatencyMs - clientAConnectLatencyMs },
            { pairingLatency: pairingLatencyMs },
            { pingLatency: pingLatencyMs },
          ],
        );
      }

      if (environment === "prod") {
        await publishToStatusPage(latencyMs);
      }

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
    }, 600_000);
  });
  afterEach(async (done) => {
    const { result } = done.meta;
    const nowTimestamp = Date.now();
    const latencyMs = nowTimestamp - (result?.startTime || nowTimestamp);
    log(`Canary finished in state ${result?.state} took ${latencyMs}ms`);
  });
});
