import { safeJsonParse, safeJsonStringify } from "@walletconnect/safe-json";
import { decodeAppSignatureClaims, hashEnvelope, hashPlaintext } from "@walletconnect/utils";
import type { ProposalTypes, SignClientTypes, Verify } from "@walletconnect/types";

/** An app the Relay vouches nothing for: unsigned, or on Sign v2. */
export const unverified = (isScam = false): Verify.AppVerification => ({
  isVerified: false,
  isScam,
});

/** The JSON-RPC error a wallet answers a request with when its App Signature is for another. */
export const APP_SIGNATURE_MISMATCH = { code: -32600, message: "app_signature_mismatch" };

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

function domainOf(origin: string): string {
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return origin
      .replace(/^[a-z]+:\/\//i, "")
      .split("/")[0]
      .toLowerCase();
  }
}

/**
 * Sign v2: the verification of a message the Relay delivered with `appMetadata`, the same rules
 * as Sign v3's. Undefined when its `appMetadata.appSignature` is for another message: `sub` isn't
 * the hash of `plaintext` (what a legacy wallet hashes, `JSON.stringify` of the decoded request),
 * or `cth` isn't the hash of the envelope `message`. Without `appMetadata`, only the legacy
 * attestation's `isScam` counts.
 */
export function appVerification(
  appMetadata: Record<string, unknown> | undefined,
  plaintext: string | undefined,
  message: string | undefined,
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
  const bound =
    !!claims &&
    plaintext !== undefined &&
    claims.sub === hashPlaintext(plaintext) &&
    (claims.cth === undefined || (message !== undefined && claims.cth === hashEnvelope(message)));
  if (!bound) return undefined;
  const origin = str(appMetadata.origin);
  const name = str(appMetadata.name);
  const icon = str(appMetadata.icon);
  return {
    ...screening,
    ...(origin && { domain: domainOf(origin) }),
    ...(name && { name }),
    ...(icon && { icon }),
    isVerified: appMetadata.isVerified === true,
  };
}

/** A dApp's metadata as a wallet keeps it: its self-asserted name, url and icons emptied. */
export function withoutIdentity(
  metadata: SignClientTypes.PeerMetadata | undefined,
): SignClientTypes.Metadata {
  return { ...peerMetadata(metadata), name: "", url: "", icons: [] };
}

/** A dApp's metadata as a wallet sees it: description, redirect and verifyUrl only. */
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
  const { proposer, attestation: _a, encryptedId: _e, verification: _v, ...rest } = p;
  return {
    ...rest,
    proposer: { publicKey: proposer.publicKey, metadata: peerMetadata(proposer.metadata) },
  };
}

/** The dApp refused to sign, so the message isn't sent. */
export class AppSignatureError extends Error {
  public readonly code = "app_signature_failed";
  constructor(cause: unknown) {
    super(`app_signature_failed: ${(cause as Error)?.message ?? String(cause)}`);
  }
}

/**
 * Sign v2: the dApp's App Signature for one outgoing request. `sub` covers `requestJson`, the
 * plaintext that gets encrypted: `safeJsonStringify(payload)`, which `crypto.encode` also uses.
 * For a payload without BigInts that's `JSON.stringify(payload)`, and a legacy wallet, which
 * hashes `JSON.stringify` of what it decodes, recomputes the same bytes.
 *
 * `message` is the encrypted envelope as published (base64). `cth` is the hash of its bytes, so
 * the Relay can tie the JWT to this envelope: it can't check `sub` on the WebSocket path, and
 * mints a legacy attestation only when `cth` matches.
 */
export async function signV2Request(
  options: Verify.AppSignatureOptions,
  payload: { id: number; method: string },
  message: string,
  logger?: { warn: (msg: string) => void },
): Promise<string> {
  const requestJson = safeJsonStringify(payload);
  if (!legacyRecomputes(requestJson)) {
    logger?.warn(
      "App Signature: this payload doesn't survive a JSON round trip, so a legacy wallet hashes other bytes",
    );
  }
  let appSignature: unknown;
  try {
    ({ appSignature } = await options.callback({
      request: payload as unknown as Record<string, unknown>,
      requestJson,
      ciphertextHash: hashEnvelope(message),
    }));
  } catch (e) {
    throw new AppSignatureError(e);
  }
  if (typeof appSignature !== "string" || !appSignature) {
    throw new AppSignatureError("the callback returned no appSignature");
  }
  return appSignature;
}

/** Does a legacy wallet's `hashMessage(JSON.stringify(decoded))` hash exactly these bytes? */
export function legacyRecomputes(plaintext: string): boolean {
  try {
    return JSON.stringify(safeJsonParse(plaintext)) === plaintext;
  } catch {
    return false;
  }
}
