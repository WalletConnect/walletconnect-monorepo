import "mocha";
import { KeyValueStorage } from "keyvaluestorage";

import { setupClientsForTesting, testPairingWithoutSession, TEST_CLIENT_DATABASE } from "./shared";

describe("Pairing", function() {
  this.timeout(30_000);
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
    const topic = await testPairingWithoutSession(before.clients);
    // ping
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
  it("A pings B after A socket reconnects", async () => {
    // setup
    const { clients } = await setupClientsForTesting();
    // pair
    const topic = await testPairingWithoutSession(clients);
    // ping
    await clients.a.pairing.ping(topic);
    // disconnect
    await clients.a.relayer.provider.connection.close();
    // ping
    await clients.a.pairing.ping(topic);
  });
  it("A pings B after B socket reconnects", async () => {
    // setup
    const { clients } = await setupClientsForTesting();
    // pair
    const topic = await testPairingWithoutSession(clients);
    // ping
    await clients.a.pairing.ping(topic);
    // disconnect
    await clients.b.relayer.provider.connection.close();
    // ping
    await clients.a.pairing.ping(topic);
  });
});
