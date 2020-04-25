import IsomorphicClient from "../src";

describe("IsomorphicClient", () => {
  it("instantiate successfully", () => {
    const provider = new IsomorphicClient({
      bridge: "https://bridge.walletconnect.org",
    });
    expect(provider).toBeTruthy();
  });
});
