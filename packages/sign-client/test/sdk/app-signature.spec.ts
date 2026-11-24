import { describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";
import { formatJsonRpcRequest } from "@walletconnect/jsonrpc-utils";
import { safeJsonParse, safeJsonStringify } from "@walletconnect/safe-json";
import { hashMessage } from "@walletconnect/utils";
import { PublishFailedError } from "@walletconnect/core";
import { SignClient } from "../../src/index.js";

// The v3 SDK's errors as SignV3Error builds them (the v3 client is mocked out in test/sdk).
const v3Error = (code: string, message: string) =>
  Object.assign(new Error(`${code}: ${message}`), { code });
import {
  APP_SIGNATURE_MISMATCH,
  AppSignatureError,
  AppSignatureRefusedError,
  appSignatureRefusal,
  appVerification,
  legacyRecomputes,
  peerMetadata,
  signV2Request,
  unverified,
  walletProposal,
  withoutIdentity,
} from "../../src/verification.js";

const b64u = (s: string) => createHash("sha256").update(s, "utf8").digest("base64url");
const jwt = (claims: object) =>
  ["{}", JSON.stringify(claims), "sig"].map((p) => Buffer.from(p).toString("base64url")).join(".");
const metadata = {
  name: "Self-asserted",
  description: "An app",
  url: "https://self-asserted.example",
  icons: ["https://self-asserted.example/i.png"],
  redirect: { native: "app://" },
};

describe("Verify v4 on Sign v2: what the app signs", () => {
  const payload = formatJsonRpcRequest(
    "wc_sessionRequest",
    { chainId: "eip155:1", request: { method: "personal_sign", params: ["0x68", "0xabc"] } },
    1759313100123000,
  );

  it("hands the callback the exact plaintext, and nothing about the envelope", async () => {
    let seen: any;
    await signV2Request(
      {
        callback: async (p) => {
          seen = p;
          return { appSignature: jwt({ sub: b64u(p.requestJson) }) };
        },
      },
      payload,
    );
    // crypto.encode encrypts safeJsonStringify(payload)
    expect(seen.requestJson).toBe(safeJsonStringify(payload));
    expect(seen.request).toBe(payload);
    expect(Object.keys(seen).sort()).toEqual(["request", "requestJson"]);
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
    ).catch((e) => e);
    expect(thrown).toBeInstanceOf(AppSignatureError);
    expect(thrown.code).toBe("app_signature_failed");
    const empty = await signV2Request(
      { callback: async () => ({ appSignature: "" }) },
      payload,
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
  const bound = { sub: b64u(plaintext) };

  it("takes identity from appMetadata once sub checks out", () => {
    expect(appVerification(signed(bound), plaintext)).toEqual({
      domain: "app.example.com",
      name: "App",
      icon: "https://i",
      isVerified: true,
      isScam: false,
    });
  });

  it("ignores a cth older backends still sign", () => {
    expect(appVerification(signed({ ...bound, cth: b64u("anything") }), plaintext)?.domain).toBe(
      "app.example.com",
    );
  });

  it("drops a message whose signature is for another one", () => {
    expect(appVerification(signed({ ...bound, sub: b64u("other") }), plaintext)).toBe(undefined);
    expect(appVerification({ appSignature: "not a jwt" }, plaintext)).toBe(undefined);
    expect(APP_SIGNATURE_MISMATCH).toEqual({ code: -32600, message: "app_signature_mismatch" });
  });

  it("keeps only screening when unsigned, or without appMetadata", () => {
    expect(
      appVerification(
        { origin: "https://evil.example", name: "Bank", isScam: true, isSimilarTo: "bank.example" },
        plaintext,
      ),
    ).toEqual({ isVerified: false, isScam: true, isSimilarTo: "bank.example" });
    // the legacy attestation's isScam still counts
    expect(appVerification(undefined, plaintext, true)).toEqual({
      isVerified: false,
      isScam: true,
    });
  });
});

describe("Verify v4: what a wallet sees of an app", () => {
  it("never the app's own name, url or icons", () => {
    expect(peerMetadata(metadata)).toEqual({
      description: "An app",
      redirect: { native: "app://" },
    });
    expect(withoutIdentity(metadata)).toEqual({
      name: "",
      description: "An app",
      url: "",
      icons: [],
      redirect: { native: "app://" },
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
      metadata: { description: "An app", redirect: { native: "app://" } },
    });
    expect(JSON.stringify(proposal)).not.toContain("self-asserted");
    expect(proposal).not.toHaveProperty("attestation");
  });

  it("an unsigned app is unverified", () => {
    expect(unverified()).toEqual({ isVerified: false, isScam: false });
    expect(unverified(true)).toEqual({ isVerified: false, isScam: true });
  });
});

describe("Verify v4: the Relay refusing an App Signature", () => {
  it("reads the refusal from Sign v2's and Sign v3's errors", () => {
    const required = appSignatureRefusal(
      new PublishFailedError(403, "app_signature_required", "app_signature_required"),
    );
    expect(required).toBeInstanceOf(AppSignatureRefusedError);
    expect(required).toMatchObject({
      code: "app_signature_required",
      reason: undefined,
      status: 403,
    });
    expect(required?.message).toBe("app_signature_required");

    const invalid = appSignatureRefusal(
      new PublishFailedError(403, "bad_signature", "invalid_app_signature"),
    );
    expect(invalid).toMatchObject({ code: "invalid_app_signature", reason: "bad_signature" });
    expect(invalid?.message).toBe("invalid_app_signature: bad_signature");

    const v3 = appSignatureRefusal(v3Error("forbidden", "403 app_signature_required"));
    expect(v3).toMatchObject({ code: "app_signature_required" });
  });

  it("leaves every other error alone, transient ones included", () => {
    for (const error of [
      new PublishFailedError(403, "over limit", "blocked"),
      v3Error("forbidden", "403 not_member"),
      v3Error("network", "connection refused"),
      { code: 500, message: "internal" },
      new Error("Failed to publish custom payload, please try again."),
      undefined,
    ]) {
      expect(appSignatureRefusal(error)).toBeUndefined();
    }
  });

  // connectBoth on a stand-in client: v3 first, then the v2 fallback.
  const connectBoth = (v3Connect: () => Promise<unknown>, engineConnect = vi.fn()) => {
    const self = {
      engine: { connect: engineConnect },
      logger: { warn: vi.fn(), error: vi.fn() },
      cancelledV3: new Set<string>(),
    };
    const run = (SignClient.prototype as any).connectBoth.call(
      self,
      { connect: v3Connect },
      { optionalNamespaces: {} },
    );
    return { run, engineConnect };
  };

  it("rejects connect() on a v3 refusal, without offering v2", async () => {
    const { run, engineConnect } = connectBoth(() =>
      Promise.reject(v3Error("forbidden", "403 app_signature_required")),
    );
    const error = await run.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppSignatureRefusedError);
    expect(error.code).toBe("app_signature_required");
    expect(engineConnect).not.toHaveBeenCalled();
  });

  it("still falls back to v2 when v3 fails for another reason", async () => {
    const offer = { uri: "wc:x@2?symKey=k", approval: vi.fn() };
    const { run, engineConnect } = connectBoth(
      () => Promise.reject(v3Error("network", "connection refused")),
      vi.fn().mockResolvedValue(offer),
    );
    expect(await run).toBe(offer);
    expect(engineConnect).toHaveBeenCalledOnce();
  });
});
