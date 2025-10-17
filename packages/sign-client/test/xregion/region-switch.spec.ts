import { expect, describe, it } from "vitest";
import {
  TEST_RELAY_URL,
  TEST_RELAY_URL_US,
  TEST_RELAY_URL_AP,
  TEST_RELAY_URL_EU,
  TEST_RELAY_URL_SA,
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

      // 4. Reconnect A to EU
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

      // 4. Reconnect B to AP
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

    it("clients randomly switch regions and maintain communication", async () => {
      // 1. Initialize paired clients in US region
      const usUrl = getStagingUrl(TEST_RELAY_URL_US);
      const euUrl = getStagingUrl(TEST_RELAY_URL_EU);
      const apUrl = getStagingUrl(TEST_RELAY_URL_AP);
      const saUrl = getStagingUrl(TEST_RELAY_URL_SA);

      log(`Using US URL: ${usUrl}`);
      log(`Available regions: US, EU (${euUrl}), AP (${apUrl}), SA (${saUrl})`);

      const { clients, sessionA } = await initTwoPairedClients(
        { relayUrl: usUrl },
        { relayUrl: usUrl },
        { projectId: TEST_PROJECT_ID },
      );

      log(`Clients paired in US region - session topic: ${sessionA.topic}`);

      // 2. Randomly switch both clients to different regions
      const regions = [
        { name: "US", url: usUrl },
        { name: "EU", url: euUrl },
        { name: "AP", url: apUrl },
        { name: "SA", url: saUrl },
      ];

      // Randomly select regions for each client
      const clientARegion = regions[Math.floor(Math.random() * regions.length)];
      const clientBRegion = regions[Math.floor(Math.random() * regions.length)];

      log(`Switching client A to ${clientARegion.name} region: ${clientARegion.url}`);
      log(`Switching client B to ${clientBRegion.name} region: ${clientBRegion.url}`);

      // Disconnect both clients
      await clients.A.core.relayer.transportClose();
      await clients.B.core.relayer.transportClose();
      log("Both clients disconnected");

      // Reconnect to different regions
      await clients.A.core.relayer.restartTransport(clientARegion.url);
      await clients.B.core.relayer.restartTransport(clientBRegion.url);
      log(`Both clients reconnected to ${clientARegion.name} and ${clientBRegion.name} regions`);

      // 3. Test communication in both directions
      const requestStart = Date.now();

      // Client A sends request to B
      const requestPromiseA = clients.A.request({
        topic: sessionA.topic,
        ...TEST_REQUEST_PARAMS,
      });
      log("Client A sent request to Client B");

      // Client B should receive and respond to the request
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
            log("Client B received and responded to request from Client A");
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });

      await requestPromiseA;
      const requestLatencyA = Date.now() - requestStart;
      log(`Request A->B completed in ${requestLatencyA}ms`);

      // Client B sends request to A
      const requestStartB = Date.now();
      const requestPromiseB = clients.B.request({
        topic: sessionA.topic,
        ...TEST_REQUEST_PARAMS,
      });
      log("Client B sent request to Client A");

      // Client A should receive and respond to the request
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
            log("Client A received and responded to request from Client B");
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });

      await requestPromiseB;
      const requestLatencyB = Date.now() - requestStartB;
      log(`Request B->A completed in ${requestLatencyB}ms`);

      log(
        `Random region switch test completed successfully! A->B: ${requestLatencyA}ms, B->A: ${requestLatencyB}ms`,
      );

      await deleteClients(clients);
    }, 120_000);
  });
});
