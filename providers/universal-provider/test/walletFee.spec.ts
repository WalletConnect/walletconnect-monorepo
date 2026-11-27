import { expect, describe, it, afterEach, vi } from "vitest";
import { RELAYER_SDK_VERSION } from "@walletconnect/core";

import UniversalProvider, { WalletFee } from "../src/index.js";
import { fetchWalletFeeConfig, isSameWalletFee } from "../src/utils/index.js";
import {
  deleteProviders,
  disconnectSocket,
  testConnectMethod,
  TEST_ETHEREUM_ACCOUNT,
  TEST_ETHEREUM_ADDRESS,
  TEST_ETHEREUM_CHAIN,
  TEST_NAMESPACES,
  TEST_OPTIMISM_ACCOUNT,
  TEST_OPTIMISM_CHAIN,
  TEST_PROVIDER_OPTS,
} from "./shared/index.js";

const WALLET_GUIDE_ID = "wallet-guide-id";
const SOLANA_CHAIN = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
const SOLANA_ADDRESS = "7S3P4HxJpyyigGzodYwHtCxZyUQe9JiBMHyRWXArAaKv";
const CONFIG = {
  feeBps: 50,
  recipients: [
    TEST_ETHEREUM_ACCOUNT,
    TEST_OPTIMISM_ACCOUNT,
    `${SOLANA_CHAIN}:${SOLANA_ADDRESS}`,
    // malformed: no address
    "eip155:5",
  ],
  referralCode: "ref-123",
};
// what `getWalletFee()` resolves for CONFIG
const WALLET_FEE: WalletFee = {
  feeBps: 50,
  referralCode: "ref-123",
  recipients: [
    { chainId: TEST_ETHEREUM_CHAIN, address: TEST_ETHEREUM_ADDRESS },
    { chainId: TEST_OPTIMISM_CHAIN, address: TEST_ETHEREUM_ADDRESS },
    { chainId: SOLANA_CHAIN, address: SOLANA_ADDRESS },
  ],
};
const realFetch = globalThis.fetch;

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

// stubs `fetch` for wallet fee requests only, so other traffic keeps working
function stubFetch(handler: (init?: RequestInit) => Response | Promise<Response>) {
  const requests: URL[] = [];
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (!url.pathname.endsWith("/wallet-fee/v1/config")) return realFetch(input, init);
    requests.push(url);
    return handler(init);
  });
  return requests;
}

// fake host bridge that hands the pairing URI to the test wallet
function stubHostBridge() {
  let deliverUri: (uri: string) => void = () => undefined;
  const pairingUri = new Promise<string>((resolve) => (deliverUri = resolve));
  vi.stubGlobal("window", {
    walletConnectHost: { autoConnect: true, postMessage: ({ uri }) => deliverUri(uri) },
  });
  return pairingUri;
}

async function connect({
  hostLaunch = true,
  walletGuideId = WALLET_GUIDE_ID as string | null,
  database = `./test/tmp/dappDB-wallet-fee-${Date.now()}.db`,
} = {}) {
  const pairingUri = hostLaunch ? stubHostBridge() : undefined;
  const dapp = await UniversalProvider.init({
    ...TEST_PROVIDER_OPTS,
    name: "dapp",
    storageOptions: { database },
    walletFeeApiUrl: "https://staging.example.com",
  });
  const wallet = await UniversalProvider.init({ ...TEST_PROVIDER_OPTS, name: "wallet" });
  const events: (WalletFee | undefined)[] = [];
  dapp.on("wallet_fee_changed", (fee: WalletFee | undefined) => events.push(fee));
  const sessionProperties = walletGuideId === null ? undefined : { wallet_guide_id: walletGuideId };
  await testConnectMethod({ dapp, wallet }, { pairingUri, sessionProperties });
  return { dapp, wallet, events, database };
}

