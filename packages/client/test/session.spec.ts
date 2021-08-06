import "mocha";
import sinon from "sinon";
import { KeyValueStorage } from "keyvaluestorage";
import { SessionTypes } from "@walletconnect/types";
import { ERROR, generateRandomBytes32 } from "@walletconnect/utils";

import {
  expect,
  testApproveSession,
  testRejectSession,
  setupClientsForTesting,
  testPairingWithoutSession,
  TEST_ETHEREUM_ACCOUNTS,
  TEST_CLIENT_DATABASE,
  TEST_TIMEOUT_DURATION,
  testJsonRpcRequest,
  TEST_SESSION_TTL,
} from "./shared";
import { CLIENT_EVENTS } from "../src";
import { ErrorResponse, formatJsonRpcResult } from "@walletconnect/jsonrpc-utils";

describe("Session", function() {
  this.timeout(TEST_TIMEOUT_DURATION);
  let clock: sinon.SinonFakeTimers;
  beforeEach(function() {
    clock = sinon.useFakeTimers(Date.now());
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
      state: {
        accounts: TEST_ETHEREUM_ACCOUNTS,
      },
    };
    await Promise.all([
      new Promise<void>(async (resolve, reject) => {
        clients.a.connect({
          permissions: setup.a.permissions,
          pairing,
        });
        resolve();
      }),
      // Client B receives session proposal and rejects it
      new Promise<void>(async (resolve, reject) => {
        clients.b.on(CLIENT_EVENTS.session.proposal, async (proposal: SessionTypes.Proposal) => {
          const promise = clients.b.approve({ proposal, response: response as any });
          await expect(promise).to.eventually.be.rejectedWith("Missing or invalid state accounts");
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
    const topic = await testApproveSession(setup, clients);
    await clients.a.session.ping(topic, TEST_TIMEOUT_DURATION);
  });
  it("B pings A with existing session", async () => {
    const { setup, clients } = await setupClientsForTesting();
    const topic = await testApproveSession(setup, clients);
    await clients.b.session.ping(topic, TEST_TIMEOUT_DURATION);
  });
  it("B updates state accounts and A receives event", async () => {
    const state = { accounts: ["eip155:1:0x8fd00f170fdf3772c5ebdcd90bf257316c69ba45"] };
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
        await clients.b.update({ topic, state });
        resolve();
      }),
    ]);
  });
  it("A updates state accounts and error is thrown", async () => {
    const state = { accounts: ["eip155:1:0x8fd00f170fdf3772c5ebdcd90bf257316c69ba45"] };
    const { setup, clients } = await setupClientsForTesting();
    const topic = await testApproveSession(setup, clients);
    const promise = clients.a.update({ topic, state });
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
  // FIXME: chainId is leaking to TEST_PERMISSIONS and breaking following tests
  //
  it("B upgrades permissions and A receives event", async () => {
    const chainId = "eip155:300";
    const request = {
      method: "personal_sign",
      params: ["0xdeadbeaf", "0x9b2055d370f73ec7d8a03e965129118dc8f5bf83"],
    };
    const { setup, clients } = await setupClientsForTesting();
    const topic = await testApproveSession(setup, clients);
    // first - attempt sending request to new chainId
    const promise = clients.a.request({ topic, request, chainId, timeout: TEST_TIMEOUT_DURATION });
    await expect(promise).to.eventually.be.rejectedWith(
      `Unauthorized Target ChainId Requested: ${chainId}`,
    );
    // second - upgrade permissions to include new chainId
    await Promise.all([
      new Promise<void>(async (resolve, reject) => {
        clients.a.on(CLIENT_EVENTS.session.updated, (session: SessionTypes.Settled) => {
          if (!session.permissions.blockchain.chains.includes(chainId)) {
            return reject(new Error(`Updated session permissions missing new chainId: ${chainId}`));
          }
          resolve();
        });
      }),
      new Promise<void>(async (resolve, reject) => {
        try {
          await clients.b.upgrade({ topic, permissions: { blockchain: { chains: [chainId] } } });
          resolve();
        } catch (e) {
          reject(e);
        }
      }),
    ]);
    // third - send request again with new chainId and respond
    await testJsonRpcRequest(setup, clients, topic, request, formatJsonRpcResult(1, "0xdeadbeaf"));
  });
  it("A upgrades permissions and error is thrown", async () => {
    const { setup, clients } = await setupClientsForTesting();
    const topic = await testApproveSession(setup, clients);
    const promise = clients.a.upgrade({
      topic,
      permissions: { blockchain: { chains: ["eip155:123"] } },
    });
    await expect(promise).to.eventually.be.rejectedWith(`Unauthorized session upgrade request`);
  });
  it("A fails to pings B after A deletes session", async () => {
    const { setup, clients } = await setupClientsForTesting();
    const topic = await testApproveSession(setup, clients);
    const reason = ERROR.USER_DISCONNECTED.format();
    await clients.a.disconnect({ topic, reason });
    await expect(clients.a.session.get(topic)).to.eventually.be.rejectedWith(
      `No matching session settled with topic: ${topic}`,
    );
    const promise = clients.a.session.ping(topic, TEST_TIMEOUT_DURATION);
    await expect(promise).to.eventually.be.rejectedWith(
      `No matching session settled with topic: ${topic}`,
    );
  });
  it("A fails to pings B after B deletes session", async () => {
    const { setup, clients } = await setupClientsForTesting();
    const topic = await testApproveSession(setup, clients);
    const reason = ERROR.USER_DISCONNECTED.format();
    await clients.b.disconnect({ topic, reason });
    await expect(clients.b.session.get(topic)).to.eventually.be.rejectedWith(
      `No matching session settled with topic: ${topic}`,
    );
    clients.a.session
      .ping(topic, TEST_TIMEOUT_DURATION)
      .then(() => {
        throw new Error("Should not resolve");
      })
      .catch(e => {
        expect(e.message).to.equal(
          `JSON-RPC Request timeout after ${TEST_TIMEOUT_DURATION / 1000} seconds: wc_sessionPing`,
        );
      });
    clock.tick(TEST_TIMEOUT_DURATION);
  });
  it("clients ping each other after restart", async () => {
    const storage = new KeyValueStorage({ database: TEST_CLIENT_DATABASE });
    // setup
    const before = await setupClientsForTesting({ shared: { options: { storage } } });
    // connect
    const topic = await testApproveSession(before.setup, before.clients);
    // ping
    await before.clients.a.session.ping(topic, TEST_TIMEOUT_DURATION);
    await before.clients.b.session.ping(topic, TEST_TIMEOUT_DURATION);
    // delete
    delete before.clients;
    // restart
    const after = await setupClientsForTesting({ shared: { options: { storage } } });
    // ping
    await after.clients.a.session.ping(topic, TEST_TIMEOUT_DURATION);
    await after.clients.b.session.ping(topic, TEST_TIMEOUT_DURATION);
  });
  it("should expire after default period is elapsed", function() {
    this.timeout(TEST_SESSION_TTL);
    return new Promise<void>(async (resolve, reject) => {
      try {
        // setup
        const { setup, clients } = await setupClientsForTesting();
        // connect
        const topic = await testApproveSession(setup, clients);
        clients.a.on(
          CLIENT_EVENTS.session.deleted,
          (session: SessionTypes.Settled, reason: ErrorResponse) => {
            expect(reason).to.eql(ERROR.EXPIRED.format({ context: "Session Settled" }));
            expect(session.topic).to.eql(topic);
            resolve();
          },
        );
        clock.tick(TEST_SESSION_TTL);
      } catch (e) {
        reject(e);
      }
    });
  });
  it("can find compatible sessions from permission set", async () => {
    const { setup, clients } = await setupClientsForTesting();
    const topic = await testApproveSession(setup, clients);
    const incompatible = await clients.a.session.find({ blockchain: { chains: ["eip155:123"] } });
    expect(!!incompatible).to.be.true;
    expect(incompatible.length).to.eql(0);
    const compatible = await clients.a.session.find({ blockchain: { chains: ["eip155:1"] } });
    expect(!!compatible).to.be.true;
    expect(compatible.length).to.eql(1);
    expect(compatible[0].topic).to.eql(topic);
  });
});
