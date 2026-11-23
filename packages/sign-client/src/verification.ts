import { safeJsonParse, safeJsonStringify } from "@walletconnect/safe-json";
import type { ProposalTypes, SignClientTypes, Verify } from "@walletconnect/types";

/** An app the Relay vouches nothing for: unsigned, or on Sign v2. */
export const unverified = (isScam = false): Verify.AppVerification => ({
  isVerified: false,
  isScam,
});

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
 */
export async function signV2Request(
  options: Verify.AppSignatureOptions,
  payload: { id: number; method: string },
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
      ciphertextHash: null,
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
