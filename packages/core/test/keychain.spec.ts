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
  const core = new Core(TEST_CORE_OPTIONS);

  it("provides the expected `storageKey` format", () => {
    const keychain = new KeyChain(core, logger);
    expect(keychain.storageKey).to.equal(
      CORE_STORAGE_PREFIX + KEYCHAIN_STORAGE_VERSION + "//" + KEYCHAIN_CONTEXT,
    );
  });
});
