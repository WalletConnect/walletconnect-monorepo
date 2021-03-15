import "mocha";
import { expect } from "chai";

import WalletConnectThreeIdProvider from "../src";

describe("WalletConnectThreeIdProvider", () => {
  it("instantiate successfully", () => {
    const provider = new WalletConnectThreeIdProvider();
    expect(!!provider).to.be.true;
  });
});
