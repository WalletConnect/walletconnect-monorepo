import "mocha";
import { expect } from "chai";

import { testSessionScenarios } from "./shared/session";

describe("Session", () => {
  it("A proposes session and B approves", async () => {
    const { topic } = await testSessionScenarios();
    expect(!!topic).to.be.true;
  });
  it("A proposes session and B rejects", async () => {
    const { topic } = await testSessionScenarios({ scenario: "reject-session" });
    expect(!!topic).to.be.false;
  });
  it("A proposes session with existing pairing topic", async () => {
    const { clients } = await testSessionScenarios();
    const pairings = {
      a: clients.a.pairing.topics,
      b: clients.b.pairing.topics,
    };
    const pairing = { topic: pairings.a[0] };
    expect(pairings.b.includes(pairing.topic)).to.be.true;
    const { topic } = await testSessionScenarios({ clients, pairing });
    expect(!!topic).to.be.true;
    const sessions = {
      a: clients.a.session.topics,
      b: clients.b.session.topics,
    };
    expect(sessions.a.includes(topic)).to.be.true;
    expect(sessions.b.includes(topic)).to.be.true;
    expect(sessions.a.length).to.eql(sessions.b.length);
  });
  // FIXME: "Timeout of 2000ms exceeded. For async tests and hooks, ensure "done()" is called;"
  // it("A proposes session with incorrect permissions", async () => {
  //   const { clients } = await testSessionScenarios({ scenario: "incorrect-permissions" });
  //   expect(!!topic).to.be.true;
  // });
  // it("A proposes session with incorrect metadata", async () => {
  //   const { clients } = await testSessionScenarios({ scenario: "incorrect-metadata" });
  //   expect(!!topic).to.be.true;
  // });
  it("A pings B with existing session", async () => {
    const { clients } = await testSessionScenarios();
    const topic = clients.a.session.topics[0];
    await clients.a.session.ping(topic);
  });
});
