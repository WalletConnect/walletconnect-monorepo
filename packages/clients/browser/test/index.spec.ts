import BrowserWalletConnect from "../src";

describe("BrowserWalletConnect", () => {
  it("instantiate successfully", () => {
    const provider = new BrowserWalletConnect({
      bridge: "https://bridge.walletconnect.org",
    });
    expect(provider).toBeTruthy();
  });
});
