import { safeJsonParse, safeJsonStringify } from "@walletconnect/safe-json";
import { decodeAppSignatureClaims, hashPlaintext } from "@walletconnect/utils";
import { getDomain } from "tldts";
import type { ProposalTypes, SignClientTypes, Verify } from "@walletconnect/types";

/** An app the Relay vouches nothing for: unsigned, or on Sign v2. */
export const unverified = (isScam = false): Verify.AppVerification => ({
  isVerified: false,
  isScam,
});

/** The JSON-RPC error a wallet answers a request with when its App Signature is for another. */
export const APP_SIGNATURE_MISMATCH = { code: -32600, message: "app_signature_mismatch" };

/** The JSON-RPC error a wallet answers an unsigned request with, on a session pinned to a domain. */
export const APP_SIGNATURE_REQUIRED = { code: -32600, message: "app_signature_required" };

/**
 * The JSON-RPC error a wallet answers a request signed by another domain than the one its session
 * is pinned to with.
 */
export const APP_SIGNATURE_DOMAIN_CHANGED = {
  code: -32600,
  message: "app_signature_domain_changed",
};

/** The errors a wallet answers a request it dropped for its App Signature with, as is. */
export const APP_SIGNATURE_ERRORS: readonly { code: number; message: string }[] = [
  APP_SIGNATURE_MISMATCH,
  APP_SIGNATURE_REQUIRED,
  APP_SIGNATURE_DOMAIN_CHANGED,
];

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

/**
 * The hostname of an origin (or bare host), lowercase, in its ASCII form: an internationalised
 * name comes out as punycode (WHATWG URL parsing), never Unicode. No port. Undefined when there is
 * no hostname.
 */
export function asciiDomain(origin: string): string | undefined {
  for (const candidate of [origin, `https://${origin}`]) {
    try {
      const hostname = new URL(candidate).hostname;
      if (hostname) return hostname.toLowerCase();
    } catch {
      // not a URL: try it as a bare host
    }
  }
  return undefined;
}

/**
 * The registrable domain (eTLD+1) of an ASCII hostname, per the Public Suffix List with its
 * private section (so "alice.github.io", not "github.io"). Undefined for an IP address or a bare
 * public suffix.
 */
export function registrableDomain(domain: string): string | undefined {
  return getDomain(domain, { allowPrivateDomains: true }) ?? undefined;
}

/**
 * Sign v2: the verification of a message the Relay delivered with `appMetadata`, the same rules
 * as Sign v3's. Undefined when its `appMetadata.appSignature` is for another message: `sub` isn't
 * the hash of `plaintext`, the exact bytes the wallet decrypted (never a re-serialisation, which
 * differs from what apps on other SDKs encrypt). Any other
 * claim, such as a `cth` older POC backends signed, is ignored. Without `appMetadata`, only the
 * legacy attestation's `isScam` counts.
 */
export function appVerification(
  appMetadata: Record<string, unknown> | undefined,
  plaintext: string | undefined,
  legacyIsScam = false,
): Verify.AppVerification | undefined {
  if (!appMetadata || typeof appMetadata !== "object") return unverified(legacyIsScam);
  const isSimilarTo = str(appMetadata.isSimilarTo);
  const screening: Verify.AppVerification = {
    ...unverified(legacyIsScam || appMetadata.isScam === true),
    ...(isSimilarTo && { isSimilarTo }),
  };
  const jwt = str(appMetadata.appSignature);
  // unsigned: no identity, whatever else the Relay sent
  if (!jwt) return screening;
  const claims = decodeAppSignatureClaims(jwt);
  const bound = !!claims && plaintext !== undefined && claims.sub === hashPlaintext(plaintext);
  if (!bound) return undefined;
  const origin = str(appMetadata.origin);
  const name = str(appMetadata.name);
  const icon = str(appMetadata.icon);
  const isVerified = appMetadata.isVerified === true;
  // A business name stands for Business verified: never without it.
  const organizationName = isVerified ? str(appMetadata.organizationName) : undefined;
  const domain = origin ? asciiDomain(origin) : undefined;
  const registrable = domain ? registrableDomain(domain) : undefined;
  return {
    ...screening,
    ...(domain && { domain }),
    ...(registrable && { registrableDomain: registrable }),
    ...(name && { name }),
    ...(icon && { icon }),
    ...(organizationName && { organizationName }),
    isVerified,
  };
}

/**
 * The domain a received message's App Signature is for: its `iss`. Undefined when unsigned. The
 * Relay only delivers a signature it accepted, so `iss` is a domain it verified; only use it once
 * {@link appVerification} checked `sub`.
 */
export function signedDomain(appMetadata: Record<string, unknown> | undefined): string | undefined {
  if (!appMetadata || typeof appMetadata !== "object") return undefined;
  const jwt = str(appMetadata.appSignature);
  return jwt ? decodeAppSignatureClaims(jwt)?.iss : undefined;
}

/** Why a wallet dropped a request on a session pinned to a domain. */
export type PinnedDomainRefusal =
  | { code: "app_signature_required"; domain: string }
  | { code: "app_signature_domain_changed"; domain: string; signedBy: string };

/**
 * Wallet side: a session stays signed. It is pinned to the first domain that signs on it: the
 * proposal's (or authenticate request's) `iss` if it was signed, else the `iss` of the first
 * accepted signed request. Once pinned, a request that is unsigned, or signed for another domain,
 * is refused. Before, an unsigned request passes, shown as unverified. `signedBy` is the request's
 * {@link signedDomain}. `pin` is the domain to persist when this request pinned the session.
 */
