import { expect, describe, it, afterEach, vi } from "vitest";
import { RELAYER_SDK_VERSION } from "@walletconnect/core";

import UniversalProvider, { WalletFee } from "../src/index.js";
import { fetchWalletFeeConfig, selectWalletFee } from "../src/utils/index.js";
import {
  deleteProviders,
  disconnectSocket,
  testConnectMethod,
  TEST_ETHEREUM_ACCOUNT,
  TEST_ETHEREUM_ADDRESS,
  TEST_ETHEREUM_CHAIN,
  TEST_GOERLI_CHAIN,
  TEST_NAMESPACES,
  TEST_OPTIMISM_ACCOUNT,
  TEST_OPTIMISM_CHAIN,
  TEST_PROVIDER_OPTS,
} from "./shared/index.js";

const WALLET_ID = "wallet-guide-id";
const CONFIG = {
  feeBps: 50,
  recipients: [TEST_ETHEREUM_ACCOUNT, TEST_OPTIMISM_ACCOUNT],
  referralCode: "ref-123",
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
  walletId = WALLET_ID as string | null,
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
  const sessionProperties = walletId === null ? undefined : { wallet_guide_id: walletId };
  await testConnectMethod({ dapp, wallet }, { pairingUri, sessionProperties });
  return { dapp, wallet, events, database };
}

describe("UniversalProvider wallet fee", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe("fetchWalletFeeConfig", () => {
    const logger = { info: vi.fn(), warn: vi.fn() };
    const fetchConfig = () =>
      fetchWalletFeeConfig({ projectId: "pid", walletId: WALLET_ID, logger: logger as any });

    afterEach(() => vi.clearAllMocks());

    it("returns the config and sends the query params", async () => {
      const requests = stubFetch(() => json(CONFIG));
      expect(await fetchConfig()).toEqual(CONFIG);
      expect(requests[0].origin).toBe("https://api.walletconnect.com");
      expect(Object.fromEntries(requests[0].searchParams)).toEqual({
        projectId: "pid",
        walletId: WALLET_ID,
        st: "universal-provider",
        sv: `js-${RELAYER_SDK_VERSION}`,
      });
    });

    it("returns undefined on 204 without warning", async () => {
      stubFetch(() => new Response(null, { status: 204 }));
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

  describe("selectWalletFee", () => {
    it("returns undefined for a chain with no recipient and no referral code", () => {
      const config = { ...CONFIG, referralCode: undefined };
      expect(selectWalletFee(config, TEST_GOERLI_CHAIN)).toBeUndefined();
    });
  });

  describe("session", () => {
    it("exposes the active chain's fee, follows chain switches and clears on disconnect", async () => {
      const requests = stubFetch(() => json(CONFIG));
      const { dapp, wallet, events } = await connect();
      const expected = (chainId: string, recipient?: string) => ({
        chainId,
        feeBps: CONFIG.feeBps,
        recipient,
        referralCode: CONFIG.referralCode,
      });

      expect(await dapp.getWalletFee()).toEqual(
        expected(TEST_ETHEREUM_CHAIN, TEST_ETHEREUM_ADDRESS),
      );
      expect(requests).toHaveLength(1);
      expect(requests[0].origin).toBe("https://staging.example.com");
      expect(requests[0].pathname).toBe("/wallet-fee/v1/config");
      expect(requests[0].searchParams.get("projectId")).toBe(TEST_PROVIDER_OPTS.projectId);
      expect(requests[0].searchParams.get("walletId")).toBe(WALLET_ID);

      dapp.setDefaultChain(TEST_OPTIMISM_CHAIN);
      expect(await dapp.getWalletFee()).toEqual(
        expected(TEST_OPTIMISM_CHAIN, TEST_ETHEREUM_ADDRESS),
      );
      // no recipient on this chain, but the referral code still applies
      dapp.setDefaultChain(TEST_GOERLI_CHAIN);
      expect(await dapp.getWalletFee()).toEqual(expected(TEST_GOERLI_CHAIN));
      // chain changes reuse the cached config
      expect(requests).toHaveLength(1);

      await dapp.disconnect();
      expect(await dapp.getWalletFee()).toBeUndefined();
      expect(events).toEqual([
        expected(TEST_ETHEREUM_CHAIN, TEST_ETHEREUM_ADDRESS),
        expected(TEST_OPTIMISM_CHAIN, TEST_ETHEREUM_ADDRESS),
        expected(TEST_GOERLI_CHAIN),
        undefined,
      ]);
      await deleteProviders({ A: dapp, B: wallet });
    });

    it("fetches again when a session is restored", async () => {
      const requests = stubFetch(() => json(CONFIG));
      const { dapp, wallet, database } = await connect();
      await dapp.getWalletFee();
      // a session update fetches it again too
      const updated = new Promise((resolve) => dapp.once("session_update", resolve));
      await wallet.client.update({ topic: dapp.session!.topic, namespaces: TEST_NAMESPACES });
      await updated;
      await dapp.getWalletFee();
      expect(requests).toHaveLength(2);
      await deleteProviders({ A: dapp, B: wallet });

      stubHostBridge();
      const restored = await UniversalProvider.init({
        ...TEST_PROVIDER_OPTS,
        name: "dapp",
        storageOptions: { database },
      });
      expect((await restored.getWalletFee())?.recipient).toBe(TEST_ETHEREUM_ADDRESS);
      expect(requests).toHaveLength(3);
      await disconnectSocket(restored.client.core);
    });

    it.each([
      ["without a host launch", { hostLaunch: false }],
      ["without a wallet_guide_id", { walletId: null }],
      ["with an empty wallet_guide_id", { walletId: "" }],
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
