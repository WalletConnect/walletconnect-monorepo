import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHash, webcrypto } from "crypto";
import type { SignClientTypes, Verify } from "@walletconnect/types";
import { AppSignatureRefusedError, SignClient } from "../../src/index.js";
import { V3Client } from "../../src/v3/client.js";

// Verify v4 App Signatures end to end, over Sign v3 and Sign v2, against a Relay that knows the
// app's domain and its published key; not part of `npm run test`, and skipped without a key. With
// rs-relay's scripts/verify-v4-local stack:
//   TEST_V3_RELAY_URL=http://127.0.0.1:8080 TEST_PROJECT_ID=c0ffee254729296a45a3885639ac7e10 \
//   TEST_APP_SIGNATURE_DOMAIN=dapp.localhost \
//   TEST_APP_SIGNATURE_JWK="$(jq -c .app.privateJwk <stack>/.state/keys.json)" \
//   TEST_APP_SIGNATURE_REQUIRED_ORIGIN=http://required.localhost:3000 \
//   npx vitest run test/v3/app-signature-live.spec.ts
const relayUrl = process.env.TEST_V3_RELAY_URL ?? "https://pool-1.dev-relay.walletconnect.com";
const projectId = process.env.TEST_PROJECT_ID ?? "sign-client-v3-test";
const jwk = process.env.TEST_APP_SIGNATURE_JWK;
const domain = process.env.TEST_APP_SIGNATURE_DOMAIN ?? "dapp.localhost";
// An Origin whose domain requires signatures (the stack's required.localhost).
const requiredOrigin = process.env.TEST_APP_SIGNATURE_REQUIRED_ORIGIN;
const ACCOUNT = "eip155:1:0x1111111111111111111111111111111111111111";
const namespaces = {
  eip155: { chains: ["eip155:1"], methods: ["personal_sign"], events: ["chainChanged"] },
};

const opts = (name: string, appSignature?: Verify.AppSignatureOptions) => ({
  projectId,
  relayUrl,
  metadata: { name, description: name, url: `https://${name}.example`, icons: [] },
  customStoragePrefix: `${name}:${Date.now()}`,
  storageOptions: { database: ":memory:" },
  appSignature,
});

const next = <E extends SignClientTypes.Event>(client: SignClient, event: E) =>
  new Promise<SignClientTypes.EventArguments[E]>((resolve) => client.once(event, resolve));
const b64u = (b: Uint8Array | string) => Buffer.from(b).toString("base64url");
const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("base64url");

/** The app's backend: an ES256 JWT with the domain's published key. */
function backend(privateJwk: string) {
  const parsed = JSON.parse(privateJwk) as webcrypto.JsonWebKey & { kid?: string };
  const key = webcrypto.subtle.importKey(
    "jwk",
    parsed,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const state = {
    tamper: false,
    signed: [] as Verify.AppSignatureParams[],
    fake: undefined as string | undefined,
  };
  const callback = async (p: Verify.AppSignatureParams) => {
    state.signed.push(p);
    // A lying client: `sub` and the plaintext it reports to the Relay are for other bytes than
    // the envelope holds. The Relay's checks (`sub` against that plaintext, `cth` against the
    // envelope) both pass, so only the wallet, which decrypts the envelope, can catch it.
    let subject = p.requestJson;
    if (state.tamper && p.request.method === "wc_sessionRequest") {
      subject = p.requestJson.replace(
        /"0x[0-9a-f]+"/,
        `"0x${Buffer.from("other").toString("hex")}"`,
      );
      state.fake = subject;
    }
    const claims = {
      iss: domain,
      sub: sha(subject),
      ...(p.ciphertextHash ? { cth: p.ciphertextHash } : {}),
      exp: Math.floor(Date.now() / 1000) + 120,
    };
    const header = { alg: "ES256", typ: "JWT", ...(parsed.kid ? { kid: parsed.kid } : {}) };
    const input = `${b64u(JSON.stringify(header))}.${b64u(JSON.stringify(claims))}`;
    const sig = await webcrypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      await key,
      Buffer.from(input),
    );
    return { appSignature: `${input}.${b64u(new Uint8Array(sig))}` };
  };
  return { state, callback };
}

