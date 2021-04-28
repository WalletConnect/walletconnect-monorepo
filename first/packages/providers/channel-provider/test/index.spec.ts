import "mocha";
import { expect } from "chai";

import WalletConnectChannelProvider from "../src";

describe("WalletConnectChannelProvider", () => {
  it("instantiate successfully", () => {
    const provider = new WalletConnectChannelProvider({
      bridge: "https://staging.walletconnect.org",
    });
    expect(!!provider).to.be.true;
  });
});
