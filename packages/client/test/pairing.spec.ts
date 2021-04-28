import "mocha";
import sinon from "sinon";
import { KeyValueStorage } from "keyvaluestorage";
import { PairingTypes } from "@walletconnect/types";

import {
  expect,
  setupClientsForTesting,
  testPairingWithoutSession,
  TEST_CLIENT_DATABASE,
  TEST_PAIRING_TTL,
  TEST_TIMEOUT_DURATION,
} from "./shared";
import { CLIENT_EVENTS } from "../src";

describe("Pairing", function() {
  this.timeout(TEST_TIMEOUT_DURATION);
  let clock: sinon.SinonFakeTimers;
  beforeEach(function() {
    clock = sinon.useFakeTimers(Date.now());
  });
  afterEach(function() {
    clock.restore();
  });
  it("A pings B with existing pairing", async () => {
    const { clients } = await setupClientsForTesting();
    await testPairingWithoutSession(clients);
    const topic = clients.a.pairing.topics[0];
    await clients.a.pairing.ping(topic, TEST_TIMEOUT_DURATION);
  });
  it("B pings A with existing pairing", async () => {
    const { clients } = await setupClientsForTesting();
    await testPairingWithoutSession(clients);
    const topic = clients.b.pairing.topics[0];
    await clients.b.pairing.ping(topic, TEST_TIMEOUT_DURATION);
  });
  it("clients ping each other after restart", async () => {
    const storage = new KeyValueStorage({ database: TEST_CLIENT_DATABASE });
    // setup
    const before = await setupClientsForTesting({ shared: { options: { storage } } });
    // pair
    const topic = await testPairingWithoutSession(before.clients);
    // ping
    await before.clients.a.pairing.ping(topic, TEST_TIMEOUT_DURATION);
    await before.clients.b.pairing.ping(topic, TEST_TIMEOUT_DURATION);
    // delete
    delete before.clients;
    // restart
    const after = await setupClientsForTesting({ shared: { options: { storage } } });
    // ping
    await after.clients.a.pairing.ping(topic, TEST_TIMEOUT_DURATION);
    await after.clients.b.pairing.ping(topic, TEST_TIMEOUT_DURATION);
  });
  it("A pings B after A socket reconnects", async () => {
    // setup
    const { clients } = await setupClientsForTesting();
    // pair
    const topic = await testPairingWithoutSession(clients);
    // ping
    await clients.a.pairing.ping(topic, TEST_TIMEOUT_DURATION);
    // disconnect
    await clients.a.relayer.provider.connection.close();
    // ping
    await clients.a.pairing.ping(topic, TEST_TIMEOUT_DURATION);
  });
  it("A pings B after B socket reconnects", async () => {
    // setup
    const { clients } = await setupClientsForTesting();
    // pair
    const topic = await testPairingWithoutSession(clients);
    // ping
    await clients.a.pairing.ping(topic, TEST_TIMEOUT_DURATION);
    // disconnect
    await clients.b.relayer.provider.connection.close();
    // ping
    await clients.a.pairing.ping(topic, TEST_TIMEOUT_DURATION);
  });
  it("should expire after default period is elapsed", function() {
    this.timeout(TEST_PAIRING_TTL);
    return new Promise<void>(async (resolve, reject) => {
      try {
        // setup
        const { clients } = await setupClientsForTesting();
        // pair
        const topic = await testPairingWithoutSession(clients);
        clients.a.on(CLIENT_EVENTS.pairing.deleted, (pairing: PairingTypes.Settled) => {
          expect(pairing.topic).to.eql(topic);
          resolve();
        });
        clock.tick(TEST_PAIRING_TTL);
      } catch (e) {
        reject(e);
      }
    });
  });
});
