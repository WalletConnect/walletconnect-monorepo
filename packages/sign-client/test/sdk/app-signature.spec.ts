import { describe, expect, it } from "vitest";
import { createHash } from "crypto";
import { formatJsonRpcRequest } from "@walletconnect/jsonrpc-utils";
import { safeJsonParse, safeJsonStringify } from "@walletconnect/safe-json";
import { hashMessage } from "@walletconnect/utils";
import {
  APP_SIGNATURE_MISMATCH,
  AppSignatureError,
  appVerification,
  legacyRecomputes,
  peerMetadata,
  signV2Request,
  unverified,
  walletProposal,
  withoutIdentity,
} from "../../src/verification.js";

const b64u = (s: string) => createHash("sha256").update(s, "utf8").digest("base64url");
const envelopeHash = (message: string) =>
  createHash("sha256").update(Buffer.from(message, "base64")).digest("base64url");
// a type 0 envelope as published: base64 of type ‖ iv ‖ sealed
const ENVELOPE = Buffer.concat([
  Buffer.from([0]),
  Buffer.alloc(12, 7),
  Buffer.from("sealed"),
]).toString("base64");
const jwt = (claims: object) =>
  ["{}", JSON.stringify(claims), "sig"].map((p) => Buffer.from(p).toString("base64url")).join(".");
const metadata = {
  name: "Self-asserted",
  description: "A dApp",
  url: "https://self-asserted.example",
  icons: ["https://self-asserted.example/i.png"],
  redirect: { native: "dapp://" },
};

describe("Verify v4 on Sign v2: what the app signs", () => {
  const payload = formatJsonRpcRequest(
    "wc_sessionRequest",
    { chainId: "eip155:1", request: { method: "personal_sign", params: ["0x68", "0xabc"] } },
    1759313100123000,
  );

  it("hands the callback the exact plaintext, and cth over the published envelope", async () => {
    let seen: any;
    await signV2Request(
      {
        callback: async (p) => {
          seen = p;
          return { appSignature: jwt({ sub: b64u(p.requestJson), cth: p.ciphertextHash }) };
        },
      },
      payload,
      ENVELOPE,
    );
    // crypto.encode encrypts safeJsonStringify(payload)
    expect(seen.requestJson).toBe(safeJsonStringify(payload));
    expect(seen.request).toBe(payload);
    // cth: SHA-256 of the envelope bytes, the base64-decoded `message`, not of its base64 text
    expect(seen.ciphertextHash).toBe(envelopeHash(ENVELOPE));
    expect(Buffer.from(seen.ciphertextHash, "base64url").toString("hex")).not.toBe(
      hashMessage(ENVELOPE),
    );
    // a legacy wallet hashes JSON.stringify of what it decodes: the same digest as sub, hex
    const decoded = safeJsonParse(seen.requestJson);
    expect(hashMessage(JSON.stringify(decoded))).toBe(
      Buffer.from(b64u(seen.requestJson), "base64url").toString("hex"),
    );
  });

  it("fails with app_signature_failed when the callback throws or returns nothing", async () => {
    const thrown = await signV2Request(
      {
        callback: async () => {
          throw new Error("denylisted");
        },
      },
      payload,
      ENVELOPE,
    ).catch((e) => e);
    expect(thrown).toBeInstanceOf(AppSignatureError);
    expect(thrown.code).toBe("app_signature_failed");
    const empty = await signV2Request(
      { callback: async () => ({ appSignature: "" }) },
      payload,
      ENVELOPE,
    ).catch((e) => e);
    expect(empty.code).toBe("app_signature_failed");
  });

  it("knows when a legacy wallet would hash other bytes", () => {
    expect(legacyRecomputes(safeJsonStringify(payload))).toBe(true);
    // safe-json writes a BigInt as "1n", and reads 17+ digit numbers back as BigInts
    expect(legacyRecomputes(safeJsonStringify({ id: 1, v: BigInt(1) }))).toBe(false);
    expect(legacyRecomputes('{"id":12345678901234567890}')).toBe(false);
  });
});

describe("Verify v4 on Sign v2: what a wallet derives from appMetadata", () => {
  const plaintext = '{"id":1,"jsonrpc":"2.0","method":"wc_sessionRequest","params":{}}';
  const signed = (claims: object, md: object = {}) => ({
    origin: "https://App.Example.com",
    name: "App",
    icon: "https://i",
    isVerified: true,
    ...md,
    appSignature: jwt(claims),
  });
  const bound = { sub: b64u(plaintext), cth: envelopeHash(ENVELOPE) };

  it("takes identity from appMetadata once sub and cth check out", () => {
    expect(appVerification(signed(bound), plaintext, ENVELOPE)).toEqual({
      domain: "app.example.com",
      name: "App",
      icon: "https://i",
      isVerified: true,
      isScam: false,
    });
  });

  it("drops a message whose signature is for another one", () => {
    expect(appVerification(signed({ ...bound, sub: b64u("other") }), plaintext, ENVELOPE)).toBe(
      undefined,
    );
    expect(appVerification(signed({ ...bound, cth: b64u("other") }), plaintext, ENVELOPE)).toBe(
      undefined,
    );
    expect(appVerification({ appSignature: "not a jwt" }, plaintext, ENVELOPE)).toBe(undefined);
    expect(APP_SIGNATURE_MISMATCH).toEqual({ code: -32600, message: "app_signature_mismatch" });
  });

  it("keeps only screening when unsigned, or without appMetadata", () => {
    expect(
      appVerification(
        { origin: "https://evil.example", name: "Bank", isScam: true, isSimilarTo: "bank.example" },
        plaintext,
        ENVELOPE,
      ),
    ).toEqual({ isVerified: false, isScam: true, isSimilarTo: "bank.example" });
    // the legacy attestation's isScam still counts
    expect(appVerification(undefined, plaintext, ENVELOPE, true)).toEqual({
      isVerified: false,
      isScam: true,
    });
  });
});

describe("Verify v4: what a wallet sees of a dApp", () => {
  it("never the dApp's own name, url or icons", () => {
    expect(peerMetadata(metadata)).toEqual({
      description: "A dApp",
      redirect: { native: "dapp://" },
    });
    expect(withoutIdentity(metadata)).toEqual({
      name: "",
      description: "A dApp",
      url: "",
      icons: [],
      redirect: { native: "dapp://" },
    });
    const proposal = walletProposal({
      id: 1,
      expiryTimestamp: 2,
      relays: [{ protocol: "irn" }],
      proposer: { publicKey: "pk", metadata },
      requiredNamespaces: {},
      optionalNamespaces: {},
      pairingTopic: "t",
      attestation: "a",
      encryptedId: "e",
      verification: unverified(true),
    });
    expect(proposal.proposer).toEqual({
      publicKey: "pk",
      metadata: { description: "A dApp", redirect: { native: "dapp://" } },
    });
    expect(JSON.stringify(proposal)).not.toContain("self-asserted");
    expect(proposal).not.toHaveProperty("attestation");
  });

  it("an unsigned app is unverified", () => {
    expect(unverified()).toEqual({ isVerified: false, isScam: false });
    expect(unverified(true)).toEqual({ isVerified: false, isScam: true });
  });
});
