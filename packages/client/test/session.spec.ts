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
      a: Object.keys(clients.a.pairing.entries),
      b: Object.keys(clients.b.pairing.entries),
    };
    const pairing = { topic: pairings.a[0] };
    expect(pairings.b.includes(pairing.topic)).to.be.true;
    const { topic } = await testSessionScenarios({ clients, pairing });
    expect(!!topic).to.be.true;
    const sessions = {
      a: Object.keys(clients.a.session.entries),
      b: Object.keys(clients.b.session.entries),
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
    const { topic, clients } = await testSessionScenarios();
    const session = Object.values(clients.a.session.entries)[0];
    await clients.a.session.ping(session.topic);
    expect(!!topic).to.be.true;
  });
});
