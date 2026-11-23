import { describe, expect, it } from "vitest";
import { createHash } from "crypto";
import { formatJsonRpcRequest } from "@walletconnect/jsonrpc-utils";
import { safeJsonParse, safeJsonStringify } from "@walletconnect/safe-json";
import { hashMessage } from "@walletconnect/utils";
import {
  AppSignatureError,
  legacyRecomputes,
  peerMetadata,
  signV2Request,
  unverified,
  walletProposal,
  withoutIdentity,
} from "../../src/verification.js";

const b64u = (s: string) => createHash("sha256").update(s, "utf8").digest("base64url");
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

  it("hands the callback the exact plaintext that gets encrypted", async () => {
    let seen: any;
    const jwt = await signV2Request(
      {
        callback: async (p) => {
          seen = p;
          return { appSignature: `h.${b64u(p.requestJson)}.s` };
        },
      },
      payload,
    );
    // crypto.encode encrypts safeJsonStringify(payload)
    expect(seen.requestJson).toBe(safeJsonStringify(payload));
    expect(seen.request).toBe(payload);
    expect(seen.ciphertextHash).toBeNull();
    // a legacy wallet hashes JSON.stringify of what it decodes: the same digest, hex
    const decoded = safeJsonParse(seen.requestJson);
    expect(hashMessage(JSON.stringify(decoded))).toBe(
      Buffer.from(jwt.split(".")[1], "base64url").toString("hex"),
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
