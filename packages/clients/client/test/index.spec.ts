import "mocha";
import { expect } from "chai";

import IsomorphicClient from "../src";

import { connectTwoClients, TEST_BRIDGE_URL } from "./shared";

describe("IsomorphicClient", function() {
  this.timeout(30_000);
  it("instantiate successfully", async () => {
    const connector = new IsomorphicClient({
      bridge: TEST_BRIDGE_URL,
    });
    // console.log("instantiate"); // eslint-disable-line no-console

    expect(!!connector).to.be.true;
    expect(connector.bridge).to.eql(TEST_BRIDGE_URL);
    return;
  });

  it("connect two clients", async () => {
    const clientId = await connectTwoClients();
    expect(!!clientId).to.be.true;
  });
});
