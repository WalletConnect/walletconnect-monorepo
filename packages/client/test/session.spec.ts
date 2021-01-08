import "mocha";
import { generateRandomBytes32 } from "@walletconnect/utils";

import {
  expect,
  testApproveSession,
  testRejectSession,
  setupClientsForTesting,
  testPairingWithoutSession,
} from "./shared";
import { CLIENT_EVENTS } from "../src";
import { SessionTypes } from "@walletconnect/types";

describe("Session", () => {
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
  it("A proposes session with incorrect pairing topic", async () => {
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
  // it("A proposes session with incorrect permissions", async () => {
  //   const { setup, clients } = await setupClientsForTesting();
  //   const promise = clients.a.connect({
  //     metadata: setup.a.metadata,
  //     // forcing typescript to ignore to inject incorrect permisssions
  //     // @ts-ignore
  //     permissions: { blockchain: setup.a.permissions.blockchain },
  //   });
  //   await expect(promise).to.eventually.be.rejectedWith("Session not approved");
  // });
  // it("A proposes session with incorrect metadata", async () => {
  //   const { setup, clients } = await setupClientsForTesting();
  //   const promise = clients.a.connect({
  //     // forcing typescript to ignore to inject incorrect permisssions
  //     // @ts-ignore
  //     metadata: { name: "" },
  //     permissions: setup.a.permissions,
  //   });
  //   await expect(promise).to.eventually.be.rejectedWith("Incorrect Metadata");
  // });
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
});
