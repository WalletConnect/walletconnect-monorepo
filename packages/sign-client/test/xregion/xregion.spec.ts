import { expect, describe, it } from "vitest";
import {
  TEST_RELAY_URL,
  TEST_RELAY_URL_US,
  TEST_RELAY_URL_AP,
  TEST_RELAY_URL_EU,
  TEST_PROJECT_ID,
  throttle,
  deleteClients,
  initTwoPairedClients,
} from "../shared";

describe("X Region", () => {
  describe("pairing+ping", () => {
    it.each(regionEndpointPermutations)(
      "pairs client in '%s' with client in '%s'",
      async (clientAUrl: string, clientBUrl: string) => {
        const { clients, pairingA, sessionA } = await initTwoPairedClients(
          { relayUrl: clientAUrl },
          { relayUrl: clientBUrl },
          { projectId: TEST_PROJECT_ID },
        );
        const { A, B } = clients;
        log(
          `Clients initialized (relay 'A:${A.core.opts?.relayUrl};B:${
            B.core.opts?.relayUrl
          }'), client ids: A:'${await A.core.crypto.getClientId()}';B:'${await B.core.crypto.getClientId()}'`,
        );
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
        await deleteClients({ A, B });
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