// the wallet updates the session, which makes the dapp fetch the config again
async function updateSession(dapp: UniversalProvider, wallet: UniversalProvider) {
  const updated = new Promise((resolve) => dapp.once("session_update", resolve));
  await wallet.client.update({ topic: dapp.session!.topic, namespaces: TEST_NAMESPACES });
  await updated;
  await dapp.getWalletFee();
}

describe("UniversalProvider wallet fee", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe("fetchWalletFeeConfig", () => {
    const logger = { info: vi.fn(), warn: vi.fn() };
    const fetchConfig = () =>
      fetchWalletFeeConfig({
        projectId: "pid",
        walletGuideId: WALLET_GUIDE_ID,
        logger: logger as any,
      });

    afterEach(() => vi.clearAllMocks());

    it("returns the parsed config and sends the query params", async () => {
      const requests = stubFetch(() => json(CONFIG));
      expect(await fetchConfig()).toEqual(WALLET_FEE);
      expect(requests[0].origin).toBe("https://api.walletconnect.com");
      expect(Object.fromEntries(requests[0].searchParams)).toEqual({
        projectId: "pid",
        walletId: WALLET_GUIDE_ID,
        st: "universal-provider",
        sv: `js-${RELAYER_SDK_VERSION}`,
      });
    });

    it("bypasses the browser cache", async () => {
      const inits: (RequestInit | undefined)[] = [];
      stubFetch((init) => {
        inits.push(init);
        return json(CONFIG);
      });
      await fetchConfig();
      expect(inits).toHaveLength(1);
      expect(inits[0]?.cache).toBe("no-store");
    });

    it("drops malformed recipients", async () => {
      const recipients = ["eip155:1", "eip155:1:", ":1:0xabc", "eip155:1:0xabc:0xdef", 42, null];
      stubFetch(() => json({ recipients: [...recipients, TEST_ETHEREUM_ACCOUNT] }));
      expect(await fetchConfig()).toEqual({
        recipients: [{ chainId: TEST_ETHEREUM_CHAIN, address: TEST_ETHEREUM_ADDRESS }],
      });
    });

    it("returns a referral code without recipients", async () => {
      stubFetch(() => json({ recipients: [], referralCode: "ref-123" }));
      expect(await fetchConfig()).toEqual({ recipients: [], referralCode: "ref-123" });
    });

    it.each([
      ["a 204", () => new Response(null, { status: 204 })],
      ["no recipients and no referral code", () => json({ feeBps: 50, recipients: [] })],
      ["only malformed recipients", () => json({ feeBps: 50, recipients: ["eip155:5"] })],
    ])("returns undefined without warning on %s", async (_, handler) => {
      stubFetch(handler);
      expect(await fetchConfig()).toBeUndefined();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it.each([
      ["a 4xx", () => new Response("unknown project", { status: 400 })],
      ["a 5xx", () => new Response("oops", { status: 503 })],
      ["bad JSON", () => new Response("not json", { status: 200 })],
      ["a malformed config", () => json({ feeBps: "50", recipients: [] })],
      [
        "a network error",
        () => {
          throw new TypeError("fetch failed");
        },
      ],
    ])("returns undefined and warns on %s", async (_, handler) => {
      stubFetch(handler);
      await expect(fetchConfig()).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalledOnce();
    });

    it("returns undefined and warns on a timeout", async () => {
      vi.useFakeTimers();
      stubFetch(
        (init) =>
          new Promise((_, reject) =>
            init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))),
          ),
      );
      const result = fetchConfig();
      await vi.advanceTimersByTimeAsync(3000);
      await expect(result).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalledOnce();
    });
  });

  describe("isSameWalletFee", () => {
    it("ignores the order of the recipients", () => {
      const reordered = { ...WALLET_FEE, recipients: [...WALLET_FEE.recipients].reverse() };
      expect(isSameWalletFee(WALLET_FEE, reordered)).toBe(true);
    });

    it.each([
      ["undefined", undefined],
      ["a different feeBps", { ...WALLET_FEE, feeBps: 100 }],
      ["a different referralCode", { ...WALLET_FEE, referralCode: "other" }],
      ["a missing recipient", { ...WALLET_FEE, recipients: WALLET_FEE.recipients.slice(1) }],
      [
        "a different address",
        {
          ...WALLET_FEE,
          recipients: [
            { chainId: TEST_ETHEREUM_CHAIN, address: "0xdef" },
            ...WALLET_FEE.recipients.slice(1),
          ],
        },
      ],
    ])("detects %s", (_, other) => {
      expect(isSameWalletFee(WALLET_FEE, other)).toBe(false);
    });
  });

  describe("session", () => {
    it("exposes the whole config, ignores chain switches and clears on disconnect", async () => {
      let config = CONFIG;
      const requests = stubFetch(() => json(config));
      const { dapp, wallet, events } = await connect();

      expect(await dapp.getWalletFee()).toEqual(WALLET_FEE);
      expect(requests).toHaveLength(1);
      expect(requests[0].origin).toBe("https://staging.example.com");
      expect(requests[0].pathname).toBe("/wallet-fee/v1/config");
      expect(requests[0].searchParams.get("projectId")).toBe(TEST_PROVIDER_OPTS.projectId);
      expect(requests[0].searchParams.get("walletId")).toBe(WALLET_GUIDE_ID);

      // a chain switch neither fetches nor emits
      const chainChanged = vi.fn();
      dapp.on("chainChanged", chainChanged);
      dapp.setDefaultChain(TEST_OPTIMISM_CHAIN);
      expect(chainChanged).toHaveBeenCalledOnce();
      expect(await dapp.getWalletFee()).toEqual(WALLET_FEE);
      expect(requests).toHaveLength(1);
      expect(events).toEqual([WALLET_FEE]);

      // a session update fetches again, but only emits if the config changed
      await updateSession(dapp, wallet);
      expect(requests).toHaveLength(2);
      expect(events).toEqual([WALLET_FEE]);
      config = { ...CONFIG, recipients: [TEST_ETHEREUM_ACCOUNT] };
      const updated = { ...WALLET_FEE, recipients: [WALLET_FEE.recipients[0]] };
      await updateSession(dapp, wallet);
      expect(requests).toHaveLength(3);
      expect(await dapp.getWalletFee()).toEqual(updated);

      await dapp.disconnect();
      expect(await dapp.getWalletFee()).toBeUndefined();
      expect(events).toEqual([WALLET_FEE, updated, undefined]);
      await deleteProviders({ A: dapp, B: wallet });
    });

    it("fetches again when a session is restored", async () => {
      const requests = stubFetch(() => json(CONFIG));
      const { dapp, wallet, database } = await connect();
      await dapp.getWalletFee();
      expect(requests).toHaveLength(1);
      await deleteProviders({ A: dapp, B: wallet });

      stubHostBridge();
      const restored = await UniversalProvider.init({
        ...TEST_PROVIDER_OPTS,
        name: "dapp",
        storageOptions: { database },
      });
      expect(await restored.getWalletFee()).toEqual(WALLET_FEE);
      expect(requests).toHaveLength(2);
      await disconnectSocket(restored.client.core);
    });

    it.each([
      ["without a host launch", { hostLaunch: false }],
      ["without a wallet_guide_id", { walletGuideId: null }],
      ["with an empty wallet_guide_id", { walletGuideId: "" }],
    ])("makes no request %s", async (_, opts) => {
      const requests = stubFetch(() => json(CONFIG));
      const { dapp, wallet, events } = await connect(opts);
      expect(await dapp.getWalletFee()).toBeUndefined();
      expect(requests).toHaveLength(0);
      expect(events).toHaveLength(0);
      await deleteProviders({ A: dapp, B: wallet });
    });

    it("resolves undefined without throwing when the request fails", async () => {
      stubFetch(() => new Response("oops", { status: 500 }));
      const { dapp, wallet, events } = await connect();
      expect(await dapp.getWalletFee()).toBeUndefined();
      expect(events).toHaveLength(0);
      await deleteProviders({ A: dapp, B: wallet });
    });
  });
});
