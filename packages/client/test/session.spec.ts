import "mocha";
import { expect } from "chai";

import { testSessionScenarios } from "./shared/session";

describe("Session", () => {
  it("A proposes session and B approves", async () => {
    const { clients } = await testSessionScenarios();
    expect(!!clients).to.be.true;
  });
  it("A proposes session and B rejects", async () => {
    const { clients } = await testSessionScenarios({ scenario: "reject-session" });
    expect(!!clients).to.be.true;
  });
  it("A proposes session with existing pairing topic", async () => {
    const { clients } = await testSessionScenarios();
    expect(!!clients).to.be.true;
    const pairings = {
      a: Object.keys(clients.a.pairing.entries),
      b: Object.keys(clients.b.pairing.entries),
    };
    expect(pairings.a[0]).to.eql(pairings.b[0]);
    const pairing = { topic: pairings.a[0] };
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
  // TODO: implement session propose params validators
  // it("A proposes session with incorrect permissions", async () => {
  //   const { clients } = await testSessionScenarios({ scenario: "incorrect-permissions" });
  //   expect(!!clients).to.be.true;
  // });
  // it("A proposes session with incorrect metadata", async () => {
  //   const { clients } = await testSessionScenarios({ scenario: "incorrect-metadata" });
  //   expect(!!clients).to.be.true;
  // });
});
