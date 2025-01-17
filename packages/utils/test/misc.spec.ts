import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calcExpiry,
  formatDeeplinkUrl,
  formatRelayRpcUrl,
  formatUA,
  getSearchParamFromURL,
  hasOverlap,
  isExpired,
  toBase64,
  openDeeplink,
  isIframe,
} from "../src";

const RELAY_URL = "wss://relay.walletconnect.org";

const PROJECT_ID = "27e484dcd9e3efcfd25a83a78777cdf1";

const PROTOCOL = "wc";

const VERSION = 2;

const SDK_VERSION = "2.0.0-rc.1";

const AUTH = "auth.jwt.example";

const PACKAGE_NAME = "com.example.app";

const BUNDLE_ID = "com.example.app.bundle";

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

const EXPECTED_RPC_URL_4 =
  RELAY_URL +
  `?auth=${AUTH}&packageName=${PACKAGE_NAME}&projectId=${PROJECT_ID}&ua=${encodeURIComponent(
    formatUA(PROTOCOL, VERSION, SDK_VERSION),
  )}`;

const EXPECTED_RPC_URL_5 =
  RELAY_URL +
  `?auth=${AUTH}&bundleId=${BUNDLE_ID}&projectId=${PROJECT_ID}&ua=${encodeURIComponent(
    formatUA(PROTOCOL, VERSION, SDK_VERSION),
  )}`;

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
    expect(
      formatRelayRpcUrl({
        protocol: PROTOCOL,
        version: VERSION,
        sdkVersion: SDK_VERSION,
        relayUrl: RELAY_URL,
        projectId: PROJECT_ID,
        auth: AUTH,
        packageName: PACKAGE_NAME,
      }),
    ).to.eql(EXPECTED_RPC_URL_4);
    expect(
      formatRelayRpcUrl({
        protocol: PROTOCOL,
        version: VERSION,
        sdkVersion: SDK_VERSION,
        relayUrl: RELAY_URL,
        projectId: PROJECT_ID,
        auth: AUTH,
        bundleId: BUNDLE_ID,
      }),
    ).to.eql(EXPECTED_RPC_URL_5);
  });
  it("hasOverlap", () => {
    expect(hasOverlap([], [])).to.be.true;
    expect(hasOverlap(["dog"], ["dog", "cat"])).to.be.true;
    expect(hasOverlap(["dog", "cat"], ["dog"])).to.be.false;
    expect(hasOverlap(["dog"], [])).to.be.false;
  });
  it("getSearchParamFromURL", () => {
    const url = "https://example.com?foo=bar&baz=qux";
    const searchParam1 = "foo";
    const expectedValue1 = "bar";
    const searchParam2 = "baz";
    const expectedValue2 = "qux";
    expect(getSearchParamFromURL(url, searchParam1)).to.eql(expectedValue1);
    expect(getSearchParamFromURL(url, searchParam2)).to.eql(expectedValue2);
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
  describe("deep links", () => {
    it("should format universal link", () => {
      const deepLink = "https://example.com";
      const requestId = 123;
      const sessionTopic = "randomSessionTopic";
      const expectedDeepLink = `${deepLink}/wc?requestId=${requestId}&sessionTopic=${sessionTopic}`;
      const formatted = formatDeeplinkUrl(deepLink, requestId, sessionTopic);
      expect(formatted).to.eql(expectedDeepLink);
    });
    it("should format deep link", () => {
      const deepLink = "trust://";
      const requestId = 123;
      const sessionTopic = "randomSessionTopic";
      const expectedDeepLink = `${deepLink}wc?requestId=${requestId}&sessionTopic=${sessionTopic}`;
      const formatted = formatDeeplinkUrl(deepLink, requestId, sessionTopic);
      expect(formatted).to.eql(expectedDeepLink);
    });
    it("should format telegram universal link", async () => {
      const deepLink = "https://t.me";
      const requestId = 123;
      const sessionTopic = "randomSessionTopic";
      const partToEncode = `requestId=${requestId}&sessionTopic=${sessionTopic}`;
      const expectedDeepLink = `${deepLink}?startapp=${toBase64(partToEncode, true)}`;
      const formatted = formatDeeplinkUrl(deepLink, requestId, sessionTopic);
      expect(formatted).to.eql(expectedDeepLink);
      const decoded = atob(formatted.split("startapp=")[1]);
      expect(decoded).to.eql(partToEncode);
    });

    describe("openDeeplink", () => {
      const previousWindow = globalThis.window;

      beforeEach(() => {
        Object.assign(globalThis, {
          window: {
            open: vi.fn(),
          },
        });
      });

      afterAll(() => {
        Object.assign(globalThis, {
          window: previousWindow,
        });
      });

      it("should target '_blank' if link starts with 'https://'", () => {
        const url = "https://example.com";
        openDeeplink(url);
        expect(window.open).toHaveBeenCalledWith(url, "_blank", "noreferrer noopener");
      });

      it("should target '_blank' if link starts with 'http://'", () => {
        const url = "http://example.com";
        openDeeplink(url);
        expect(window.open).toHaveBeenCalledWith(url, "_blank", "noreferrer noopener");
      });

      it("should target '_blank' for telegram deep link", () => {
        Object.assign(window, {
          Telegram: {},
        });

        const url = "scheme://example.com";
        openDeeplink(url);
        expect(window.open).toHaveBeenCalledWith(url, "_blank", "noreferrer noopener");

        (window as any).Telegram = undefined;
      });

      it("should target '_top' if is an iframe", () => {
        Object.assign(window, {
          top: {},
        });

        const url = "scheme://example.com";
        openDeeplink(url);
        expect(window.open).toHaveBeenCalledWith(url, "_top", "noreferrer noopener");
      });

      it("should target '_self' for other cases", () => {
        const url = "scheme://example.com";
        openDeeplink(url);
        expect(window.open).toHaveBeenCalledWith(url, "_self", "noreferrer noopener");
      });
    });
  });

  describe("isIframe", () => {
    const previousWindow = globalThis.window;

    afterEach(() => {
      Object.assign(globalThis, { window: previousWindow });
    });

    it("should return true if window.top is not equal to window", () => {
      Object.assign(globalThis, {
        window: {
          top: {},
        },
      });
      expect(isIframe()).to.be.true;
    });

    it("should return false if window.top is equal to window", () => {
      expect(isIframe()).to.be.false;
    });
  });
});
