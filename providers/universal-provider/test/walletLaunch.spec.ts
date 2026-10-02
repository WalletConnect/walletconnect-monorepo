import { expect, describe, it, afterEach, vi } from "vitest";

import UniversalProvider, { WalletConnectHost, WalletHostSessionOffer } from "../src/index.js";
import {
  deleteProviders,
  disconnectSocket,
  testConnectMethod,
  TEST_PROVIDER_OPTS,
  TEST_REQUIRED_NAMESPACES,
} from "./shared/index.js";

const getDbName = (_prefix: string) => {
  return `./test/tmp/${_prefix}.db`;
};

function stubWalletHost(host: WalletConnectHost | undefined) {
  vi.stubGlobal("window", { walletConnectHost: host });
}

// fake bridge that captures the offers the dapp sends to the host wallet
function stubWalletBridge() {
  const offers: WalletHostSessionOffer[] = [];
  let deliverUri: (uri: string) => void = () => undefined;
  const pairingUri = new Promise<string>((resolve) => (deliverUri = resolve));
  stubWalletHost({
    autoConnect: true,
    postMessage: (message) => {
      offers.push(message);
      deliverUri(message.uri);
    },
  });
  return { offers, pairingUri };
}

describe("UniversalProvider wallet launch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("isWalletLaunch", () => {
    const isWalletLaunch = () => {
      const provider = new UniversalProvider(TEST_PROVIDER_OPTS);
      const result = UniversalProvider.isWalletLaunch();
      // the instance getter is available before `init()` and agrees with the static check
      expect(provider.isWalletLaunch).toBe(result);
      return result;
    };

    it("returns false during SSR", () => {
      vi.stubGlobal("window", undefined);
      expect(isWalletLaunch()).toBe(false);
    });

    it("returns false without the bridge", () => {
      stubWalletHost(undefined);
      expect(isWalletLaunch()).toBe(false);
    });

    it.each([undefined, false, "true", 1])("returns false when autoConnect is %s", (value) => {
      stubWalletHost({ autoConnect: value as boolean, postMessage: () => undefined });
      expect(isWalletLaunch()).toBe(false);
    });

    it("returns false without postMessage", () => {
      stubWalletHost({ autoConnect: true });
      expect(isWalletLaunch()).toBe(false);
    });

    it("returns true with autoConnect and postMessage", () => {
      stubWalletHost({ autoConnect: true, postMessage: () => undefined });
      expect(isWalletLaunch()).toBe(true);
    });
  });

  describe("connect", () => {
    it("sends the pairing URI to the wallet instead of emitting display_uri", async () => {
      const dappDbName = getDbName(`dappDB-wallet-launch-${Date.now()}`);
      const { offers, pairingUri } = stubWalletBridge();
      const dapp = await UniversalProvider.init({
        ...TEST_PROVIDER_OPTS,
        name: "dapp",
        storageOptions: { database: dappDbName },
      });
      const wallet = await UniversalProvider.init({ ...TEST_PROVIDER_OPTS, name: "wallet" });
      const onDisplayUri = vi.fn();
      dapp.on("display_uri", onDisplayUri);

      const { sessionA } = await testConnectMethod({ dapp, wallet }, { pairingUri });

      expect(offers).toEqual([{ type: "wc_session_offer", uri: dapp.uri }]);
      expect(onDisplayUri).not.toHaveBeenCalled();
      expect(dapp.session?.topic).toBe(sessionA.topic);
      await deleteProviders({ A: dapp, B: wallet });

      // a restored session needs no connect(), so nothing is sent to the wallet
      const postMessage = vi.fn();
      stubWalletHost({ autoConnect: true, postMessage });
      const restoredDapp = await UniversalProvider.init({
        ...TEST_PROVIDER_OPTS,
        name: "dapp",
        storageOptions: { database: dappDbName },
      });
      expect(restoredDapp.session?.topic).toBe(sessionA.topic);
      expect(postMessage).not.toHaveBeenCalled();
      await disconnectSocket(restoredDapp.client.core);
    });

    it("rejects connect() when postMessage throws, and a retry sends a new offer", async () => {
      stubWalletHost({
        autoConnect: true,
        postMessage: () => {
          throw new Error("bridge is gone");
        },
      });
      const dapp = await UniversalProvider.init({ ...TEST_PROVIDER_OPTS, name: "dapp" });
      const wallet = await UniversalProvider.init({ ...TEST_PROVIDER_OPTS, name: "wallet" });
      const onDisplayUri = vi.fn();
      dapp.on("display_uri", onDisplayUri);

      await expect(dapp.connect({ optionalNamespaces: TEST_REQUIRED_NAMESPACES })).rejects.toThrow(
        "Failed to send the pairing URI to the host wallet: bridge is gone",
      );
      expect(onDisplayUri).not.toHaveBeenCalled();
      const failedUri = dapp.uri;

      const { offers, pairingUri } = stubWalletBridge();
      await testConnectMethod({ dapp, wallet }, { pairingUri });

      expect(offers).toHaveLength(1);
      expect(offers[0].uri).not.toBe(failedUri);
      expect(onDisplayUri).not.toHaveBeenCalled();
      await deleteProviders({ A: dapp, B: wallet });
    });
  });
});
