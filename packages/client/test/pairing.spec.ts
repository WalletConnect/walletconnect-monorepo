import "mocha";
import { KeyValueStorage } from "keyvaluestorage";

import { setupClientsForTesting, testPairingWithoutSession, TEST_CLIENT_DATABASE } from "./shared";

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
  it("clients ping each other after restart", async () => {
    const storage = new KeyValueStorage({ database: TEST_CLIENT_DATABASE });
    // setup
    const before = await setupClientsForTesting({ shared: { options: { storage } } });
    // pair
    await testPairingWithoutSession(before.clients);
    // ping
    const topic = before.clients.b.pairing.topics[0];
    await before.clients.a.pairing.ping(topic);
    await before.clients.b.pairing.ping(topic);
    // delete
    delete before.clients;
    // restart
    const after = await setupClientsForTesting({ shared: { options: { storage } } });
    // ping
    await after.clients.a.pairing.ping(topic);
    await after.clients.b.pairing.ping(topic);
  });
});
