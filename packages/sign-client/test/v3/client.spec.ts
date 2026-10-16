import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { KeyValueStorage } from "@walletconnect/keyvaluestorage";
import type { SignClientTypes } from "@walletconnect/types";
import { SIGN_V3_DEFAULT_RELAY, SignClient } from "../../src/v3/index.js";

// Against a live v3 Relay; not part of `npm run test`. Run it with:
//   npx vitest run test/v3        TEST_V3_RELAY_URL defaults to the dev Relay
const relayUrl = process.env.TEST_V3_RELAY_URL ?? SIGN_V3_DEFAULT_RELAY;
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
  customStoragePrefix: `wc@3:${name}:${Date.now()}:`,
  storageOptions: { database: ":memory:" },
});

const next = <E extends SignClientTypes.Event>(client: SignClient, event: E) =>
  new Promise<SignClientTypes.EventArguments[E]>((resolve) => client.once(event, resolve));

describe("SignClient over the v3 engine, with v2's API", () => {
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
    });
    expect(uri).toMatch(
      /^wc:[0-2]\d+@2\?relay-protocol=irn&symKey=[0-9a-f]{64}&expiryTimestamp=\d+$/,
    );
    const proposed = next(wallet, "session_proposal");
    const pairing = await wallet.pair({ uri: uri! });
    const { id, params, verifyContext } = await proposed;
    expect(params.proposer.metadata.name).toBe("dapp");
    expect(params.optionalNamespaces.eip155.methods).toEqual(["personal_sign"]);
    expect(params.pairingTopic).toBe(pairing.topic);
    expect(verifyContext.verified.validation).toBe("UNKNOWN");

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
    expect(wallet.session.get(topic).peer.metadata.name).toBe("dapp");
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
