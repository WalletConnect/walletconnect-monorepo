import { expect, describe, it, afterEach, vi } from "vitest";
import { SignClient } from "@walletconnect/sign-client";
import { formatJsonRpcError, formatJsonRpcResult } from "@walletconnect/jsonrpc-utils";
import { JsonRpcResponse } from "@walletconnect/jsonrpc-types";
import { EVENTS_CLIENT_API_URL, RELAYER_SDK_VERSION } from "@walletconnect/core";
import { getSdkError } from "@walletconnect/utils";

import UniversalProvider from "../src/index.js";
import { isSigningMethod } from "../src/utils/index.js";
import {
  deleteProviders,
  disconnectSocket,
  testConnectMethod,
  TEST_ETHEREUM_ADDRESS,
  TEST_ETHEREUM_CHAIN,
  TEST_PROVIDER_OPTS,
} from "./shared/index.js";

const WALLET_ID = "wallet-guide-id";
const realFetch = globalThis.fetch;

// fake host bridge that hands the pairing URI to the test wallet
function stubHostBridge() {
  let deliverUri: (uri: string) => void = () => undefined;
  const pairingUri = new Promise<string>((resolve) => (deliverUri = resolve));
  vi.stubGlobal("window", {
    walletConnectHost: { autoConnect: true, postMessage: ({ uri }) => deliverUri(uri) },
  });
  return pairingUri;
}

type PulseRequest = { url: URL; body: any };

// answers wallet fee requests with "no config" and captures Pulse requests; other traffic passes through
function stubFetch() {
  const pulseRequests: PulseRequest[] = [];
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/wallet-fee/v1/config")) {
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (`${url.origin}${url.pathname}` !== EVENTS_CLIENT_API_URL) return realFetch(input, init);
    pulseRequests.push({ url, body: JSON.parse(String(init?.body)) });
    return Promise.resolve(new Response(null, { status: 202 }));
  });
  return pulseRequests;
}

async function connect({
  hostLaunch = true,
  walletId = WALLET_ID as string | null,
  database = `./test/tmp/dappDB-metering-${Date.now()}.db`,
  telemetryEnabled = true,
  beforeConnect = () => undefined as void,
} = {}) {
  const pulseRequests = stubFetch();
  const pairingUri = hostLaunch ? stubHostBridge() : undefined;
  const dapp = await UniversalProvider.init({
    ...TEST_PROVIDER_OPTS,
    name: "dapp",
    storageOptions: { database },
    telemetryEnabled,
  });
  const wallet = await UniversalProvider.init({ ...TEST_PROVIDER_OPTS, name: "wallet" });
  const sendFunnelEvent = vi.spyOn(dapp.client.core.eventClient, "sendFunnelEvent");
  beforeConnect();
  const sessionProperties = walletId === null ? undefined : { wallet_guide_id: walletId };
  await testConnectMethod({ dapp, wallet }, { pairingUri, sessionProperties });
  // the wallet approves every request, unless told to reject
  const respond = { reject: false };
  wallet.client.on("session_request", async ({ id, topic }) => {
    const response: JsonRpcResponse = respond.reject
      ? formatJsonRpcError(id, getSdkError("USER_REJECTED").message)
      : formatJsonRpcResult(id, "0xsigned");
    await wallet.client.respond({ topic, response });
  });
  return { dapp, wallet, sendFunnelEvent, respond, database, pulseRequests };
}

const funnelEvent = (event: string, properties: Record<string, unknown>) => ({
  sdkType: "universal-provider",
  event,
  properties,
});

const personalSign = { method: "personal_sign", params: ["0xdeadbeef", TEST_ETHEREUM_ADDRESS] };

