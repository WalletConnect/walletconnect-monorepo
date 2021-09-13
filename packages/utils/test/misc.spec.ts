import "mocha";
import { expect } from "chai";

import { calcExpiry, formatRelayRpcUrl, fromMiliseconds, toMiliseconds } from "../src";
import { hasOverlap } from "../dist/cjs";

const TEST_DEFAULT_RPC_URL = "wss://relay.walletconnect.org";

const API_KEY = "27e484dcd9e3efcfd25a83a78777cdf1";

const PROTOCOL = "wc";

const VERSION = 2;

const ENV = "node";

const EXPECTED_RPC_URL_1 =
  TEST_DEFAULT_RPC_URL + `?env=${ENV}&protocol=${PROTOCOL}&version=${VERSION}`;

const EXPECTED_RPC_URL_2 =
  TEST_DEFAULT_RPC_URL + `?apiKey=${API_KEY}&env=${ENV}&protocol=${PROTOCOL}&version=${VERSION}`;

const SEVEN_DAYS = 604800;

const TEST_MILISECONDS = 1628166822000;

const TEST_SECONDS = 1628166822;

const EXPECTED_EXPIRY = 1628771622;

describe("Misc", () => {
  it("formatRpcRelayUrl", () => {
    expect(formatRelayRpcUrl(PROTOCOL, VERSION, TEST_DEFAULT_RPC_URL)).to.eql(EXPECTED_RPC_URL_1);
    expect(formatRelayRpcUrl(PROTOCOL, VERSION, TEST_DEFAULT_RPC_URL, API_KEY)).to.eql(
      EXPECTED_RPC_URL_2,
    );
  });
  it("hasOverlap", () => {
    expect(hasOverlap([], [])).to.be.true;
    expect(hasOverlap(["dog"], ["dog", "cat"])).to.be.true;
    expect(hasOverlap(["dog", "cat"], ["dog"])).to.be.false;
    expect(hasOverlap(["dog"], [])).to.be.false;
  });
  it("toMiliseconds", () => {
    expect(toMiliseconds(TEST_SECONDS)).to.eql(TEST_MILISECONDS);
  });
  it("fromMiliseconds", () => {
    expect(fromMiliseconds(TEST_MILISECONDS)).to.eql(TEST_SECONDS);
  });
  it("calcExpiry", () => {
    expect(calcExpiry(SEVEN_DAYS, TEST_MILISECONDS)).to.eql(EXPECTED_EXPIRY);
  });
});
