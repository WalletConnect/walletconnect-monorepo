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
const test_regions = region === 'unknown' ? ['global'] : ['global', region]

const log = (log: string) => {
  // eslint-disable-next-line no-console
  console.log(log);
};

// Seemingly no good way to retrieve
// the test parameters in the `afterEach`
// hook and therefore doing inelegant
// string replacement.
const TEST_PREFIX = 'Connects to ';

describe("Canary", () => {
  // Run the test against the global endpoint and
  // the endpoint of the region that the Canary is running in
  // we run one instance of the canary per region
  describe.each(test_regions)("HappyPath", (realm) => {
    it(`${TEST_PREFIX}${realm}`, async () => {
      const endpoint = realm === 'global' ? TEST_RELAY_URL : `wss://${realm}.${TEST_RELAY_URL.replace('wss://', '')}`;
      const clients = await initTwoClients({
        relayUrl: endpoint,
      });
      log(
        `Clients initialized (relay '${endpoint}'), client ids: A:'${await clients.A.core.crypto.getClientId()}';B:'${await clients.B.core.crypto.getClientId()}'`,
      );
      const { pairingA, sessionA } = await testConnectMethod(clients);
      log(
        `Clients connected (relay '${endpoint}', client ids: A:'${await clients.A.core.crypto.getClientId()}';B:'${await clients.B.core.crypto.getClientId()}' pairing topic '${
          pairingA.topic
        }', session topic '${sessionA.topic}')`,
      );

      await Promise.all([
        new Promise<void>((resolve, reject) => {
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
      log("Clients disconnected");

      deleteClients(clients);
      log("Clients deleted");
    }, 240_000);
  });
  afterEach(async (done) => {
    if (environment === 'dev') return;
    const { suite, name, result } = done.meta;
    const metric_prefix = `${suite.name}.${name}`;
    const realm = name.replace(TEST_PREFIX, "");
    const target = realm === 'global' ? TEST_RELAY_URL : `${realm}.${TEST_RELAY_URL}`;
    const nowTimestamp = Date.now();
    const latencyMs = nowTimestamp - (result?.startTime || nowTimestamp);
    const successful = result?.state === "pass";
    log(`Canary finished in state ${result?.state} took ${latencyMs}ms`);
    await uploadCanaryResultsToCloudWatch(
      environment,
      region,
      target,
      metric_prefix,
      successful,
      latencyMs,
    );
  });
});
