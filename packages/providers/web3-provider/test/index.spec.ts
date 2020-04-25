import WalletConnectWeb3Provider from "../src";

describe("WalletConnectWeb3Provider", () => {
  it("instantiate successfully", () => {
    const provider = new WalletConnectWeb3Provider({
      rpc: {
        1: "https://api.mycryptoapi.com/eth",
      },
    });
    expect(provider).toBeTruthy();
  });
});
