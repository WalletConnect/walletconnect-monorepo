import { expect, describe, it, vi, beforeEach, afterEach } from "vitest";
import { calcExpiry, isExpired, formatRelayRpcUrl, hasOverlap, formatUA } from "../src";

const RELAY_URL = "wss://relay.walletconnect.com";

const PROJECT_ID = "27e484dcd9e3efcfd25a83a78777cdf1";

const PROTOCOL = "wc";

const VERSION = 2;

const SDK_VERSION = "2.0.0-rc.1";

const AUTH = "auth.jwt.example";

const EXPECTED_RPC_URL_1 =
  RELAY_URL + `?auth=${AUTH}&ua=${encodeURIComponent(formatUA(PROTOCOL, VERSION, SDK_VERSION))}`;

const EXPECTED_RPC_URL_2 =
  RELAY_URL +
  `?auth=${AUTH}&projectId=${PROJECT_ID}&ua=${encodeURIComponent(
    formatUA(PROTOCOL, VERSION, SDK_VERSION),
  )}`;

const EXPECTED_RPC_URL_3 =
  RELAY_URL +
  `?auth=${AUTH}&projectId=${PROJECT_ID}&ua=${encodeURIComponent(
    formatUA(PROTOCOL, VERSION, SDK_VERSION),
  )}&useOnCloseEvent=true`;

const SEVEN_DAYS_IN_SECONDS = 604800;

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
    expect(
      formatRelayRpcUrl({
        protocol: PROTOCOL,
        version: VERSION,
        sdkVersion: SDK_VERSION,
        relayUrl: RELAY_URL,
        projectId: PROJECT_ID,
        auth: AUTH,
        useOnCloseEvent: true,
      }),
    ).to.eql(EXPECTED_RPC_URL_3);
  });
  it("hasOverlap", () => {
    expect(hasOverlap([], [])).to.be.true;
    expect(hasOverlap(["dog"], ["dog", "cat"])).to.be.true;
    expect(hasOverlap(["dog", "cat"], ["dog"])).to.be.false;
    expect(hasOverlap(["dog"], [])).to.be.false;
  });

  describe("expiry utils", () => {
    beforeEach(() => {
      // Use mocked time for each test run.
      vi.useFakeTimers();
    });
    afterEach(() => {
      // Restore non-mocked date after each.
      vi.useRealTimers();
    });
    describe("calcExpiry", () => {
      const timestampInMs = 1628166822000;
      const expectedExpiry = 1628771622;
      it("returns the expected expiry based on `Date.now()`", () => {
        // Set system time to reference timestamp.
        vi.setSystemTime(new Date(timestampInMs));
        expect(calcExpiry(SEVEN_DAYS_IN_SECONDS)).to.eql(expectedExpiry);
      });
      it("returns the expected expiry based on the provided reference timestamp", () => {
        expect(calcExpiry(SEVEN_DAYS_IN_SECONDS, timestampInMs)).to.eql(expectedExpiry);
      });
    });
    describe("isExpired", () => {
      const expiry = 1675702595; // Feb 06 2023 16:56:35 GMT+0000
      it("is `false` if the provided expiry is less than the current timestamp", () => {
        // Set system time to 2 minutes PRE-expiry.
        vi.setSystemTime(new Date(expiry * 1000 - 120_000));
        expect(isExpired(expiry)).to.be.false;
      });
      it("is `true` if the provided expiry is equal or greater than the current timestamp", () => {
        // Set system time to exactly expiry.
        vi.setSystemTime(new Date(expiry * 1000));
        expect(isExpired(expiry)).to.be.true;
      });
    });
  });
});
