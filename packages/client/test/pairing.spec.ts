import "mocha";
import { expect } from "chai";

import { testSessionScenarios } from "./shared/session";

describe("Pairing", () => {
  it("A pings B with existing pairing", async () => {
    const { clients } = await testSessionScenarios();
    const topic = Object.keys(clients.a.pairing.entries)[0];
    await clients.a.pairing.ping(topic);
    expect(!!clients).to.be.true;
  });
});
