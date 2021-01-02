import "mocha";
import { expect } from "chai";

import { testSessionScenarios } from "./shared/session";

describe("Session", () => {
  it("A proposes session and B approves", async () => {
    const { clients } = await testSessionScenarios({ rejectSession: false });
    expect(!!clients).to.be.true;
  });
  it("A proposes session and B rejects", async () => {
    const { clients } = await testSessionScenarios({ rejectSession: true });
    expect(!!clients).to.be.true;
  });
});
