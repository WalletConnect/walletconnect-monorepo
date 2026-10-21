import { afterEach, describe, expect, it, vi } from "vitest";
import { SignClient } from "@walletconnect/sign-client";
import { formatJsonRpcResult } from "@walletconnect/jsonrpc-utils";

import EthereumProvider, { WalletFee } from "../src/index.js";
import { EthereumProviderOptions } from "../src/EthereumProvider.js";
import { ACCOUNTS, TEST_APP_METADATA_A, TEST_WALLET_METADATA } from "./shared/constants.js";

// stand-in for AppKit's QR modal, so `showQrModal: true` works in node
const modal = vi.hoisted(() => ({
  open: vi.fn(),
  close: vi.fn(),
  subscribeState: vi.fn(),
  showErrorMessage: vi.fn(),
}));
vi.mock("../src/utils/appkit.js", () => ({ getAppkit: async () => () => modal }));
vi.mock("../src/wcmToAppKit.js", () => ({ convertWCMToAppKitOptions: () => ({ networks: [{}] }) }));

const PROJECT_ID = process.env.TEST_PROJECT_ID || "";
const WALLET_GUIDE_ID = "wallet-guide-id";
const ADDRESS = ACCOUNTS.a.address;
const FEE_API_URL = "https://staging.example.com";
const FEE_CONFIG = {
  feeBps: 50,
  recipients: [`eip155:1:${ACCOUNTS.b.address}`, `eip155:10:${ACCOUNTS.c.address}`],
  referralCode: "ref-123",
};
const WAIT = { timeout: 30_000 };
const realFetch = globalThis.fetch;

// stubs `fetch` for wallet fee requests only, so other traffic keeps working
function stubFeeApi() {
  const requests: URL[] = [];
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (!url.pathname.endsWith("/wallet-fee/v1/config")) return realFetch(input, init);
    requests.push(url);
    return Promise.resolve(new Response(JSON.stringify(FEE_CONFIG), { status: 200 }));
  });
  return requests;
}

// fake host bridge that records the offers it receives
function stubHostBridge() {
  const offers: { type: string; uri: string }[] = [];
  vi.stubGlobal("window", {
    walletConnectHost: { autoConnect: true, postMessage: (offer) => offers.push(offer) },
  });
  return offers;
}

async function initProvider(opts: Partial<EthereumProviderOptions> = {}) {
  return await EthereumProvider.init({
    projectId: PROJECT_ID,
    optionalChains: [1, 10],
    showQrModal: true,
    metadata: TEST_APP_METADATA_A,
    disableProviderPing: true,
    walletFeeApiUrl: FEE_API_URL,
    ...opts,
  } as EthereumProviderOptions);
}

// wallet that approves with a `wallet_guide_id`, accounts in `chains` order, and signs anything
async function initWallet(chains = ["eip155:1", "eip155:10"]) {
  const wallet = await SignClient.init({ projectId: PROJECT_ID, metadata: TEST_WALLET_METADATA });
  wallet.on("session_proposal", async ({ id, params }) => {
    const { methods, events } = params.optionalNamespaces.eip155;
    await wallet.approve({
      id,
      namespaces: {
        eip155: { chains, methods, events, accounts: chains.map((c) => `${c}:${ADDRESS}`) },
      },
      sessionProperties: { wallet_guide_id: WALLET_GUIDE_ID },
    });
  });
  wallet.on("session_request", async ({ id, topic }) => {
    await wallet.respond({ topic, response: formatJsonRpcResult(id, "0xsignature") });
  });
  return wallet;
}

// connects on a host launch, with the wallet pairing from the offer
async function hostLaunchConnect(opts: Partial<EthereumProviderOptions> = {}, chains?: string[]) {
  const offers = stubHostBridge();
  const provider = await initProvider(opts);
  const wallet = await initWallet(chains);
  const displayUri = vi.fn();
  provider.on("display_uri", displayUri);
  const enabled = provider.enable();
  await vi.waitFor(() => expect(offers).toHaveLength(1), WAIT);
  await wallet.pair({ uri: offers[0].uri });
  const accounts = await enabled;
  return { provider, wallet, offers, accounts, displayUri };
}

