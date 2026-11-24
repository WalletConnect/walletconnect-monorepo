import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { KeyValueStorage } from "@walletconnect/keyvaluestorage";
import type { SignClientTypes } from "@walletconnect/types";
import { hashKey, parseUri } from "@walletconnect/utils";
import { SignClient as Client } from "../../src/index.js";
import { V3Client } from "../../src/v3/client.js";

type SignClient = InstanceType<typeof Client>;
const SignClient = Client;

// Against a live v3 Relay; not part of `npm run test`. Run it with:
//   npx vitest run test/v3        TEST_V3_RELAY_URL defaults to the dev Relay
const relayUrl = process.env.TEST_V3_RELAY_URL ?? "https://pool-1.dev-relay.walletconnect.com";
const projectId = process.env.TEST_PROJECT_ID ?? "sign-client-v3-test";
const ACCOUNT = "eip155:1:0x1111111111111111111111111111111111111111";

const meta = (name: string) => ({
  name,
  description: name,
  url: `https://${name}.example`,
  icons: [],
});
const opts = (name: string) => ({
  projectId,
  relayUrl,
  metadata: meta(name),
  customStoragePrefix: `${name}:${Date.now()}`,
  storageOptions: { database: ":memory:" },
});

const next = <E extends SignClientTypes.Event>(client: SignClient, event: E) =>
  new Promise<SignClientTypes.EventArguments[E]>((resolve) => client.once(event, resolve));

