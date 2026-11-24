import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";
import type { Verify } from "@walletconnect/types";
import { hashMessage } from "@walletconnect/utils";
import { SignClient } from "../../src/index.js";
import { V3Client } from "../../src/v3/client.js";
import { legacyRecomputes } from "../../src/verification.js";

// Verify v4 App Signatures on the Sign v2 path, against a live Relay; not part of `npm run test`.
//   npx vitest run test/v3        TEST_V3_RELAY_URL defaults to the dev Relay
const relayUrl = process.env.TEST_V3_RELAY_URL ?? "https://pool-1.dev-relay.walletconnect.com";
const projectId = process.env.TEST_PROJECT_ID ?? "sign-client-v3-test";
const ACCOUNT = "eip155:1:0x1111111111111111111111111111111111111111";
const namespaces = {
  eip155: { chains: ["eip155:1"], methods: ["personal_sign"], events: ["chainChanged"] },
};
const approved = { eip155: { ...namespaces.eip155, accounts: [ACCOUNT] } };

const opts = (name: string, appSignature?: Verify.AppSignatureOptions) => ({
  projectId,
  relayUrl,
  metadata: { name, description: name, url: `https://${name}.example`, icons: [] },
  customStoragePrefix: `${name}:${Date.now()}`,
  storageOptions: { database: ":memory:" },
  appSignature,
});
// a client whose v3 engine doesn't start speaks v2 only, as a legacy wallet does
const initV2Only = (o: ReturnType<typeof opts>) => {
  vi.spyOn(V3Client, "init").mockResolvedValueOnce(undefined as never);
  return SignClient.init(o);
};

const b64u = (s: string) => createHash("sha256").update(s, "utf8").digest("base64url");
const jwt = (claims: object) =>
  [{ alg: "ES256", typ: "JWT" }, claims, "sig"]
    .map((p) => Buffer.from(typeof p === "string" ? p : JSON.stringify(p)).toString("base64url"))
    .join(".");
const claimsOf = (token: string) =>
  JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()) as {
    sub: string;
    cth?: string;
  };
const subOf = (token: string) => claimsOf(token).sub;
/** cth: SHA-256 of the envelope bytes, the base64-decoded `message` as published. */
const envelopeHash = (message: string) =>
  createHash("sha256").update(Buffer.from(message, "base64")).digest("base64url");

/** Stands in for the app's backend: `sub` over `requestJson`, as given. */
function backend() {
  const seen: Verify.AppSignatureParams[] = [];
  const callback = async (p: Verify.AppSignatureParams) => {
    seen.push(p);
    const cth = p.ciphertextHash ? { cth: p.ciphertextHash } : {};
    return {
      appSignature: jwt({ iss: "dapp.example", sub: b64u(p.requestJson), ...cth, exp: 9e9 }),
    };
  };
  return { seen, callback };
}

/** What a client sent to the Relay, by JSON-RPC method: over HTTP or WebSocket alike. */
function relaySends(client: SignClient) {
  const spy = vi.spyOn(client.core.relayer, "request");
  return (method: string) =>
    spy.mock.calls
      .map(([r]) => r as { method: string; params: Record<string, any> })
      .filter((r) => r.method === method);
}

