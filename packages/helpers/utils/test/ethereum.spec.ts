import { getAddress } from "@ethersproject/address";

import * as ethereumUtils from "../src/ethereum";

const TEST_ADDRESS = "0x9b7b2B4f7a391b6F14A81221AE0920A9735B67Fb";

describe("Ethereum Utils", () => {
  it("toChecksumAddress", async () => {
    const input = TEST_ADDRESS;
    const expected = getAddress(input);
    const result = ethereumUtils.toChecksumAddress(input);
    expect(result).toEqual(expected);
  });

  it("isValidAddress", async () => {
    const input = TEST_ADDRESS;
    const expected = true;
    const result = ethereumUtils.isValidAddress(input);
    expect(result).toEqual(expected);
  });
});
