import "mocha";
import { expect } from "chai";

import WalletConnectEthereumProvider from "../src";

describe("WalletConnectEthereumProvider", () => {
  it("instantiate successfully", () => {
    const provider = new WalletConnectEthereumProvider({
      rpc: {
        1: "https://api.mycryptoapi.com/eth",
      },
    });
    expect(!!provider).to.be.true;
  });
});
