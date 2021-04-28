import "mocha";
import { expect } from "chai";

import WalletConnectThreeIdProvider from "../src";

describe("WalletConnectThreeIdProvider", () => {
  it("instantiate successfully", () => {
    const provider = new WalletConnectThreeIdProvider({
      bridge: "https://staging.walletconnect.org",
    });
    expect(!!provider).to.be.true;
  });
});
