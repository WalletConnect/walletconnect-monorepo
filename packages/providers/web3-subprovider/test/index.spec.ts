import WalletConnectWeb3Subprovider from "../src";

describe("WalletConnectWeb3Subprovider", () => {
  it("instantiate successfully", () => {
    const provider = new WalletConnectWeb3Subprovider({
      bridge: "https://bridge.walletconnect.org",
    });
    expect(!!provider).toBeTruthy();
  });
});
