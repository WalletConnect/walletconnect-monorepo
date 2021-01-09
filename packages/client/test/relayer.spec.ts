import "mocha";

import { expect, testApproveSession, setupClientsForTesting } from "./shared";

describe("Relayer", function() {
  this.timeout(30_000);
  it("A pings B after A socket reconnects", async () => {
    // setup
    const { setup, clients } = await setupClientsForTesting();
    // connect
    const topic = await testApproveSession(setup, clients);
    // ping
    await clients.a.session.ping(topic);
    // disconnect
    await clients.a.relayer.provider.connection.close();
    expect(clients.a.relayer.connected).to.be.false;
    // ping
    await clients.a.session.ping(topic);
  });
  it("A pings B after B socket reconnects", async () => {
    // setup
    const { setup, clients } = await setupClientsForTesting();
    // connect
    const topic = await testApproveSession(setup, clients);
    // ping
    await clients.a.session.ping(topic);
    // disconnect
    await clients.b.relayer.provider.connection.close();
    expect(clients.b.relayer.connected).to.be.false;
    // ping
    await clients.a.session.ping(topic);
  });
});
