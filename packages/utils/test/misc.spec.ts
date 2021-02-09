import "mocha";
import { expect } from "chai";

import { formatRelayRpcUrl } from "../src";

const TEST_DEFAULT_RPC_URL = "wss://staging.walletconnect.org";

const API_KEY = "27e484dcd9e3efcfd25a83a78777cdf1";

const PROTOCOL = "wc";

const VERSION = 2;

const ENV = "node";

const EXPECTED_RPC_URL_1 =
  TEST_DEFAULT_RPC_URL + `?env=${ENV}&protocol=${PROTOCOL}&version=${VERSION}`;

const EXPECTED_RPC_URL_2 =
  TEST_DEFAULT_RPC_URL + `?apiKey=${API_KEY}&env=${ENV}&protocol=${PROTOCOL}&version=${VERSION}`;

describe("Misc", () => {
  it("formatRpcRelayUrl", () => {
    expect(formatRelayRpcUrl(PROTOCOL, VERSION, TEST_DEFAULT_RPC_URL)).to.eql(EXPECTED_RPC_URL_1);
    expect(
      formatRelayRpcUrl(PROTOCOL, VERSION, TEST_DEFAULT_RPC_URL + `?apiKey=${API_KEY}`),
    ).to.eql(EXPECTED_RPC_URL_2);
  });
});
