import { afterEach, describe, expect, it } from "vitest";
import { IWalletKit } from "@reown/walletkit";

import { WalletKitWdkAdapter } from "../src/index.js";
import { disconnect, TEST_ADAPTER_OPTIONS, TEST_METADATA, TEST_PROJECT_ID } from "./shared/index.js";

describe("WalletKitWdkAdapter", () => {
  let walletKit: IWalletKit | undefined;

  afterEach(async () => {
    await disconnect(walletKit?.core);
    walletKit = undefined;
  });

  describe("init", () => {
    it("should return an initialized WalletKit instance", async () => {
      // #given / #when
      walletKit = await WalletKitWdkAdapter.init(TEST_ADAPTER_OPTIONS);

      // #then
      expect(walletKit).toBeDefined();
      expect(walletKit.core).toBeDefined();
      expect(walletKit.engine).toBeDefined();
      expect(walletKit.events).toBeDefined();
      expect(walletKit.logger).toBeDefined();
    });

    it("should default the WalletKit name to the WalletKit client context", async () => {
      // #given / #when
      walletKit = await WalletKitWdkAdapter.init(TEST_ADAPTER_OPTIONS);

      // #then
      expect(walletKit.name).toEqual("WalletKit");
    });

    it("should propagate the provided metadata to the WalletKit instance", async () => {
      // #given / #when
      walletKit = await WalletKitWdkAdapter.init(TEST_ADAPTER_OPTIONS);

      // #then
      expect(walletKit.metadata).toEqual(TEST_METADATA);
    });

    it("should construct the underlying Core with the supplied projectId", async () => {
      // #given / #when
      walletKit = await WalletKitWdkAdapter.init(TEST_ADAPTER_OPTIONS);

      // #then
      expect((walletKit.core as unknown as { projectId: string }).projectId).toEqual(
        TEST_PROJECT_ID,
      );
    });

    it("should forward a custom name to the WalletKit instance", async () => {
      // #given
      const name = "CustomWalletKitName";

      // #when
      walletKit = await WalletKitWdkAdapter.init({
        ...TEST_ADAPTER_OPTIONS,
        name,
      });

      // #then
      expect(walletKit.name).toEqual(name);
    });

    it("should expose engine event subscription via on/off", async () => {
      // #given
      walletKit = await WalletKitWdkAdapter.init(TEST_ADAPTER_OPTIONS);
      const listener = () => undefined;

      // #when
      walletKit.on("session_proposal", listener);
      const listenersAfterOn = walletKit.events.listenerCount("session_proposal");

      walletKit.off("session_proposal", listener);
      const listenersAfterOff = walletKit.events.listenerCount("session_proposal");

      // #then
      expect(listenersAfterOn).toEqual(1);
      expect(listenersAfterOff).toEqual(0);
    });
  });
});
