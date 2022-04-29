import "mocha";
import { getDefaultLoggerOptions } from "@walletconnect/logger";
import pino from "pino";

import {
  Core,
  CORE_DEFAULT,
  CORE_STORAGE_PREFIX,
  MESSAGES_CONTEXT,
  MESSAGES_STORAGE_VERSION,
  MessageTracker,
} from "../src";
import { expect, TEST_CORE_OPTIONS } from "./shared";
import { ICore } from "@walletconnect/types";

describe("Messages", () => {
  const logger = pino(getDefaultLoggerOptions({ level: CORE_DEFAULT.logger }));

  let core: ICore;

  beforeEach(() => {
    core = new Core(TEST_CORE_OPTIONS);
  });

  it("provides the expected `storageKey` format", () => {
    const messages = new MessageTracker(logger, core);
    expect(messages.storageKey).to.equal(
      CORE_STORAGE_PREFIX + MESSAGES_STORAGE_VERSION + "//" + MESSAGES_CONTEXT,
    );
  });
});
