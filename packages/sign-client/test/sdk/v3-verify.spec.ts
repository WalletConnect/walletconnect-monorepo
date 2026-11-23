import { describe, expect, it } from "vitest";
import type { Verify } from "@walletconnect/types";
import { toVerifyContext } from "../../src/v3/verify.js";

const origin = "https://app.example";

describe("Sign v3: Verify v4 onto v2's verifyContext", () => {
  it.each<[Verify.V4Context, Verify.Context["verified"]["validation"]]>([
    [{ state: "verified", origin, name: "App", icon: "https://app.example/i.png" }, "VALID"],
    [{ state: "business_name", origin, name: "App" }, "VALID"],
    [{ state: "domain_validated", origin }, "VALID"],
  ])("signed tiers are VALID with the Relay's origin: %o", (v4, validation) => {
    expect(toVerifyContext(v4)).toEqual({
      verified: { origin, validation, verifyUrl: "" },
      v4,
    });
  });

  it("an unsigned request is UNKNOWN with no origin", () => {
    expect(toVerifyContext({ state: "default" })).toEqual({
      verified: { origin: "", validation: "UNKNOWN", verifyUrl: "" },
      v4: { state: "default" },
    });
  });

  it("a missing context counts as unsigned", () => {
    expect(toVerifyContext(undefined).verified).toEqual({
      origin: "",
      validation: "UNKNOWN",
      verifyUrl: "",
    });
  });

  it("a signature for another request is INVALID with no origin", () => {
    expect(toVerifyContext({ state: "invalid" })).toEqual({
      verified: { origin: "", validation: "INVALID", verifyUrl: "" },
      v4: { state: "invalid" },
    });
  });

  it("carries screening flags, signed or not", () => {
    expect(toVerifyContext({ state: "default", isScam: true, isSimilarTo: "app.example" })).toEqual(
      {
        verified: { origin: "", validation: "UNKNOWN", verifyUrl: "", isScam: true },
        v4: { state: "default", isScam: true, isSimilarTo: "app.example" },
      },
    );
    expect(toVerifyContext({ state: "domain_validated", origin, isScam: false }).verified).toEqual({
      origin,
      validation: "VALID",
      verifyUrl: "",
      isScam: false,
    });
  });
});
