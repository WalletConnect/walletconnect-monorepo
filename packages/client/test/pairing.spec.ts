import "mocha";

import { setupClientsForTesting, testApproveSession } from "./shared";

describe("Pairing", () => {
  it("A pings B with existing pairing", async () => {
    const { setup, clients } = await setupClientsForTesting();
    await testApproveSession(setup, clients);
    const topic = clients.a.pairing.topics[0];
    await clients.a.pairing.ping(topic);
  });
  it("B pings A with existing pairing", async () => {
    const { setup, clients } = await setupClientsForTesting();
    await testApproveSession(setup, clients);
    const topic = clients.b.pairing.topics[0];
    await clients.b.pairing.ping(topic);
  });
});
