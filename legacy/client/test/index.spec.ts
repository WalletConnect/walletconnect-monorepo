import "mocha";
import { expect } from "chai";

import Connector from "../src";

import { connectTwoClients, TEST_BRIDGE_URL } from "./shared";

describe("Connector", function() {
  this.timeout(30_000);
  it("instantiate successfully", async () => {
    const connector = new Connector({
      bridge: TEST_BRIDGE_URL,
    });
    expect(!!connector).to.be.true;
    // bridge will be randomly selected now
    // expect(connector.bridge).to.eql(TEST_BRIDGE_URL);
    return;
  });

  it("connect two clients", async () => {
    const clientId = await connectTwoClients();
    expect(!!clientId).to.be.true;
  });

  it("connect two clients (with preferred chainId)", async () => {
    const clientId = await connectTwoClients({ chainId: 123 });
    expect(!!clientId).to.be.true;
  });
});
