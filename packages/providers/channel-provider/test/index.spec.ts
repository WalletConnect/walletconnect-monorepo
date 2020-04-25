import WalletConnectChannelProvider from "../src";

describe("WalletConnectChannelProvider", () => {
  it("instantiate successfully", () => {
    const provider = new WalletConnectChannelProvider();
    expect(provider).toBeTruthy();
  });
});
