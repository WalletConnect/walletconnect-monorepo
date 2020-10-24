import Client from "../src";

const TEST_RELAY_PROVIDER_URL = "http://localhost:5555";

const TEST_SESSION_PARAMS = {
  accounts: ["0x1d85568eEAbad713fBB5293B45ea066e552A90De@eip155:1"],
};

describe("Client", () => {
  it("instantiate successfully", () => {
    const connector = new Client({ relayProvider: TEST_RELAY_PROVIDER_URL });
    expect(connector).toBeTruthy();
  });
});
