import "mocha";
import { expect } from "chai";

import { calcExpiry, formatRelayRpcUrl, formatUA } from "../src";
import { hasOverlap } from "../dist/cjs";

const RELAY_URL = "wss://relay.walletconnect.com";

const PROJECT_ID = "27e484dcd9e3efcfd25a83a78777cdf1";

const PROTOCOL = "wc";

const VERSION = 2;

const SDK_VERSION = "2.0.0-beta.102";

const ENV = "node";

const AUTH = "auth.jwt.example";

const EXPECTED_RPC_URL_1 =
  RELAY_URL + `?auth=${AUTH}&ua=${encodeURIComponent(formatUA(PROTOCOL, VERSION, SDK_VERSION))}`;

const EXPECTED_RPC_URL_2 =
  RELAY_URL +
  `?auth=${AUTH}&projectId=${PROJECT_ID}&ua=${encodeURIComponent(
    formatUA(PROTOCOL, VERSION, SDK_VERSION),
  )}`;

const SEVEN_DAYS = 604800;

const TEST_MILISECONDS = 1628166822000;

const EXPECTED_EXPIRY = 1628771622;

describe("Misc", () => {
  it("formatRpcRelayUrl", () => {
    expect(
      formatRelayRpcUrl({
        protocol: PROTOCOL,
        version: VERSION,
        sdkVersion: SDK_VERSION,
        relayUrl: RELAY_URL,
        auth: AUTH,
      }),
    ).to.eql(EXPECTED_RPC_URL_1);
    expect(
      formatRelayRpcUrl({
        protocol: PROTOCOL,
        version: VERSION,
        sdkVersion: SDK_VERSION,
        relayUrl: RELAY_URL,
        projectId: PROJECT_ID,
        auth: AUTH,
      }),
    ).to.eql(EXPECTED_RPC_URL_2);
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