describe.skipIf(!jwk)("Verify v4 App Signatures, live", () => {
  let app: ReturnType<typeof backend>;
  let dapp: SignClient;
  let wallet: SignClient;
  let topic: string;

  beforeAll(async () => {
    app = backend(jwk!);
    dapp = await SignClient.init(opts("live-dapp", { callback: app.callback }));
    wallet = await SignClient.init(opts("live-wallet"));
  });

  afterAll(() => {
    for (const c of [dapp, wallet]) c?.events.removeAllListeners();
  });

  it("the wallet sees the signing domain on the proposal and a request", async () => {
    const { uri, approval } = await dapp.connect({ optionalNamespaces: namespaces });
    const proposed = next(wallet, "session_proposal");
    await wallet.pair({ uri: uri! });
    const proposal = await proposed;
    expect(proposal.verification?.domain).toBe(domain);
    const { acknowledged } = await wallet.approve({
      id: proposal.id,
      namespaces: { eip155: { ...namespaces.eip155, accounts: [ACCOUNT] } },
    });
    topic = (await approval()).topic;
    await acknowledged();

    wallet.once("session_request", ({ id, topic, verification }) => {
      expect(verification?.domain).toBe(domain);
      void wallet.respond({ topic, response: { id, jsonrpc: "2.0", result: "0xsigned" } });
    });
    const result = await dapp.request({
      topic,
      chainId: "eip155:1",
      request: { method: "personal_sign", params: ["0x68656c6c6f", ACCOUNT] },
    });
    expect(result).toBe("0xsigned");
  });

  it("over Sign v2, the wallet drops a request whose sub is for other bytes: app_signature_mismatch", async () => {
    // The v3 Relay checks `sub` itself on unsealed Sign v3 messages, so a mismatch can only get
    // past it on Sign v2, where it sees the plaintext the client reports.
    vi.spyOn(V3Client, "init").mockResolvedValueOnce(undefined as never);
    const v2Dapp = await SignClient.init(opts("live-v2-dapp", { callback: app.callback }));
    const publish = v2Dapp.core.relayer.publish.bind(v2Dapp.core.relayer);
    vi.spyOn(v2Dapp.core.relayer, "publish").mockImplementation((topic, message, o) =>
      publish(
        topic,
        message,
        o?.appSignature && app.state.fake ? { ...o, plaintext: app.state.fake } : o,
      ),
    );
    const { uri, approval } = await v2Dapp.connect({ optionalNamespaces: namespaces });
    const proposed = next(wallet, "session_proposal");
    await wallet.pair({ uri: uri! });
    const proposal = await proposed;
    const { acknowledged } = await wallet.approve({
      id: proposal.id,
      namespaces: { eip155: { ...namespaces.eip155, accounts: [ACCOUNT] } },
    });
    const v2Topic = (await approval()).topic;
    await acknowledged();

    app.state.tamper = true;
    const delivered: unknown[] = [];
    const onRequest = (r: unknown) => delivered.push(r);
    wallet.on("session_request", onRequest);
    const mismatch = next(wallet, "app_signature_mismatch");
    const e = await v2Dapp
      .request({
        topic: v2Topic,
        chainId: "eip155:1",
        request: { method: "personal_sign", params: ["0x74616d7065726564", ACCOUNT] },
      })
      .then(
        (r) => ({ resolved: r }),
        (e) => e,
      );
    wallet.off("session_request", onRequest);
    app.state.tamper = false;
    app.state.fake = undefined;
    v2Dapp.events.removeAllListeners();
    expect((await mismatch).topic).toBe(v2Topic);
    expect(delivered).toEqual([]);
    expect(String(e?.message ?? e)).toContain("app_signature_mismatch");
  });

  it.skipIf(!requiredOrigin)(
    "an unsigned dApp on a domain requiring signatures: connect() rejects at once, no retries",
    async () => {
      // Node sends no Origin; a browser on that domain would.
      const realFetch = globalThis.fetch;
      const relayHost = new URL(relayUrl.replace(/^ws/, "http")).host;
      const sent: string[] = [];
      globalThis.fetch = (input: any, init: any = {}) => {
        const url = String(input?.url ?? input);
        if (new URL(url).host !== relayHost) return realFetch(input, init);
        sent.push(new URL(url).pathname);
        const headers = new Headers(init.headers ?? input?.headers);
        headers.set("origin", requiredOrigin!);
        return realFetch(input, { ...init, headers });
      };
      try {
        const unsigned = await SignClient.init(opts("live-unsigned-dapp"));
        const started = Date.now();
        const e = await unsigned.connect({ optionalNamespaces: namespaces }).catch((e) => e);
        expect(e).toBeInstanceOf(AppSignatureRefusedError);
        expect(e.code).toBe("app_signature_required");
        expect(Date.now() - started).toBeLessThan(5000);
        // v3 refused, and no v2 proposal sent, let alone retried
        expect(sent.filter((p) => p.endsWith("/sessionProposals"))).toEqual([]);
        unsigned.events.removeAllListeners();
      } finally {
        globalThis.fetch = realFetch;
      }
    },
  );
});