export function checkPinnedDomain(
  pinned: string | undefined,
  signedBy: string | undefined,
): { pin?: string; refusal?: PinnedDomainRefusal } {
  if (!pinned) return signedBy ? { pin: signedBy } : {};
  if (!signedBy) return { refusal: { code: "app_signature_required", domain: pinned } };
  if (signedBy !== pinned) {
    return { refusal: { code: "app_signature_domain_changed", domain: pinned, signedBy } };
  }
  return {};
}

/** An app's metadata as a wallet keeps it: its self-asserted name, url and icons emptied. */
export function withoutIdentity(
  metadata: SignClientTypes.PeerMetadata | undefined,
): SignClientTypes.Metadata {
  return { ...peerMetadata(metadata), name: "", url: "", icons: [] };
}

/** An app's metadata as a wallet sees it: description, redirect and verifyUrl only. */
export function peerMetadata(
  metadata: SignClientTypes.PeerMetadata | undefined,
): SignClientTypes.PeerMetadata {
  const { description, redirect, verifyUrl } = metadata ?? {};
  return {
    description: description ?? "",
    ...(redirect && { redirect }),
    ...(verifyUrl && { verifyUrl }),
  };
}

/** A proposal as a wallet sees it. */
export function walletProposal(p: ProposalTypes.Struct): ProposalTypes.WalletStruct {
  const {
    proposer,
    attestation: _a,
    encryptedId: _e,
    verification: _v,
    appDomain: _d,
    ...rest
  } = p;
  return {
    ...rest,
    proposer: { publicKey: proposer.publicKey, metadata: peerMetadata(proposer.metadata) },
  };
}

/** The app refused to sign, so the message isn't sent. */
export class AppSignatureError extends Error {
  public readonly code = "app_signature_failed";
  constructor(cause: unknown) {
    super(`app_signature_failed: ${(cause as Error)?.message ?? String(cause)}`);
  }
}

/** Why the Relay refused a request for its App Signature (Verify v4). */
export const APP_SIGNATURE_REFUSALS = ["app_signature_required", "invalid_app_signature"] as const;
export type AppSignatureRefusal = (typeof APP_SIGNATURE_REFUSALS)[number];

/**
 * The Relay refused the request for its App Signature, with `403`: `app_signature_required` when
 * the app's domain requires signatures and none was sent, `invalid_app_signature` when the one
 * sent doesn't check out (`reason` says why, when the Relay said). Sending it again gets the same
 * answer, so `connect()` rejects with this instead of retrying.
 */
export class AppSignatureRefusedError extends Error {
  public readonly name = "AppSignatureRefusedError";
  public readonly status = 403;
  constructor(
    public readonly code: AppSignatureRefusal,
    public readonly reason?: string,
  ) {
    super(reason ? `${code}: ${reason}` : code);
  }
}

const isRefusal = (code: unknown): code is AppSignatureRefusal =>
  APP_SIGNATURE_REFUSALS.includes(code as AppSignatureRefusal);

/**
 * `error` as an {@link AppSignatureRefusedError} when it is the Relay refusing an App Signature:
 * core's `PublishFailedError` (Sign v2 over HTTP, `error` the Relay's code), or the v3 SDK's
 * `forbidden` error, whose message carries the Relay's code.
 */
export function appSignatureRefusal(error: unknown): AppSignatureRefusedError | undefined {
  if (error instanceof AppSignatureRefusedError) return error;
  const e = error as { code?: unknown; error?: unknown; reason?: unknown; message?: unknown };
  if (isRefusal(e?.error)) {
    const reason = typeof e.reason === "string" && e.reason !== e.error ? e.reason : undefined;
    return new AppSignatureRefusedError(e.error, reason);
  }
  if (e?.code === "forbidden" && typeof e.message === "string") {
    const code = APP_SIGNATURE_REFUSALS.find((c) =>
      new RegExp(`\\b${c}\\b`).test(e.message as string),
    );
    if (code) return new AppSignatureRefusedError(code);
  }
  return undefined;
}

/**
 * Sign v2: the app's App Signature for one outgoing request. `sub` covers `requestJson`, the
 * plaintext that gets encrypted: `safeJsonStringify(payload)`, which `crypto.encode` also uses.
 * The app's backend sees this plaintext, so it signs only what it has checked. A wallet hashes the
 * exact bytes it decrypts, so it recomputes `sub` whatever the serialisation. Older JS wallets
 * hashed `JSON.stringify` of what they decoded instead, which gives the same bytes only for a
 * payload that survives a JSON round trip. No claim covers the encrypted envelope: the
 * backend couldn't check one, and the wallet's `sub` check binds the signature to the content.
 */
export async function signV2Request(
  options: Verify.AppSignatureOptions,
  payload: { id: number; method: string },
  logger?: { warn: (msg: string) => void },
): Promise<string> {
  const requestJson = safeJsonStringify(payload);
  if (!legacyRecomputes(requestJson)) {
    logger?.warn(
      "App Signature: this payload doesn't survive a JSON round trip, so older wallets hash other bytes than sub covers and drop it",
    );
  }
  let appSignature: unknown;
  try {
    ({ appSignature } = await options.callback({
      request: payload as unknown as Record<string, unknown>,
      requestJson,
    }));
  } catch (e) {
    throw new AppSignatureError(e);
  }
  if (typeof appSignature !== "string" || !appSignature) {
    throw new AppSignatureError("the callback returned no appSignature");
  }
  return appSignature;
}

/** Does an older wallet's `JSON.stringify(decoded)` give back exactly these bytes, which `sub` covers? */
export function legacyRecomputes(plaintext: string): boolean {
  try {
    return JSON.stringify(safeJsonParse(plaintext)) === plaintext;
  } catch {
    return false;
  }
}
