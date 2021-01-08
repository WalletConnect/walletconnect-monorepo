import "mocha";
import sinon from "sinon";
import { SessionTypes } from "@walletconnect/types";
import { generateRandomBytes32 } from "@walletconnect/utils";

import {
  expect,
  testApproveSession,
  testRejectSession,
  setupClientsForTesting,
  testPairingWithoutSession,
  TEST_ETHEREUM_ACCOUNTS,
  TEST_CLIENT_DATABASE,
} from "./shared";
import { CLIENT_EVENTS } from "../src";
import { KeyValueStorage } from "keyvaluestorage";

describe("Session", function() {
  this.timeout(30_000);
  let clock: sinon.SinonFakeTimers;
  beforeEach(function() {
    clock = sinon.useFakeTimers();
  });
  afterEach(function() {
    clock.restore();
  });
  it("A proposes session and B approves", async () => {
    const { setup, clients } = await setupClientsForTesting();
    const topic = await testApproveSession(setup, clients);
    expect(!!topic).to.be.true;
  });
  it("A proposes session and B rejects", async () => {
    const { setup, clients } = await setupClientsForTesting();
    const topic = await testRejectSession(setup, clients);
    expect(!!topic).to.be.false;
  });
  it("A proposes session with existing pairing topic", async () => {
    const { setup, clients } = await setupClientsForTesting();
    await testPairingWithoutSession(clients);
    const pairings = {
      a: clients.a.pairing.topics,
      b: clients.b.pairing.topics,
    };
    const pairing = { topic: pairings.a[0] };
    expect(pairings.b.includes(pairing.topic)).to.be.true;
    const topic = await testApproveSession(setup, clients, pairing);
    expect(!!topic).to.be.true;
    const sessions = {
      a: clients.a.session.topics,
      b: clients.b.session.topics,
    };
    expect(sessions.a.includes(topic)).to.be.true;
    expect(sessions.b.includes(topic)).to.be.true;
    expect(sessions.a.length).to.eql(sessions.b.length);
  });
  it("A proposes session with invalid pairing topic", async () => {
    const { setup, clients } = await setupClientsForTesting();
    const pairing = { topic: generateRandomBytes32() };
    const promise = clients.a.connect({
      metadata: setup.a.metadata,
      permissions: setup.a.permissions,
      pairing,
    });
    await expect(promise).to.eventually.be.rejectedWith(
      `No matching pairing settled with topic: ${pairing.topic}`,
    );
  });
  it("A proposes session with invalid permissions", async () => {
    const { setup, clients } = await setupClientsForTesting();
    const pairing = { topic: await testPairingWithoutSession(clients) };
    const permissions = { blockchain: setup.a.permissions.blockchain };
    const promise = clients.a.connect({
      metadata: setup.a.metadata,
      permissions: permissions as any,
      pairing,
    });
    await expect(promise).to.eventually.be.rejectedWith("Missing or invalid jsonrpc permissions");
  });
  it("A proposes session with invalid metadata", async () => {
    const { setup, clients } = await setupClientsForTesting();
    const pairing = { topic: await testPairingWithoutSession(clients) };
    const metadata = { name: "" };
    const promise = clients.a.connect({
      metadata: metadata as any,
      permissions: setup.a.permissions,
      pairing,
    });
    await expect(promise).to.eventually.be.rejectedWith("Missing or invalid metadata name");
  });
  it("B responds session with invalid state", async () => {
    const { setup, clients } = await setupClientsForTesting();
    const pairing = { topic: await testPairingWithoutSession(clients) };
    const response = {
      metadata: setup.b.metadata,
      state: {
        accountIds: TEST_ETHEREUM_ACCOUNTS,
      },
    };
    await Promise.all([
      new Promise<void>(async (resolve, reject) => {
        clients.a.connect({
          metadata: setup.a.metadata,
          permissions: setup.a.permissions,
          pairing,
        });
        resolve();
      }),
      // Client B receives session proposal and rejects it
      new Promise<void>(async (resolve, reject) => {
        clients.b.on(CLIENT_EVENTS.session.proposal, async (proposal: SessionTypes.Proposal) => {
          const promise = clients.b.approve({ proposal, response: response as any });
          await expect(promise).to.eventually.be.rejectedWith(
            "Missing or invalid state accountIds",
          );
          resolve();
        });
      }),
    ]);
  });
  it("B responds session with invalid metadata", async () => {
    const { setup, clients } = await setupClientsForTesting();
    const pairing = { topic: await testPairingWithoutSession(clients) };
    const response = {
      metadata: { name: "" },
      state: setup.b.state,
    };
    await Promise.all([
      new Promise<void>(async (resolve, reject) => {
        clients.a.connect({
          metadata: setup.a.metadata,
          permissions: setup.a.permissions,
          pairing,
        });
        resolve();
      }),
      // Client B receives session proposal and rejects it
      new Promise<void>(async (resolve, reject) => {
        clients.b.on(CLIENT_EVENTS.session.proposal, async (proposal: SessionTypes.Proposal) => {
          const promise = clients.b.approve({ proposal, response: response as any });
          await expect(promise).to.eventually.be.rejectedWith("Missing or invalid metadata name");
          resolve();
        });
      }),
    ]);
  });
  it("A pings B with existing session", async () => {
    const { setup, clients } = await setupClientsForTesting();
    await testApproveSession(setup, clients);
    const topic = clients.a.session.topics[0];
    await clients.a.session.ping(topic);
  });
  it("B pings A with existing session", async () => {
    const { setup, clients } = await setupClientsForTesting();
    await testApproveSession(setup, clients);
    const topic = clients.b.session.topics[0];
    await clients.b.session.ping(topic);
  });
  it("B updates state accounts and A receives event", async () => {
    const state = { accountIds: ["0x8fd00f170fdf3772c5ebdcd90bf257316c69ba45@eip155:1"] };
    const { setup, clients } = await setupClientsForTesting();
    const topic = await testApproveSession(setup, clients);
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        clients.a.on(CLIENT_EVENTS.session.updated, (session: SessionTypes.Settled) => {
          if (session.topic !== topic) return;
          expect(session.state).to.eql(state);
          resolve();
        });
      }),
      new Promise<void>(async (resolve, reject) => {
        await clients.b.update({ topic, update: { state } });
        resolve();
      }),
    ]);
  });
  it("A updates state accounts and error is thrown", async () => {
    const state = { accountIds: ["0x8fd00f170fdf3772c5ebdcd90bf257316c69ba45@eip155:1"] };
    const { setup, clients } = await setupClientsForTesting();
    const topic = await testApproveSession(setup, clients);
    const promise = clients.a.update({ topic, update: { state } });
    await expect(promise).to.eventually.be.rejectedWith(`Unauthorized session update request`);
  });
  it("B emits notification and A receives event", async () => {
    const event = { type: "chainChanged", data: { chainId: "100" } };
    const { setup, clients } = await setupClientsForTesting();
    const topic = await testApproveSession(setup, clients);
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        clients.a.on(
          CLIENT_EVENTS.session.notification,
          (notificationEvent: SessionTypes.NotificationEvent) => {
            if (notificationEvent.topic !== topic) return;
            expect(notificationEvent.type).to.eql(event.type);
            expect(notificationEvent.data).to.eql(event.data);
            resolve();
          },
        );
      }),
      new Promise<void>(async (resolve, reject) => {
        await clients.b.notify({ topic, type: event.type, data: event.data });
        resolve();
      }),
    ]);
  });
  it("A emits notification and error is thrown", async () => {
    const event = { type: "chainChanged", data: { chainId: "100" } };
    const { setup, clients } = await setupClientsForTesting();
    const topic = await testApproveSession(setup, clients);
    const promise = clients.a.notify({ topic, type: event.type, data: event.data });
    await expect(promise).to.eventually.be.rejectedWith(
      `Unauthorized Notification Type Requested: ${event.type}`,
    );
  });
  it("A fails to pings B after A deletes session", async () => {
    const { setup, clients } = await setupClientsForTesting();
    const topic = await testApproveSession(setup, clients);
    await clients.a.disconnect({ topic, reason: "Ending session early" });
    await expect(clients.a.session.get(topic)).to.eventually.be.rejectedWith(
      `No matching session settled with topic: ${topic}`,
    );
    const promise = clients.a.session.ping(topic);
    await expect(promise).to.eventually.be.rejectedWith(
      `No matching session settled with topic: ${topic}`,
    );
  });
  it("A fails to pings B after B deletes session", async () => {
    const { setup, clients } = await setupClientsForTesting();
    const topic = await testApproveSession(setup, clients);
    await clients.b.disconnect({ topic, reason: "Ending session early" });
    await expect(clients.b.session.get(topic)).to.eventually.be.rejectedWith(
      `No matching session settled with topic: ${topic}`,
    );
    const promise = clients.a.session.ping(topic);
    clock.tick(30_000);
    await expect(promise).to.eventually.be.rejectedWith(
      `JSON-RPC Request timeout after 30s: wc_sessionPing`,
    );
  });
  it("clients ping each other after restart", async () => {
    const storage = new KeyValueStorage({ database: TEST_CLIENT_DATABASE });
    // setup
    const before = await setupClientsForTesting({ shared: { options: { storage } } });
    // connect
    const topic = await testApproveSession(before.setup, before.clients);
    // ping
    await before.clients.a.session.ping(topic);
    await before.clients.b.session.ping(topic);
    // delete
    delete before.clients;
    // restart
    const after = await setupClientsForTesting({ shared: { options: { storage } } });
    // ping
    await after.clients.a.session.ping(topic);
    await after.clients.b.session.ping(topic);
  });
  it("A pings B after A socket reconnects", async () => {
    // setup
    const { setup, clients } = await setupClientsForTesting();
    // connect
    const topic = await testApproveSession(setup, clients);
    // ping
    await clients.a.session.ping(topic);
    // disconnect
    await clients.a.relayer.provider.connection.close();
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
    // ping
    await clients.a.session.ping(topic);
  });
});
