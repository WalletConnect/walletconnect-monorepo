import { expect, describe, it } from "vitest";
import {
  TEST_RELAY_URL,
  TEST_RELAY_URL_US,
  TEST_RELAY_URL_AP,
  TEST_RELAY_URL_EU,
  TEST_PROJECT_ID,
  TEST_REQUEST_PARAMS,
  throttle,
  deleteClients,
  initTwoPairedClients,
} from "../shared";
import { formatJsonRpcResult } from "@walletconnect/jsonrpc-utils";

const log = (log: string) => {
  // eslint-disable-next-line no-console
  console.log(log);
};

/**
 * Transform relay URLs for staging environment if needed
 */
const getStagingUrl = (url: string) => {
  const isStaging = TEST_RELAY_URL.includes("staging.");
  const isStagingDash = TEST_RELAY_URL.includes("staging-");

  if (isStaging) {
    // Old format: staging.
    return url.replace("wss://", "wss://staging.");
  } else if (isStagingDash) {
    // New format: staging-
    // Transform from wss://us-east-1.relay.walletconnect.com to wss://us-east-1.staging-relay.walletconnect.org
    return url.replace(".relay.walletconnect.com", ".staging-relay.walletconnect.org");
  }
  return url;
};

describe("Region Switch Communication", () => {
  describe("message delivery after region switch", () => {
    it("client receives message after reconnecting to different region", async () => {
      // 1. Initialize paired clients in US region
      const usUrl = getStagingUrl(TEST_RELAY_URL_US);
      const euUrl = getStagingUrl(TEST_RELAY_URL_EU);
      log(`Using US URL: ${usUrl}`);
      log(`Will switch to EU URL: ${euUrl}`);

      const { clients, sessionA } = await initTwoPairedClients(
        { relayUrl: usUrl },
        { relayUrl: usUrl },
        { projectId: TEST_PROJECT_ID },
      );

      log(`Clients paired in US region - session topic: ${sessionA.topic}`);

      // 2. Disconnect client A
      await clients.A.core.relayer.transportClose();
      log("Client A disconnected from US region");

      // 3. Send the request while A is offline
      const requestStart = Date.now();
      const requestPromise = clients.B.request({
        topic: sessionA.topic,
        ...TEST_REQUEST_PARAMS,
      });
      log("Request sent while client A is offline");

      // 4. Wait for message to be published, then reconnect A to EU
      await throttle(1000); // Allow backend replication
      log("Waiting for backend replication...");

      await clients.A.core.relayer.restartTransport(euUrl);
      log("Client A reconnected to EU region");

      // 5. Client A should receive and respond to the request
      await new Promise<void>((resolve, reject) => {
        clients.A.once("session_request", async (event) => {
          try {
            expect(sessionA.topic).to.eql(event.topic);
            const pendingRequests = clients.A.pendingRequest.getAll();
            const { id, topic } = pendingRequests[0];

            const result = formatJsonRpcResult(id, "0x");
            await clients.A.respond({
              topic,
              response: result,
            });
            log("Client A received and responded to request after region switch");
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });

      // 6. Verify request completes
      await requestPromise;
      const requestLatency = Date.now() - requestStart;
      log(`Request completed after region switch in ${requestLatency}ms`);

      await deleteClients(clients);
    }, 120_000);

    it("client switches region and receives subsequent messages", async () => {
      // 1. Initialize paired clients in US region
      const { clients, sessionA } = await initTwoPairedClients(
        { relayUrl: getStagingUrl(TEST_RELAY_URL_US) },
        { relayUrl: getStagingUrl(TEST_RELAY_URL_US) },
        { projectId: TEST_PROJECT_ID },
      );

      log(`Clients paired in US region - session topic: ${sessionA.topic}`);

      // 2. Disconnect client B
      await clients.B.core.relayer.transportClose();
      log("Client B disconnected from US region");

      // 3. Send the request while B is offline
      const requestStart = Date.now();
      const requestPromise = clients.A.request({
        topic: sessionA.topic,
        ...TEST_REQUEST_PARAMS,
      });
      log("Request sent while client B is offline");

      // 4. Wait for message to be published, then reconnect B to AP
      await throttle(1000); // Allow backend replication
      log("Waiting for backend replication...");

      await clients.B.core.relayer.restartTransport(getStagingUrl(TEST_RELAY_URL_AP));
      log("Client B reconnected to AP region");

      // 5. Client B should receive and respond to the request
      await new Promise<void>((resolve, reject) => {
        clients.B.once("session_request", async (event) => {
          try {
            expect(sessionA.topic).to.eql(event.topic);
            const pendingRequests = clients.B.pendingRequest.getAll();
            const { id, topic } = pendingRequests[0];

            const result = formatJsonRpcResult(id, "0x");
            await clients.B.respond({
              topic,
              response: result,
            });
            log("Client B received and responded to request after region switch");
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });

      // 6. Verify request completes
      await requestPromise;
      const requestLatency = Date.now() - requestStart;
      log(`Request completed after region switch in ${requestLatency}ms`);

      await deleteClients(clients);
    }, 120_000);
  });
});
