import "mocha";
import { expect } from "chai";

import { testApproveSession, testRejectSession } from "./shared/session";
import { setupClientsForTesting } from "./shared";
import { generateRandomBytes32 } from "@walletconnect/utils";
import { testPairingWithoutSession } from "./shared/pairing";

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
    // TODO: chai-as-promised assertions are not typed hence need to be ignored
    // @ts-ignore
    await expect(promise).to.eventually.be.rejectedWith(
      `No matching pairing settled with topic: ${pairing.topic}`,
    );
  });
  // FIXME: "Timeout of 2000ms exceeded. For async tests and hooks, ensure "done()" is called;"
  // it("A proposes session with incorrect permissions", async () => {
  //   const { setup, clients } = await setupClientsForTesting();
  //   const promise = clients.a.connect({
  //     metadata: setup.a.metadata,
  //     // forcing typescript to ignore to inject incorrect permisssions
  //     // @ts-ignore
  //     permissions: { blockchain: setup.a.permissions.blockchain },
  //   });
  //   // TODO: chai-as-promised assertions are not typed hence need to be ignored
  //   // @ts-ignore
  //   await expect(promise).to.eventually.be.rejectedWith("Session not approved");
  // });
  // FIXME: "Timeout of 2000ms exceeded. For async tests and hooks, ensure "done()" is called;"

  // it("A proposes session with incorrect metadata", async () => {
  //   const { setup, clients } = await setupClientsForTesting();
  //   const promise = clients.a.connect({
  //     // forcing typescript to ignore to inject incorrect permisssions
  //     // @ts-ignore
  //     metadata: { name: "" },
  //     permissions: setup.a.permissions,
  //   });
  //   // TODO: chai-as-promised assertions are not typed hence need to be ignored
  //   // @ts-ignore
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
});