describe("SignClient over both protocols: v3 to v3", () => {
  let dapp: SignClient;
  let wallet: SignClient;
  let topic: string;

  beforeAll(async () => {
    dapp = await SignClient.init(opts("dapp"));
    wallet = await SignClient.init(opts("wallet"));
  });

  afterAll(() => {
    for (const c of [dapp, wallet]) c?.events.removeAllListeners();
  });

  it("connects: connect, pair, session_proposal, approve, approval", async () => {
    const { uri, approval } = await dapp.connect({
      optionalNamespaces: {
        eip155: { chains: ["eip155:1"], methods: ["personal_sign"], events: ["chainChanged"] },
      },
      scopedProperties: { eip155: { walletService: [{ url: "https://w", methods: ["x"] }] } },
    });
    expect(uri).toMatch(
      /^wc:[0-9a-f]{64}@2\?relay-protocol=irn&symKey=[0-9a-f]{64}&expiryTimestamp=\d+&v3=[0-2]\d+$/,
    );
    expect(parseUri(uri!).topic).toBe(hashKey(parseUri(uri!).symKey));
    const proposed = next(wallet, "session_proposal");
    const pairing = await wallet.pair({ uri: uri! });
    const { id, params, verification } = await proposed;
    // wallets never see the app's own name, url or icons
    expect(params.proposer.metadata).toEqual({ description: "dapp" });
    expect(params.optionalNamespaces.eip155.methods).toEqual(["personal_sign"]);
    expect(params.scopedProperties).toEqual({
      eip155: { walletService: [{ url: "https://w", methods: ["x"] }] },
    });
    expect(params.pairingTopic).toBe(pairing.topic);
    expect(verification).toEqual({ isVerified: false, isScam: false });

    const { topic: walletTopic, acknowledged } = await wallet.approve({
      id,
      namespaces: {
        eip155: {
          chains: ["eip155:1"],
          methods: ["personal_sign"],
          events: ["chainChanged"],
          accounts: [ACCOUNT],
        },
      },
    });
    const session = await approval();
    topic = session.topic;
    expect(walletTopic).toBe(topic);
    expect((await acknowledged()).topic).toBe(topic);
    expect(session.peer.metadata.name).toBe("wallet");
    expect(session.namespaces.eip155.accounts).toEqual([ACCOUNT]);
    expect(dapp.session.getAll().map((s) => s.topic)).toEqual([topic]);
    expect(wallet.session.get(topic).peer.metadata).toEqual({
      name: "",
      description: "dapp",
      url: "",
      icons: [],
    });
    expect(wallet.session.get(topic).verification).toEqual({ isVerified: false, isScam: false });
  });

  it("round-trips a request with v2's session_request and respond", async () => {
    wallet.once("session_request", ({ id, topic: t, params }) => {
      expect(params).toEqual({
        chainId: "eip155:1",
        request: { method: "personal_sign", params: ["0x68656c6c6f", ACCOUNT] },
      });
      void wallet.respond({ topic: t, response: { id, jsonrpc: "2.0", result: "0xsig" } });
    });
    const result = await dapp.request({
      topic,
      chainId: "eip155:1",
      request: { method: "personal_sign", params: ["0x68656c6c6f", ACCOUNT] },
    });
    expect(result).toBe("0xsig");
  });

  it("rejects request() with the wallet's { code, message }, as v2 does", async () => {
    wallet.once("session_request", ({ id, topic: t }) => {
      void wallet.respond({
        topic: t,
        response: { id, jsonrpc: "2.0", error: { code: 5000, message: "User rejected." } },
      });
    });
    await expect(
      dapp.request({
        topic,
        chainId: "eip155:1",
        request: { method: "personal_sign", params: [] },
      }),
    ).rejects.toEqual({
      code: 5000,
      message: "User rejected.",
    });
  });

  it("delivers session events and pings", async () => {
    const event = next(dapp, "session_event");
    await wallet.emit({ topic, chainId: "eip155:1", event: { name: "chainChanged", data: 137 } });
    expect((await event).params).toEqual({
      chainId: "eip155:1",
      event: { name: "chainChanged", data: 137 },
    });
    await dapp.ping({ topic });
  });

  it("rejects approval() with USER_REJECTED when the wallet rejects", async () => {
    const { uri, approval } = await dapp.connect({
      optionalNamespaces: { eip155: { chains: ["eip155:1"], methods: [], events: [] } },
    });
    const proposed = next(wallet, "session_proposal");
    await wallet.pair({ uri: uri! });
    await wallet.reject({
      id: (await proposed).id,
      reason: { code: 5000, message: "User rejected." },
    });
    await expect(approval()).rejects.toEqual({ code: 5000, message: "User rejected." });
  });

  it("restores sessions from storage after a restart", async () => {
    const storage = new KeyValueStorage({ database: ":memory:" });
    const shared = { ...opts("restart"), storage };
    const first = await SignClient.init(shared);
    const { uri, approval } = await first.connect({
      optionalNamespaces: {
        eip155: { chains: ["eip155:1"], methods: ["personal_sign"], events: [] },
      },
    });
    const proposed = next(wallet, "session_proposal");
    await wallet.pair({ uri: uri! });
    await wallet.approve({
      id: (await proposed).id,
      namespaces: {
        eip155: {
          chains: ["eip155:1"],
          methods: ["personal_sign"],
          events: [],
          accounts: [ACCOUNT],
        },
      },
    });
    const { topic: restored } = await approval();
    first.events.removeAllListeners();

    const again = await SignClient.init(shared);
    expect(again.session.getAll().map((s) => s.topic)).toEqual([restored]);
    expect(await again.core.crypto.getClientId()).toBe(await first.core.crypto.getClientId());
    wallet.once(
      "session_request",
      ({ id, topic: t }) =>
        void wallet.respond({ topic: t, response: { id, jsonrpc: "2.0", result: "0xagain" } }),
    );
    expect(
      await again.request({
        topic: restored,
        chainId: "eip155:1",
        request: { method: "personal_sign", params: [] },
      }),
    ).toBe("0xagain");
    const gone = next(wallet, "session_delete");
    await again.disconnect({
      topic: restored,
      reason: { code: 6000, message: "User disconnected." },
    });
    expect((await gone).topic).toBe(restored);
  });

  it("tells the peer on disconnect", async () => {
    const deleted = next(wallet, "session_delete");
    await dapp.disconnect({ topic, reason: { code: 6000, message: "User disconnected." } });
    expect((await deleted).topic).toBe(topic);
    expect(dapp.session.getAll()).toEqual([]);
    expect(wallet.session.getAll()).toEqual([]);
  });
});

