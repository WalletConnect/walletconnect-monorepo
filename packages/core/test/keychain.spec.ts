import { expect, describe, it } from "vitest";
import { getDefaultLoggerOptions, pino } from "@walletconnect/logger";

import {
  Core,
  CORE_DEFAULT,
  CORE_STORAGE_PREFIX,
  KeyChain,
  KEYCHAIN_CONTEXT,
  KEYCHAIN_STORAGE_VERSION,
} from "../src";
import { TEST_CORE_OPTIONS } from "./shared";

describe("Keychain", () => {
  const logger = pino(getDefaultLoggerOptions({ level: CORE_DEFAULT.logger }));

  describe("storageKey", () => {
    it("provides the expected default `storageKey` format", () => {
      const core = new Core(TEST_CORE_OPTIONS);
      const keychain = new KeyChain(core, logger);
      expect(keychain.storageKey).to.equal(
        CORE_STORAGE_PREFIX + KEYCHAIN_STORAGE_VERSION + "//" + KEYCHAIN_CONTEXT,
      );
    });
    it("provides the expected custom `storageKey` format", () => {
      const core = new Core({ ...TEST_CORE_OPTIONS, customStoragePrefix: "test" });
      const keychain = new KeyChain(core, logger);
      expect(keychain.storageKey).to.equal(
        CORE_STORAGE_PREFIX + KEYCHAIN_STORAGE_VERSION + ":test" + "//" + KEYCHAIN_CONTEXT,
      );
    });
  });
});
