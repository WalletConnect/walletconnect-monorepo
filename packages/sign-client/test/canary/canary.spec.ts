import { getSdkError } from "@walletconnect/utils";
import {
  initTwoClients,
  testConnectMethod,
  deleteClients,
  uploadCanaryResultsToCloudWatch,
  publishToStatusPage,
} from "../shared";
import {
  TEST_RELAY_URL,
  TEST_SIGN_CLIENT_OPTIONS_A,
  TEST_SIGN_CLIENT_OPTIONS_B,
} from "./../shared/values";
import { describe, it, expect, afterEach } from "vitest";
import { SignClient } from "../../src";

const environment = process.env.ENVIRONMENT || "dev";
const region = process.env.REGION || "unknown";

const log = (log: string) => {
  // eslint-disable-next-line no-console
  console.log(log);
};

describe("Canary", () => {
  const metric_prefix = "HappyPath.connects";
  describe("HappyPath", () => {
    it("connects", async () => {
      const start = Date.now();
      const A = await SignClient.init({
        ...TEST_SIGN_CLIENT_OPTIONS_A,
      });

      const B = await SignClient.init({
        ...TEST_SIGN_CLIENT_OPTIONS_B,
      });
      const clients = { A, B };
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

      const successful = true;
      const pairingLatencyMs = Date.now() - start - humanInputLatencyMs;

      // Send a ping
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
      for (const client of [clients.A, clients.B]) {
        if (client.core.relayer.connected) await client.core.relayer.transportClose();
      }
      log("Clients deleted");
    }, 600_000);
  });
  afterEach(async (done) => {
    const { result } = done.meta;
    const nowTimestamp = Date.now();
    const latencyMs = nowTimestamp - (result?.startTime || nowTimestamp);
    const taskState = result?.state;
    log(`Canary finished in state ${taskState} took ${latencyMs}ms`);
    if (environment !== "dev" && taskState?.toString() !== "pass") {
      await uploadCanaryResultsToCloudWatch(
        environment,
        region,
        TEST_RELAY_URL,
        metric_prefix,
        false,
        latencyMs,
        [],
      );
    }
  });
});
