import WalletConnectSDK from "../src";

describe("WalletConnect", () => {
  describe("When instantiated", () => {
    const walletConnect = new WalletConnectSDK();

    it("should be an instance of WalletConnectSDK", () => {
      expect(walletConnect).toBeInstanceOf(WalletConnectSDK);
    });
  });
});
