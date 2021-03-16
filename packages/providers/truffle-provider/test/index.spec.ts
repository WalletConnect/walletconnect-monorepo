import "mocha";
import { expect } from "chai";

import WalletConnectTruffleProvider from "../src";

describe("WalletConnectTruffleProvider", () => {
  it("instantiate successfully", () => {
    const provider = new WalletConnectTruffleProvider({
      rpcUrl: "https://api.mycryptoapi.com/eth",
    });
    expect(!!provider).to.be.true;
  });
});
