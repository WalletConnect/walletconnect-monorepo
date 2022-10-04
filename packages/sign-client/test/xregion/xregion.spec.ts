import { expect, describe, it } from "vitest";
import SignClient from "../../src";
import {
  TEST_SIGN_CLIENT_OPTIONS,
  TEST_RELAY_URL,
  TEST_RELAY_URL_US,
  TEST_SIGN_CLIENT_OPTIONS_USA,
  TEST_RELAY_URL_AP,
  TEST_RELAY_URL_EU,
  TEST_SIGN_CLIENT_OPTIONS_AP,
  TEST_SIGN_CLIENT_OPTIONS_EU,
  TEST_PROJECT_ID,
  testConnectMethod,
  throttle,
} from "../shared";

describe("X Region", () => {
  it("init", async () => {
    const client = await SignClient.init(TEST_SIGN_CLIENT_OPTIONS);
    expect(client).to.be.exist;
  });

  describe("connect", () => {
    it("connect with default region: ", async () => {
      const client = await SignClient.init(TEST_SIGN_CLIENT_OPTIONS);
      const defaultRelayerRegion = await client.opts?.relayUrl;
      expect(defaultRelayerRegion).to.be.equal(TEST_RELAY_URL);
    });
    it("connect with default region, then switch to USA", async () => {
      const defaultRelayerClient = await SignClient.init(TEST_SIGN_CLIENT_OPTIONS);
      await defaultRelayerClient.disconnect;
      const usRelayerClient = await SignClient.init(TEST_SIGN_CLIENT_OPTIONS_USA);
      const usRelayerRegion = await usRelayerClient.opts?.relayUrl;
      expect(usRelayerRegion).to.be.equal(TEST_RELAY_URL_US);
    });
    it("connect with default region, then switch to EU", async () => {
      const defaultRelayerClient = await SignClient.init(TEST_SIGN_CLIENT_OPTIONS);
      await defaultRelayerClient.disconnect;
      const usRelayerClient = await SignClient.init(TEST_SIGN_CLIENT_OPTIONS_EU);
      const usRelayerRegion = await usRelayerClient.opts?.relayUrl;
      expect(usRelayerRegion).to.be.equal(TEST_RELAY_URL_EU);
    });
    it("connect with default region, then switch to AP", async () => {
      const defaultRelayerClient = await SignClient.init(TEST_SIGN_CLIENT_OPTIONS);
      await defaultRelayerClient.disconnect;
      const usRelayerClient = await SignClient.init(TEST_SIGN_CLIENT_OPTIONS_AP);
      const usRelayerRegion = await usRelayerClient.opts?.relayUrl;
      expect(usRelayerRegion).to.be.equal(TEST_RELAY_URL_AP);
    });
    it("connect with default region, switch to US, then back to default", async () => {
      const defaultRelayerClient = await SignClient.init(TEST_SIGN_CLIENT_OPTIONS);
      await defaultRelayerClient.disconnect;
      const usRelayerClient = await SignClient.init(TEST_SIGN_CLIENT_OPTIONS_AP);
      await usRelayerClient.disconnect;
      const defaultRelayerClientTwo = await SignClient.init(TEST_SIGN_CLIENT_OPTIONS);
      const defaultRelayerRegion = await defaultRelayerClientTwo.opts?.relayUrl;
      expect(defaultRelayerRegion).to.be.equal(TEST_RELAY_URL);
    });
  });
  describe("pairing+ping", () => {
    it.each(regionEndpointPermutations)(
      "pairs client in '%s' with client in '%s'",
      async (clientAUrl: string, clientBUrl: string) => {
        const A = await SignClient.init({
          logger: "fatal",
          relayUrl: clientAUrl,
          projectId: TEST_PROJECT_ID,
          storageOptions: {
            database: ":memory:",
          },
        });
        const B = await SignClient.init({
          logger: "fatal",
          relayUrl: clientBUrl,
          projectId: TEST_PROJECT_ID,
          storageOptions: {
            database: ":memory:",
          },
        });
        log(
          `Clients initialized (relay 'A:${A.core.opts?.relayUrl};B:${
            B.core.opts?.relayUrl
          }'), client ids: A:'${await A.core.crypto.getClientId()}';B:'${await B.core.crypto.getClientId()}'`,
        );
        const { pairingA, sessionA } = await testConnectMethod({ A, B });
        log(
          `Clients connected (relay 'A:${A.core.opts?.relayUrl};B:${
            B.core.opts?.relayUrl
          }', client ids: A:'${await A.core.crypto.getClientId()}';B:'${await B.core.crypto.getClientId()}' pairing topic '${
            pairingA.topic
          }', session topic '${sessionA.topic}')`,
        );
        // Send a ping
        await throttle(500); // Introduce some realistic timeout and allow backend to replicate
        await new Promise<void>(async (resolve, reject) => {
          try {
            B.once("session_ping", (event) => {
              expect(sessionA.topic).to.eql(event.topic);
              resolve();
            });

            await A.ping({ topic: sessionA.topic });
          } catch (e) {
            reject(e);
          }
        });
      },
    );
  });
});

const log = (log: string) => {
  // eslint-disable-next-line no-console
  console.log(log);
};

/**
 * Get all unique permutations of provided regions in pairs
 * @param array the regions to permutate
 * @returns
 */
const getRegionEndpointPermutations = (array: string[]) => {
  const regions: string[][] = [];

  const isDev = TEST_RELAY_URL.includes("dev.");
  const isStaging = TEST_RELAY_URL.includes("staging.");

  for (let i = 0; i < array.length; i++) {
    for (let j = i + 1; j < array.length; j++) {
      if (i == j) continue;
      const list: string[] = [];

      let from = array[i];
      let to = array[j];

      if (isDev) {
        from = from.replace("wss://", "wss://dev.");
        to = to.replace("wss://", "wss://dev.");
      } else if (isStaging) {
        from = from.replace("wss://", "wss://staging.");
        to = to.replace("wss://", "wss://staging.");
      }

      list.push(from);
      list.push(to);
      regions.push(list);
    }
  }

  return regions;
};

const regionEndpointPermutations = getRegionEndpointPermutations([
  TEST_RELAY_URL_EU,
  TEST_RELAY_URL_US,
  TEST_RELAY_URL_AP,
]);
