import { describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";
import { formatJsonRpcRequest } from "@walletconnect/jsonrpc-utils";
import { safeJsonParse, safeJsonStringify } from "@walletconnect/safe-json";
import { hashMessage } from "@walletconnect/utils";
import { PublishFailedError } from "@walletconnect/core";
import { SignClient } from "../../src/index.js";
import { Engine } from "../../src/controllers/engine.js";

// The v3 SDK's errors as SignV3Error builds them (the v3 client is mocked out in test/sdk).
const v3Error = (code: string, message: string) =>
  Object.assign(new Error(`${code}: ${message}`), { code });
import {
  APP_SIGNATURE_DOMAIN_CHANGED,
  APP_SIGNATURE_MISMATCH,
  APP_SIGNATURE_REQUIRED,
  AppSignatureError,
  AppSignatureRefusedError,
  appSignatureRefusal,
  appVerification,
  checkPinnedDomain,
  legacyRecomputes,
  peerMetadata,
  signV2Request,
  signedDomain,
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
      registrableDomain: "example.com",
      name: "App",
      icon: "https://i",
      isVerified: true,
      isScam: false,
    });
  });

  it("names the reviewed business only for Business verified", () => {
    const business = { organizationName: "Example Inc." };
    expect(appVerification(signed(bound, business), plaintext)?.organizationName).toBe(
      "Example Inc.",
    );
    const notVerified = appVerification(
      signed(bound, { ...business, isVerified: false }),
      plaintext,
    );
    expect(notVerified?.organizationName).toBeUndefined();
  });

  it("gives the domain in ASCII, never Unicode, with its registrable domain", () => {
    const of = (origin: string) => {
      const v = appVerification(signed(bound, { origin }), plaintext);
      return { domain: v?.domain, registrableDomain: v?.registrableDomain };
    };
    // a Cyrillic look-alike of uniswap.org comes out as punycode
    expect(of("https://app.unisw\u0430p.org")).toEqual({
      domain: "app.xn--uniswp-7nf.org",
      registrableDomain: "xn--uniswp-7nf.org",
    });
    expect(of("https://app.xn--uniswp-7nf.org")).toEqual(of("https://app.unisw\u0430p.org"));
    expect(of("https://Swap.App.Uniswap.ORG:8443")).toEqual({
      domain: "swap.app.uniswap.org",
      registrableDomain: "uniswap.org",
    });
    // public suffixes, private ones included
    expect(of("https://shop.example.co.uk").registrableDomain).toBe("example.co.uk");
    expect(of("https://alice.github.io").registrableDomain).toBe("alice.github.io");
    // none for an IP address or a bare suffix
    expect(of("https://192.168.0.1")).toEqual({
      domain: "192.168.0.1",
      registrableDomain: undefined,
    });
    expect(of("https://co.uk")).toEqual({ domain: "co.uk", registrableDomain: undefined });
    // a bare host, as an older Relay might send
    expect(of("app.example.com").domain).toBe("app.example.com");
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

describe("Verify v4 on Sign v2: a wallet hashes the bytes it decrypted", () => {
  // As an app on another SDK encrypts it: `\/` escaped, keys out of JS's order, `"jsonrpc"` last.
  const plaintext =
    '{"method":"wc_sessionRequest","id":1759313100123000,"params":{"chainId":"eip155:1",' +
    '"request":{"method":"personal_sign","params":["https:\\/\\/app.example","0xabc"]}},"jsonrpc":"2.0"}';
  const topic = "a".repeat(64);

  const wallet = (appMetadata: Record<string, unknown>) => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    const client: any = {
      logger,
      signConfig: { disableRequestQueue: true },
      auth: { authKeys: { keys: [] } },
      events: { emit: vi.fn() },
      session: { get: () => ({ peer: { metadata: {} } }) },
      core: {
        crypto: { getPayloadType: () => 0, decodePlaintext: vi.fn().mockResolvedValue(plaintext) },
        history: { set: vi.fn() },
        relayer: { messages: { ack: vi.fn() } },
        verify: { resolve: vi.fn().mockResolvedValue(undefined) },
      },
    };
    const engine: any = new Engine(client);
    engine.isValidRequest = vi.fn();
    engine.setPendingSessionRequest = vi.fn();
    engine.emitSessionRequest = vi.fn();
    engine.sendError = vi.fn();
    const deliver = () =>
      engine.onRelayMessage({ topic, message: "envelope", publishedAt: 0, appMetadata });
    return { client, engine, deliver };
  };
  const signed = (sub: string) => ({
    origin: "https://app.example",
    name: "App",
    isVerified: true,
    appSignature: jwt({ sub }),
  });

  it("is a plaintext JSON.stringify would rewrite", () => {
    expect(JSON.stringify(JSON.parse(plaintext))).not.toBe(plaintext);
  });

  it("accepts a request whose sub covers the bytes the app encrypted", async () => {
    const { client, engine, deliver } = wallet(signed(b64u(plaintext)));
    await deliver();
    expect(engine.sendError).not.toHaveBeenCalled();
    expect(client.events.emit).not.toHaveBeenCalledWith(
      "app_signature_mismatch",
      expect.anything(),
    );
    const request = engine.emitSessionRequest.mock.calls[0][0];
    expect(request.id).toBe(1759313100123000);
    expect(request.params.request.params[0]).toBe("https://app.example");
    expect(request.verification).toMatchObject({ domain: "app.example", isVerified: true });
  });

  it("drops a request whose sub covers other bytes", async () => {
    for (const sub of [b64u(JSON.stringify(JSON.parse(plaintext))), b64u("other")]) {
      const { client, engine, deliver } = wallet(signed(sub));
      await deliver();
      expect(engine.emitSessionRequest).not.toHaveBeenCalled();
      expect(engine.sendError).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1759313100123000, error: APP_SIGNATURE_MISMATCH }),
      );
      expect(client.events.emit).toHaveBeenCalledWith("app_signature_mismatch", {
        topic,
        id: 1759313100123000,
        method: "wc_sessionRequest",
      });
    }
  });
});