describe("SignClient over both protocols: the v2 fallback", () => {
  const namespaces = {
    eip155: { chains: ["eip155:1"], methods: ["personal_sign"], events: ["chainChanged"] },
  };
  const approved = { eip155: { ...namespaces.eip155, accounts: [ACCOUNT] } };
  const personalSign = { method: "personal_sign", params: ["0x68656c6c6f", ACCOUNT] };
  // a client whose v3 engine doesn't start speaks v2 only, as a legacy one does
  const initV2Only = (name: string) => {
    vi.spyOn(V3Client, "init").mockResolvedValueOnce(undefined as never);
    return SignClient.init(opts(name));
  };
  const answer = (wallet: SignClient, result: string) =>
    wallet.once(
      "session_request",
      ({ id, topic }) => void wallet.respond({ topic, response: { id, jsonrpc: "2.0", result } }),
    );

  let dapp: SignClient;
  let wallet: SignClient;
  let v2Wallet: SignClient;
  let v2Dapp: SignClient;

  beforeAll(async () => {
    dapp = await SignClient.init(opts("fallback-dapp"));
    wallet = await SignClient.init(opts("fallback-wallet"));
    v2Wallet = await initV2Only("v2-wallet");
    v2Dapp = await initV2Only("v2-dapp");
  });

  afterAll(() => {
    for (const c of [dapp, wallet, v2Wallet, v2Dapp]) c?.events.removeAllListeners();
  });

  it("a v2 wallet pairs on a v3 dApp's URI and gets a v2 session", async () => {
    const { uri, approval } = await dapp.connect({ optionalNamespaces: namespaces });
    const proposed = next(v2Wallet, "session_proposal");
    await v2Wallet.pair({ uri: uri! });
    const { id, params } = await proposed;
    expect(params.pairingTopic).toBe(parseUri(uri!).topic);
    const { acknowledged } = await v2Wallet.approve({ id, namespaces: approved });
    const session = await approval();
    await acknowledged();
    expect(session.topic).toMatch(/^[0-9a-f]{64}$/);
    expect(dapp.session.get(session.topic).peer.metadata.name).toBe("v2-wallet");

    answer(v2Wallet, "0xv2");
    expect(
      await dapp.request({ topic: session.topic, chainId: "eip155:1", request: personalSign }),
    ).toBe("0xv2");

    const deleted = next(v2Wallet, "session_delete");
    await dapp.disconnect({ topic: session.topic, reason: { code: 6000, message: "bye" } });
    expect((await deleted).topic).toBe(session.topic);
  });

  it("closes a v3 session that arrives after a v2 wallet has won", async () => {
    const { uri, approval } = await dapp.connect({ optionalNamespaces: namespaces });
    const v2Proposed = next(v2Wallet, "session_proposal");
    await v2Wallet.pair({ uri: uri! });
    await v2Wallet.approve({ id: (await v2Proposed).id, namespaces: approved });
    const session = await approval();

    const proposed = next(wallet, "session_proposal");
    await wallet.pair({ uri: uri! });
    const closed = next(wallet, "session_delete");
    const late = await wallet.approve({ id: (await proposed).id, namespaces: approved });
    expect((await closed).topic).toBe(late.topic);
    expect(dapp.session.keys).toEqual([session.topic]);
    await dapp.disconnect({ topic: session.topic, reason: { code: 6000, message: "bye" } });
  });

  it("drops the v2 offer once a v3 wallet has won", async () => {
    const { uri, approval } = await dapp.connect({ optionalNamespaces: namespaces });
    const pairingTopic = parseUri(uri!).topic;
    expect(dapp.core.pairing.pairings.keys).toContain(pairingTopic);
    const proposed = next(wallet, "session_proposal");
    await wallet.pair({ uri: uri! });
    await wallet.approve({ id: (await proposed).id, namespaces: approved });
    const session = await approval();
    expect(session.topic).toMatch(/^[0-2]\d+$/);
    await new Promise((r) => setTimeout(r, 500));
    expect(dapp.core.pairing.pairings.keys).not.toContain(pairingTopic);
    expect(dapp.proposal.getAll()).toEqual([]);
    expect(dapp.core.crypto.keychain.has(pairingTopic)).toBe(false);
    await dapp.disconnect({ topic: session.topic, reason: { code: 6000, message: "bye" } });
  });

  it("a v3 wallet pairs on a v2 dApp's URI and gets a v2 session", async () => {
    const { uri, approval } = await v2Dapp.connect({ optionalNamespaces: namespaces });
    expect(uri).not.toContain("v3=");
    const proposed = next(wallet, "session_proposal");
    await wallet.pair({ uri: uri! });
    const { acknowledged } = await wallet.approve({
      id: (await proposed).id,
      namespaces: approved,
    });
    const session = await approval();
    await acknowledged();
    // a v2 session hides the app's own identity too
    expect(wallet.session.get(session.topic).peer.metadata.name).toBe("");
    expect(wallet.session.get(session.topic).verification).toEqual({
      isVerified: false,
      isScam: false,
    });

    answer(wallet, "0xrouted");
    expect(
      await v2Dapp.request({ topic: session.topic, chainId: "eip155:1", request: personalSign }),
    ).toBe("0xrouted");
    await wallet.disconnect({ topic: session.topic, reason: { code: 6000, message: "bye" } });
  });
});