describe("Verify v4 App Signatures on the Sign v2 path", () => {
  const app = backend();
  let dapp: SignClient;
  let v2Wallet: SignClient;

  beforeAll(async () => {
    dapp = await SignClient.init(opts("sig-dapp", { callback: app.callback }));
    v2Wallet = await initV2Only(opts("sig-v2-wallet"));
  });

  afterAll(() => {
    for (const c of [dapp, v2Wallet]) c?.events.removeAllListeners();
  });

  it("signs the v2 proposal and request, sends appSignature, and the legacy hash matches", async () => {
    const sent = relaySends(dapp);
    const published = vi.spyOn(dapp.core.relayer, "publish");
    const register = vi.spyOn(dapp.core.verify, "register");
    const resolve = vi.spyOn(v2Wallet.core.verify, "resolve");

    const { uri, approval } = await dapp.connect({ optionalNamespaces: namespaces });
    // the v3 proposal and the v2 fallback offer are both signed
    expect(app.seen.map((p) => p.request.method)).toEqual([
      "wc_sessionCreate",
      "wc_sessionPropose",
    ]);
    const propose = app.seen[1];
    expect(app.seen[0].ciphertextHash).toBeNull(); // a v3 proposal is never sealed
    expect(JSON.parse(propose.requestJson)).toEqual(propose.request);
    expect(legacyRecomputes(propose.requestJson)).toBe(true);

    const [offer] = sent("wc_proposeSession");
    expect(offer.params.appSignature).toBeTypeOf("string");
    // `sub` covers exactly the plaintext that gets encrypted
    expect(offer.params.sessionProposalPlaintext).toBe(propose.requestJson);
    expect(subOf(offer.params.appSignature)).toBe(b64u(propose.requestJson));
    // `cth` covers exactly the envelope that gets published
    expect(propose.ciphertextHash).toBe(envelopeHash(offer.params.sessionProposal));
    expect(claimsOf(offer.params.appSignature).cth).toBe(
      envelopeHash(offer.params.sessionProposal),
    );

    const proposed = new Promise<any>((r) => v2Wallet.once("session_proposal", r));
    await v2Wallet.pair({ uri: uri! });
    const { id, params, verification } = await proposed;
    expect(verification).toEqual({ isVerified: false, isScam: false });
    expect(params.proposer.metadata).toEqual({ description: "sig-dapp" });
    // the legacy wallet hashes JSON.stringify of what it decrypted: the same digest, as hex
    const legacyHash = resolve.mock.calls[0][0].hash;
    expect(legacyHash).toBe(
      Buffer.from(subOf(offer.params.appSignature), "base64url").toString("hex"),
    );
    expect(legacyHash).toBe(hashMessage(propose.requestJson));

    const { acknowledged } = await v2Wallet.approve({ id, namespaces: approved });
    const session = await approval();
    await acknowledged();

    v2Wallet.once("session_request", ({ id, topic }) =>
      v2Wallet.respond({ topic, response: { id, jsonrpc: "2.0", result: "0xv2" } }),
    );
    const requested = vi.spyOn(v2Wallet.core.verify, "resolve");
    const result = await dapp.request({
      topic: session.topic,
      chainId: "eip155:1",
      request: { method: "personal_sign", params: ["0x68656c6c6f", ACCOUNT] },
    });
    expect(result).toBe("0xv2");
    const signed = app.seen[2];
    expect(signed.request.method).toBe("wc_sessionRequest");
    const publish = sent("irn_publish").find((r) => r.params.appSignature);
    expect(publish?.params.plaintext).toBe(signed.requestJson);
    expect(subOf(publish!.params.appSignature)).toBe(b64u(signed.requestJson));
    expect(signed.ciphertextHash).toBe(envelopeHash(publish!.params.message));
    expect(claimsOf(publish!.params.appSignature).cth).toBe(envelopeHash(publish!.params.message));
    expect(requested.mock.calls.at(-1)![0].hash).toBe(
      Buffer.from(subOf(publish!.params.appSignature), "base64url").toString("hex"),
    );
    // the dApp's v2 responses and other messages aren't signed
    expect(app.seen).toHaveLength(3);
    // a retry after the JWT expired signs the same request and envelope again
    const opts = published.mock.calls.find(([, , o]) => o?.appSignature)![2]!;
    expect(opts.refreshAppSignature).toBeTypeOf("function");
    const renewed = await opts.refreshAppSignature!();
    expect(app.seen).toHaveLength(4);
    expect(app.seen[3].requestJson).toBe(signed.requestJson);
    expect(app.seen[3].ciphertextHash).toBe(signed.ciphertextHash);
    expect(subOf(renewed)).toBe(subOf(publish!.params.appSignature));
    // with an app signature, the old Verify attestation is never fetched
    expect(register).not.toHaveBeenCalled();

    await dapp.disconnect({ topic: session.topic, reason: { code: 6000, message: "bye" } });
  });

  it("fails a v2 connect, and sends nothing, when the callback throws", async () => {
    const v2Dapp = await initV2Only(
      opts("sig-v2-dapp", {
        callback: async () => {
          throw new Error("denylisted");
        },
      }),
    );
    const sent = relaySends(v2Dapp);
    const e = await v2Dapp.connect({ optionalNamespaces: namespaces }).catch((e) => e);
    expect(e.code).toBe("app_signature_failed");
    expect(sent("wc_proposeSession")).toEqual([]);
    v2Dapp.events.removeAllListeners();
  });

  it("fails a v3 dApp's connect, with no v2 fallback, when the callback throws", async () => {
    const failing = await SignClient.init(
      opts("sig-failing-dapp", {
        callback: async () => {
          throw new Error("denylisted");
        },
      }),
    );
    const sent = relaySends(failing);
    const e = await failing.connect({ optionalNamespaces: namespaces }).catch((e) => e);
    expect(e.code).toBe("app_signature_failed");
    expect(sent("wc_proposeSession")).toEqual([]);
    failing.events.removeAllListeners();
  });
});
