import WalletConnect from "../src";

describe("WalletConnect", () => {
  it("instantiate successfully", () => {
    const provider = new WalletConnect();
    expect(provider).toBeTruthy();
  });
});
