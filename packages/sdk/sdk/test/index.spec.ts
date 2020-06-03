import WalletConnect from "../src";

describe("WalletConnect", () => {
  it("instantiate successfully", () => {
    const wc = new WalletConnect();
    expect(wc).toBeTruthy();
  });
});
