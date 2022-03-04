import "mocha";
import { expect } from "chai";

import { calcExpiry, formatRelayRpcUrl } from "../src";
import { hasOverlap } from "../dist/cjs";

const RELAY_URL = "wss://relay.walletconnect.com";

const PROJECT_ID = "27e484dcd9e3efcfd25a83a78777cdf1";

const PROTOCOL = "wc";

const VERSION = 2;

const ENV = "node";

const EXPECTED_RPC_URL_1 = RELAY_URL + `?env=${ENV}&protocol=${PROTOCOL}&version=${VERSION}`;

const EXPECTED_RPC_URL_2 =
  RELAY_URL + `?env=${ENV}&projectId=${PROJECT_ID}&protocol=${PROTOCOL}&version=${VERSION}`;

const SEVEN_DAYS = 604800;

const TEST_MILISECONDS = 1628166822000;

const TEST_SECONDS = 1628166822;

const EXPECTED_EXPIRY = 1628771622;

describe("Misc", () => {
  it("formatRpcRelayUrl", () => {
    expect(formatRelayRpcUrl(PROTOCOL, VERSION, RELAY_URL)).to.eql(EXPECTED_RPC_URL_1);
    expect(formatRelayRpcUrl(PROTOCOL, VERSION, RELAY_URL, PROJECT_ID)).to.eql(EXPECTED_RPC_URL_2);
  });
  it("hasOverlap", () => {
    expect(hasOverlap([], [])).to.be.true;
    expect(hasOverlap(["dog"], ["dog", "cat"])).to.be.true;
    expect(hasOverlap(["dog", "cat"], ["dog"])).to.be.false;
    expect(hasOverlap(["dog"], [])).to.be.false;
  });
  it("calcExpiry", () => {
    expect(calcExpiry(SEVEN_DAYS, TEST_MILISECONDS)).to.eql(EXPECTED_EXPIRY);
  });
});
