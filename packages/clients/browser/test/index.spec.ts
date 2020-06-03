import BrowserWalletConnect from "../src";

describe("BrowserWalletConnect", () => {
  it("instantiate successfully", () => {
    const connector = new BrowserWalletConnect({
      bridge: "https://bridge.walletconnect.org",
    });
    expect(connector).toBeTruthy();
  });
});
