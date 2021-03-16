import "mocha";
import { expect } from "chai";

import WalletConnectChannelProvider from "../src";

describe("WalletConnectChannelProvider", () => {
  it("instantiate successfully", () => {
    const provider = new WalletConnectChannelProvider();
    expect(!!provider).to.be.true;
  });
});
