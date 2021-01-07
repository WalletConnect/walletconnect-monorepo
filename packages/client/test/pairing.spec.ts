import "mocha";

import { setupClientsForTesting, testApproveSession } from "./shared";
import { testPairingWithoutSession } from "./shared/pairing";

describe("Pairing", () => {
  it("A pings B with existing pairing", async () => {
    const { clients } = await setupClientsForTesting();
    await testPairingWithoutSession(clients);
    const topic = clients.a.pairing.topics[0];
    await clients.a.pairing.ping(topic);
  });
  it("B pings A with existing pairing", async () => {
    const { clients } = await setupClientsForTesting();
    await testPairingWithoutSession(clients);
    const topic = clients.b.pairing.topics[0];
    await clients.b.pairing.ping(topic);
  });
});
