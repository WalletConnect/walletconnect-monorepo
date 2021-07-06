import "mocha";
import { expect } from "chai";

import WalletConnectSDK from "../src";

describe("WalletConnect", () => {
  describe("When instantiated", () => {
    const walletConnect = new WalletConnectSDK({
      bridge: "https://polygon.bridge.walletconnect.org",
    });

    it("should be an instance of WalletConnectSDK", () => {
      expect(walletConnect).to.be.instanceOf(WalletConnectSDK);
    });
  });
});
