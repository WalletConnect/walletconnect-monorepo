import type { Verify } from "@walletconnect/types";

const VALIDATION: Record<Verify.V4State, Verify.Context["verified"]["validation"]> = {
  verified: "VALID",
  business_name: "VALID",
  domain_validated: "VALID",
  default: "UNKNOWN",
  invalid: "INVALID",
};

/**
 * Sign v3's Verify v4 context, as the SDK derives it, in v2's `verifyContext` shape, with the
 * full context under `v4`. The origin is only ever the Relay's `appMetadata.origin`: never the
 * app's self-asserted `metadata.url`, so an unsigned request has an empty origin.
 */
export function toVerifyContext(v4: Verify.V4Context | undefined): Verify.Context {
  const ctx: Verify.V4Context = v4 ?? { state: "default" };
  const verified: Verify.Context["verified"] = {
    origin: ctx.state === "invalid" ? "" : (ctx.origin ?? ""),
    validation: VALIDATION[ctx.state] ?? "UNKNOWN",
    verifyUrl: "",
  };
  if (ctx.isScam !== undefined) verified.isScam = ctx.isScam;
  return { verified, v4: ctx };
}
