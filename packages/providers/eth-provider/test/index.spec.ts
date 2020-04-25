import WalletConnectEthereumProvider from "../src";

describe("WalletConnectEthereumProvider", () => {
  it("instantiate successfully", () => {
    const provider = new WalletConnectEthereumProvider();
    expect(provider).toBeTruthy();
  });
});