describe("Verify v4 on Sign v2: a session stays signed", () => {
  const topic = "b".repeat(64);
  let nextId = 1759313100123000;
  const request = () =>
    safeJsonStringify(
      formatJsonRpcRequest(
        "wc_sessionRequest",
        { chainId: "eip155:1", request: { method: "personal_sign", params: ["0x68", "0xabc"] } },
        nextId++,
      ),
    );
  const by = (iss: string, plaintext: string) => ({
    origin: `https://${iss}`,
    appSignature: jwt({ iss, sub: b64u(plaintext) }),
  });

  /** A wallet with one session, `appDomain` its pin; `deliver` hands it one request. */
  const wallet = (appDomain?: string) => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    const session: any = { topic, peer: { metadata: {} }, ...(appDomain && { appDomain }) };
    let plaintext = "";
    const client: any = {
      logger,
      signConfig: { disableRequestQueue: true },
      auth: { authKeys: { keys: [] } },
      events: { emit: vi.fn() },
      session: {
        get: () => session,
        update: vi.fn(async (_t: string, u: object) => Object.assign(session, u)),
      },
      core: {
        crypto: {
          getPayloadType: () => 0,
          decodePlaintext: vi.fn(async () => plaintext),
        },
        history: { set: vi.fn() },
        relayer: { messages: { ack: vi.fn() } },
        verify: { resolve: vi.fn().mockResolvedValue(undefined) },
      },
    };
    const engine: any = new Engine(client);
    engine.isValidRequest = vi.fn();
    engine.setPendingSessionRequest = vi.fn();
    engine.emitSessionRequest = vi.fn();
    engine.sendError = vi.fn();
    /** Delivers a request signed by `iss`, or unsigned; its id. */
    const deliver = async (iss?: string) => {
      plaintext = request();
      const appMetadata = iss ? by(iss, plaintext) : undefined;
      await engine.onRelayMessage({ topic, message: "envelope", publishedAt: 0, appMetadata });
      return JSON.parse(plaintext).id as number;
    };
    const shown = () => engine.emitSessionRequest.mock.calls.map((c: any[]) => c[0].id);
    return { client, engine, session, deliver, shown };
  };

  it("pins to the first signing domain, and refuses unsigned or other domains after", () => {
    expect(checkPinnedDomain(undefined, undefined)).toEqual({});
    expect(checkPinnedDomain(undefined, "app.example")).toEqual({ pin: "app.example" });
    expect(checkPinnedDomain("app.example", "app.example")).toEqual({});
    expect(checkPinnedDomain("app.example", undefined)).toEqual({
      refusal: { code: "app_signature_required", domain: "app.example" },
    });
    expect(checkPinnedDomain("app.example", "evil.example")).toEqual({
      refusal: {
        code: "app_signature_domain_changed",
        domain: "app.example",
        signedBy: "evil.example",
      },
    });
    expect(APP_SIGNATURE_REQUIRED).toEqual({ code: -32600, message: "app_signature_required" });
    expect(APP_SIGNATURE_DOMAIN_CHANGED).toEqual({
      code: -32600,
      message: "app_signature_domain_changed",
    });
  });

  it("reads the domain from the signature's iss", () => {
    expect(signedDomain(by("app.example", "x"))).toBe("app.example");
    expect(signedDomain({ origin: "https://app.example" })).toBeUndefined();
    expect(signedDomain({ appSignature: jwt({ sub: "s" }) })).toBeUndefined();
    expect(signedDomain(undefined)).toBeUndefined();
  });

  it("on a pinned session, drops an unsigned request or one from another domain", async () => {
    const { client, engine, deliver, shown } = wallet("app.example");
    const ok = await deliver("app.example");
    expect(shown()).toEqual([ok]);

    const unsigned = await deliver();
    expect(shown()).toEqual([ok]);
    expect(engine.sendError).toHaveBeenCalledWith(
      expect.objectContaining({ id: unsigned, topic, error: APP_SIGNATURE_REQUIRED }),
    );
    expect(client.events.emit).toHaveBeenCalledWith("app_signature_required", {
      topic,
      id: unsigned,
      method: "wc_sessionRequest",
      domain: "app.example",
    });

    const other = await deliver("evil.example");
    expect(shown()).toEqual([ok]);
    expect(engine.sendError).toHaveBeenCalledWith(
      expect.objectContaining({ id: other, topic, error: APP_SIGNATURE_DOMAIN_CHANGED }),
    );
    expect(client.events.emit).toHaveBeenCalledWith("app_signature_domain_changed", {
      topic,
      id: other,
      method: "wc_sessionRequest",
      domain: "app.example",
      signedBy: "evil.example",
    });
    expect(client.session.update).not.toHaveBeenCalled();
  });

  it("before any signature, shows unsigned requests; the first signed one pins", async () => {
    const { client, engine, session, deliver, shown } = wallet();
    const first = await deliver();
    expect(shown()).toEqual([first]);
    expect(session.appDomain).toBeUndefined();

    const signed = await deliver("app.example");
    expect(shown()).toEqual([first, signed]);
    // persisted with the session
    expect(client.session.update).toHaveBeenCalledWith(topic, { appDomain: "app.example" });
    expect(session.appDomain).toBe("app.example");

    await deliver();
    await deliver("evil.example");
    expect(shown()).toEqual([first, signed]);
    expect(engine.sendError.mock.calls.map((c: any[]) => c[0].error)).toEqual([
      APP_SIGNATURE_REQUIRED,
      APP_SIGNATURE_DOMAIN_CHANGED,
    ]);
  });

  it("answers a dropped request with the error as is", async () => {
    const encode = vi.fn().mockResolvedValue("encoded");
    const client: any = {
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      core: {
        crypto: { encode },
        history: { get: vi.fn().mockResolvedValue({ request: { method: "wc_sessionRequest" } }) },
        relayer: { publish: vi.fn().mockResolvedValue(undefined) },
      },
    };
    const engine: any = new Engine(client);
    for (const error of [APP_SIGNATURE_REQUIRED, APP_SIGNATURE_DOMAIN_CHANGED]) {
      await engine.sendError({ id: 1, topic, error }).catch(() => undefined);
      expect(encode).toHaveBeenLastCalledWith(
        topic,
        { id: 1, jsonrpc: "2.0", error },
        expect.anything(),
      );
    }
  });

  it("the app's proposal params can't set the pin, and wallets never see it", () => {
    const proposal = walletProposal({
      id: 1,
      expiryTimestamp: 2,
      relays: [{ protocol: "irn" }],
      proposer: { publicKey: "pk", metadata },
      requiredNamespaces: {},
      optionalNamespaces: {},
      pairingTopic: "t",
      verification: unverified(),
      appDomain: "app.example",
    });
    expect(proposal).not.toHaveProperty("appDomain");
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
