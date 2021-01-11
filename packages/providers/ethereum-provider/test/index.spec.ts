import WalletConnectEthereumProvider from "../src";

describe("WalletConnectEthereumProvider", () => {
  it("instantiate successfully", () => {
    const provider = new WalletConnectEthereumProvider({
      rpc: {
        1: "https://api.mycryptoapi.com/eth",
      },
    });
    expect(provider).toBeTruthy();
  });
});
