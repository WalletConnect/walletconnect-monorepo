import { getSdkError } from "@walletconnect/utils";
import {
  initTwoClients,
  testConnectMethod,
  deleteClients,
  uploadCanaryResultsToCloudWatch,
  TEST_EMIT_PARAMS,
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
      log(
        `Clients initialized (relay '${TEST_RELAY_URL}'), client ids: A:'${await clients.A.core.crypto.getClientId()}';B:'${await clients.B.core.crypto.getClientId()}'`,
      );
      const { pairingA, sessionA } = await testConnectMethod(clients);
      log(
        `Clients connected (relay '${TEST_RELAY_URL}', client ids: A:'${await clients.A.core.crypto.getClientId()}';B:'${await clients.B.core.crypto.getClientId()}' pairing topic '${
          pairingA.topic
        }', session topic '${sessionA.topic}')`,
      );
      const promise = new Promise<void>((resolve, reject) => {
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

      const latencyMs = Date.now() - start;
      const metric_prefix = "HappyPath.connects";
      const successful = true;
      await uploadCanaryResultsToCloudWatch(
        environment,
        region,
        TEST_RELAY_URL,
        metric_prefix,
        successful,
        latencyMs,
      );

      await promise;

      log("Clients disconnected");

      deleteClients(clients);
      log("Clients deleted");
    }, 300_000);
  });
  afterEach(async (done) => {
    const { result } = done.meta;
    const nowTimestamp = Date.now();
    const latencyMs = nowTimestamp - (result?.startTime || nowTimestamp);
    log(`Canary finished in state ${result?.state} took ${latencyMs}ms`);
  });
});