async function close(provider: EthereumProvider, wallet?: InstanceType<typeof SignClient>) {
  await provider.signer.client.core.relayer.transportClose();
  await wallet?.core.relayer.transportClose();
}

describe("EthereumProvider host launch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("connects through the host without opening the QR modal", async () => {
    stubFeeApi();
    const { provider, wallet, offers, accounts, displayUri } = await hostLaunchConnect();

    expect(EthereumProvider.isHostLaunch()).toBe(true);
    expect(provider.isHostLaunch).toBe(true);
    expect(accounts).toEqual([ADDRESS]);
    expect(offers).toEqual([{ type: "wc_session_offer", uri: expect.stringMatching(/^wc:/) }]);
    expect(displayUri).not.toHaveBeenCalled();
    expect(modal.open).not.toHaveBeenCalled();
    expect(modal.subscribeState).not.toHaveBeenCalled();
    await close(provider, wallet);
  });

  it("opens the QR modal without a host launch, and closing it aborts", async () => {
    expect(EthereumProvider.isHostLaunch()).toBe(false);
    const provider = await initProvider();
    expect(provider.isHostLaunch).toBe(false);

    const displayUri = new Promise((resolve) => provider.once("display_uri", resolve));
    const connecting = provider.connect();
    expect(modal.open).toHaveBeenCalledTimes(1);
    expect(modal.subscribeState).toHaveBeenCalledTimes(1);
    expect(await displayUri).toMatch(/^wc:/);
    modal.subscribeState.mock.calls[0][0]({ open: false });
    await expect(connecting).rejects.toThrow("Connection request reset");
    await close(provider);
  });

  it("passes the wallet fee through and follows chain switches", async () => {
    const requests = stubFeeApi();
    const { provider, wallet } = await hostLaunchConnect();
    const fees: (WalletFee | undefined)[] = [];
    provider.on("wallet_fee_changed", (fee) => fees.push(fee));

    expect(provider.signer.providerOpts.walletFeeApiUrl).toBe(FEE_API_URL);
    expect(requests[0].origin).toBe(FEE_API_URL);
    expect(provider.chainId).toBe(1);
    expect(await provider.getWalletFee()).toEqual({
      chainId: "eip155:1",
      feeBps: 50,
      recipient: ACCOUNTS.b.address,
      referralCode: "ref-123",
    });

    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xa" }] });
    expect(provider.chainId).toBe(10);
    const fee = await provider.getWalletFee();
    expect(fee).toEqual({ ...fee, chainId: "eip155:10", recipient: ACCOUNTS.c.address });
    expect(fees).toEqual([fee]);
    expect(requests).toHaveLength(1);
    await close(provider, wallet);
  });

  it("keeps the fee on the provider's chain when the wallet lists another chain first", async () => {
    stubFeeApi();
    const { provider, wallet } = await hostLaunchConnect({ chains: [10], optionalChains: [1] });

    expect(provider.chainId).toBe(10);
    expect((await provider.getWalletFee())?.chainId).toBe("eip155:10");
    expect(await provider.request({ method: "eth_chainId" })).toBe(10);
    await close(provider, wallet);
  });

  it("sends each metering event once", async () => {
    stubFeeApi();
    const offers = stubHostBridge();
    const provider = await initProvider();
    const sendFunnelEvent = vi
      .spyOn(provider.signer.client.core.eventClient, "sendFunnelEvent")
      .mockResolvedValue(undefined as any);
    const wallet = await initWallet();

    const enabled = provider.enable();
    await vi.waitFor(() => expect(offers).toHaveLength(1), WAIT);
    await wallet.pair({ uri: offers[0].uri });
    await enabled;
    await provider.request({ method: "personal_sign", params: ["0x68656c6c6f", ADDRESS] });

    await vi.waitFor(() => expect(sendFunnelEvent).toHaveBeenCalledTimes(3), WAIT);
    expect(sendFunnelEvent.mock.calls.map(([{ event }]) => event)).toEqual([
      "CONNECT_INITIATED",
      "CONNECT_SUCCESS",
      "SIGN_SUCCESS",
    ]);
    await close(provider, wallet);
  });
});
