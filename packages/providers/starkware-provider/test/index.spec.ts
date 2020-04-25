import WalletConnectStarkwareProvider from "../src";

describe("WalletConnectStarkwareProvider", () => {
  it("instantiate successfully", () => {
    const provider = new WalletConnectStarkwareProvider({ contractAddress: "0xdeadbeef" });
    expect(provider).toBeTruthy();
  });
});
