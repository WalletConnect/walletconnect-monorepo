import IsomorphicClient from "../src";
import { connectTwoClients, TEST_BRIDGE_URL } from "./shared";

describe("IsomorphicClient", function () {
  it("instantiate successfully", async () => {
    const connector = new IsomorphicClient({
      bridge: TEST_BRIDGE_URL,
    });
    // console.log("instantiate"); // eslint-disable-line no-console

    expect(!!connector).toBeTruthy();
    expect(connector.bridge).toEqual(TEST_BRIDGE_URL);
    return;
  });

  it("connect two clients", async () => {
    const clientId = await connectTwoClients();
    expect(!!clientId).toBeTruthy();
  });
});