describe("UniversalProvider metering", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("isSigningMethod", () => {
    it.each([
      [TEST_ETHEREUM_CHAIN, "eth_sendTransaction", true],
      [TEST_ETHEREUM_CHAIN, "personal_sign", true],
      [TEST_ETHEREUM_CHAIN, "eth_signTypedData_v4", true],
      [TEST_ETHEREUM_CHAIN, "eth_call", false],
      [TEST_ETHEREUM_CHAIN, "wallet_switchEthereumChain", false],
      ["solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", "solana_signTransaction", true],
      ["bip122:000000000019d6689c085ae165831e93", "signPsbt", true],
      // bip122 method names have no prefix, so they only count on bip122
      [TEST_ETHEREUM_CHAIN, "signPsbt", false],
    ])("%s %s → %s", (chainId, method, expected) => {
      expect(isSigningMethod(chainId, method)).toBe(expected);
    });
  });

  describe("connect", () => {
    it("sends CONNECT_INITIATED and then CONNECT_SUCCESS on a host launch", async () => {
      const { dapp, wallet, sendFunnelEvent } = await connect();
      expect(sendFunnelEvent.mock.calls.map(([params]) => params)).toEqual([
        funnelEvent("CONNECT_INITIATED", { connectionOrigin: "wallet" }),
        funnelEvent("CONNECT_SUCCESS", { connectionOrigin: "wallet", walletId: WALLET_ID }),
      ]);
      await deleteProviders({ A: dapp, B: wallet });
    });

    it.each([
      ["a normal connection", { hostLaunch: false }, 1],
      ["a host launch without a wallet_guide_id", { walletId: null }, 2],
    ])("sends CONNECT_SUCCESS as 'dapp' on %s", async (_, opts, calls) => {
      const { dapp, wallet, sendFunnelEvent } = await connect(opts);
      expect(sendFunnelEvent).toHaveBeenCalledTimes(calls);
      expect(sendFunnelEvent).toHaveBeenLastCalledWith(
        funnelEvent("CONNECT_SUCCESS", { connectionOrigin: "dapp" }),
      );
      if (calls === 1) {
        expect(sendFunnelEvent).not.toHaveBeenCalledWith(
          expect.objectContaining({ event: "CONNECT_INITIATED" }),
        );
      }
      await deleteProviders({ A: dapp, B: wallet });
    });

    it("sends nothing when a session is restored", async () => {
      const { dapp, wallet, database } = await connect();
      await deleteProviders({ A: dapp, B: wallet });

      const client = await SignClient.init({
        projectId: TEST_PROVIDER_OPTS.projectId,
        relayUrl: TEST_PROVIDER_OPTS.relayUrl,
        metadata: TEST_PROVIDER_OPTS.metadata,
        logger: "error",
        name: "dapp",
        storageOptions: { database },
      });
      const sendFunnelEvent = vi.spyOn(client.core.eventClient, "sendFunnelEvent");
      const restored = await UniversalProvider.init({ ...TEST_PROVIDER_OPTS, client });
      expect(restored.session).toBeDefined();
      expect(sendFunnelEvent).not.toHaveBeenCalled();
      await disconnectSocket(restored.client.core);
    });
  });

  describe("sign", () => {
    it("sends one SIGN_SUCCESS per approved signing request, through the provider and the client", async () => {
      const { dapp, wallet, sendFunnelEvent } = await connect();
      sendFunnelEvent.mockClear();
      const topic = dapp.session!.topic;

      await dapp.request(personalSign, TEST_ETHEREUM_CHAIN);
      await dapp.request(
        { method: "eth_signTypedData", params: [TEST_ETHEREUM_ADDRESS, "{}"] },
        TEST_ETHEREUM_CHAIN,
      );
      await dapp.request(
        { method: "eth_sendTransaction", params: [{ from: TEST_ETHEREUM_ADDRESS, value: "0x1" }] },
        TEST_ETHEREUM_CHAIN,
      );
      // apps can call sign-client directly, bypassing `provider.request()`
      await dapp.client.request({ topic, chainId: TEST_ETHEREUM_CHAIN, request: personalSign });

      const signed = (method: string) =>
        funnelEvent("SIGN_SUCCESS", {
          connectionOrigin: "wallet",
          walletId: WALLET_ID,
          chainId: TEST_ETHEREUM_CHAIN,
          method,
        });
      // no params or values are sent
      expect(sendFunnelEvent.mock.calls.map(([params]) => params)).toEqual([
        signed("personal_sign"),
        signed("eth_signTypedData"),
        signed("eth_sendTransaction"),
        signed("personal_sign"),
      ]);
      await deleteProviders({ A: dapp, B: wallet });
    });

    it("sends nothing for non-signing methods or rejected requests", async () => {
      const { dapp, wallet, sendFunnelEvent, respond } = await connect();
      sendFunnelEvent.mockClear();
      const topic = dapp.session!.topic;

      await dapp.client.request({
        topic,
        chainId: TEST_ETHEREUM_CHAIN,
        request: { method: "wallet_switchEthereumChain", params: [{ chainId: "0x1" }] },
      });
      respond.reject = true;
      await expect(dapp.request(personalSign, TEST_ETHEREUM_CHAIN)).rejects.toBeDefined();

      expect(sendFunnelEvent).not.toHaveBeenCalled();
      await deleteProviders({ A: dapp, B: wallet });
    });

    it("sends nothing for a session that isn't wallet-originated", async () => {
      const { dapp, wallet, sendFunnelEvent } = await connect({ hostLaunch: false });
      sendFunnelEvent.mockClear();
      await dapp.request(personalSign, TEST_ETHEREUM_CHAIN);
      expect(sendFunnelEvent).not.toHaveBeenCalled();
      await deleteProviders({ A: dapp, B: wallet });
    });
  });

  describe("Pulse requests", () => {
    // `isTestRun()` is read when the clients start, so this only lets funnel events through
    const allowEvents = () => vi.stubEnv("IS_VITEST", "false");

    it("sends each funnel event as its own st=universal-provider batch", async () => {
      const {
        dapp,
        wallet,
        sendFunnelEvent,
        pulseRequests: requests,
      } = await connect({ beforeConnect: allowEvents });
      await dapp.request(personalSign, TEST_ETHEREUM_CHAIN);
      await vi.waitFor(() => expect(requests).toHaveLength(3));
      expect(sendFunnelEvent).toHaveBeenCalledTimes(3);

      const clientId = await dapp.client.core.crypto.getClientId();
      requests.forEach(({ url, body }) => {
        expect(url.searchParams.get("projectId")).toBe(String(TEST_PROVIDER_OPTS.projectId));
        expect(url.searchParams.get("st")).toBe("universal-provider");
        expect(url.searchParams.get("sv")).toBe(`js-${RELAYER_SDK_VERSION}`);
        expect(body).toHaveLength(1);
        expect(body[0]).toMatchObject({
          eventId: expect.any(String),
          timestamp: expect.any(Number),
        });
        expect(body[0].props.properties).toMatchObject({
          projectId: TEST_PROVIDER_OPTS.projectId,
          clientId,
        });
      });
      expect(requests.map(({ body }) => body[0].props.event)).toEqual([
        "CONNECT_INITIATED",
        "CONNECT_SUCCESS",
        "SIGN_SUCCESS",
      ]);
      await deleteProviders({ A: dapp, B: wallet });
    });

    it("sends nothing with telemetryEnabled: false", async () => {
      const {
        dapp,
        wallet,
        sendFunnelEvent,
        pulseRequests: requests,
      } = await connect({ telemetryEnabled: false, beforeConnect: allowEvents });
      await dapp.request(personalSign, TEST_ETHEREUM_CHAIN);
      expect(sendFunnelEvent).toHaveBeenCalledTimes(3);
      await Promise.all(sendFunnelEvent.mock.results.map(({ value }) => value));
      expect(requests).toHaveLength(0);
      await deleteProviders({ A: dapp, B: wallet });
    });
  });
});
