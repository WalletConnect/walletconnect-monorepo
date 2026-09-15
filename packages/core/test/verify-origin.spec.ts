import { describe, expect, it } from "vitest";

import { isTrustedVerifyOrigin } from "../src/constants/verify";

describe("verify origin validation", () => {
  it("accepts messages originating from the trusted verify servers", () => {
    expect(isTrustedVerifyOrigin("https://verify.walletconnect.org")).toBe(true);
    expect(isTrustedVerifyOrigin("https://verify.walletconnect.com")).toBe(true);
  });

  it("rejects messages from untrusted origins", () => {
    expect(isTrustedVerifyOrigin("https://evil.example.com")).toBe(false);
    expect(isTrustedVerifyOrigin("https://verify.walletconnect.com.evil.example")).toBe(false);
    expect(isTrustedVerifyOrigin("http://verify.walletconnect.org")).toBe(false);
    expect(isTrustedVerifyOrigin("null")).toBe(false);
    expect(isTrustedVerifyOrigin("")).toBe(false);
  });
});
