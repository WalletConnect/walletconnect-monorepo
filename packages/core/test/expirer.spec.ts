import { pino, getDefaultLoggerOptions } from "@walletconnect/logger";
import { expect, describe, it } from "vitest";
import { calcExpiry, formatExpirerTarget } from "@walletconnect/utils";
import { HEARTBEAT_EVENTS } from "@walletconnect/heartbeat";

import {
  Core,
  Expirer,
  EXPIRER_EVENTS,
  CORE_STORAGE_PREFIX,
  EXPIRER_STORAGE_VERSION,
  EXPIRER_CONTEXT,
  CORE_DEFAULT,
} from "../src";
import { disconnectSocket, TEST_CORE_OPTIONS } from "./shared";
import { generateRandomBytes32 } from "../../utils/src";

describe("Expirer", () => {
  const logger = pino(getDefaultLoggerOptions({ level: CORE_DEFAULT.logger }));

  describe("storageKey", () => {
    it("provides the expected default `storageKey` format", () => {
      const core = new Core(TEST_CORE_OPTIONS);
      const expirer = new Expirer(core, logger);
      expect(expirer.storageKey).to.equal(
        CORE_STORAGE_PREFIX + EXPIRER_STORAGE_VERSION + "//" + EXPIRER_CONTEXT,
      );
    });
    it("provides the expected custom `storageKey` format", () => {
      const core = new Core({ ...TEST_CORE_OPTIONS, customStoragePrefix: "test" });
      const expirer = new Expirer(core, logger);
      expect(expirer.storageKey).to.equal(
        CORE_STORAGE_PREFIX + EXPIRER_STORAGE_VERSION + ":test" + "//" + EXPIRER_CONTEXT,
      );
    });
  });

  it("should expire payload", async () => {
    const core = new Core(TEST_CORE_OPTIONS);
    await core.start();
    await core.relayer.subscribe(generateRandomBytes32());
    // confirm the expirer is empty
    expect(core.expirer.length).to.eq(0);
    // set a payload
    const topic = "test";
    core.expirer.set(topic, calcExpiry(1));
    // confirm the expirer is not empty
    expect(core.expirer.length).to.eq(1);
    setTimeout(() => {
      // emit heartbeat pulse event to trigger expirer
      core.heartbeat.events.emit(HEARTBEAT_EVENTS.pulse);
    }, 1_000);
    await new Promise<void>((resolve) => {
      core.expirer.on(EXPIRER_EVENTS.expired, (payload: any) => {
        expect(payload.target).to.eq(formatExpirerTarget("topic", topic));
        // confirm the expirer is empty again
        expect(core.expirer.length).to.eq(0);
        resolve();
      });
    });
    await disconnectSocket(core.relayer);
  });
});
