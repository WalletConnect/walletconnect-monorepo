import { pino, getDefaultLoggerOptions } from "@walletconnect/logger";
import { vi, expect, describe, it, beforeEach, afterEach } from "vitest";
import { calcExpiry } from "@walletconnect/utils";
import { THIRTY_DAYS, toMiliseconds } from "@walletconnect/time";
import { ICore, JsonRpcRecord } from "@walletconnect/types";

import {
  Core,
  CORE_DEFAULT,
  CORE_STORAGE_PREFIX,
  HISTORY_STORAGE_VERSION,
  HISTORY_CONTEXT,
  HISTORY_EVENTS,
  JsonRpcHistory,
} from "../src";
import { disconnectSocket, TEST_CORE_OPTIONS } from "./shared";

describe("history", () => {
  const logger = pino(getDefaultLoggerOptions({ level: CORE_DEFAULT.logger }));
  let core: ICore;

  beforeEach(async () => {
    core = new Core(TEST_CORE_OPTIONS);
    await core.start();
  });
  afterEach(async () => {
    await disconnectSocket(core.relayer);
  });

  describe("storageKey", () => {
    it("provides the expected default `storageKey` format", () => {
      const core = new Core(TEST_CORE_OPTIONS);
      const history = new JsonRpcHistory(core, logger);
      expect(history.storageKey).to.equal(
        CORE_STORAGE_PREFIX + HISTORY_STORAGE_VERSION + "//" + HISTORY_CONTEXT,
      );
    });
    it("provides the expected custom `storageKey` format", () => {
      const core = new Core({ ...TEST_CORE_OPTIONS, customStoragePrefix: "test" });
      const history = new JsonRpcHistory(core, logger);
      expect(history.storageKey).to.equal(
        CORE_STORAGE_PREFIX + HISTORY_STORAGE_VERSION + ":test" + "//" + HISTORY_CONTEXT,
      );
    });
  });

  it("should set a record expiry", async () => {
    expect(core.history.records.size).to.eq(0);
    const request = {
      id: 1687958477400360,
      topic: "24fd0e137c4ccc655ca9e1b9d0e2481bb3d028dc307edc62d2a5190bb081c1b9",
      jsonrpc: "2.0",
      method: "test",
      params: {
        request: {
          method: "personal_sign",
          params: [
            "0x4d7920656d61696c206973206a6f686e40646f652e636f6d202d2031363837393538343737333838",
            "0x7770471b86c6dd889a6D81DA53Fb7eeE1F9a2ba7",
          ],
        },
        chainId: "eip155:5",
      },
    };
    core.history.set(request.topic, request);
    expect(core.history.records.size).to.eq(1);
    const record = core.history.records.get(request.id);
    expect(record).to.not.be.undefined;
    expect(record?.expiry).to.not.be.undefined;
    expect(record?.expiry).to.be.greaterThan(0);
    expect(toMiliseconds(record?.expiry || 0)).to.be.approximately(
      toMiliseconds(calcExpiry(THIRTY_DAYS)),
      10,
    ); // delta ~10ms execution variance

    vi.useFakeTimers();
    vi.advanceTimersByTime(toMiliseconds(calcExpiry(THIRTY_DAYS)));
    // move time forward to force expiry and wait for heartbeat to delete the record
    await new Promise<void>((resolve) => {
      core.history.on(HISTORY_EVENTS.deleted, (record: JsonRpcRecord) => {
        expect(record).to.not.be.undefined;
        expect(record.id).to.eq(request.id);
        resolve();
      });
    });
    vi.useRealTimers();
    expect(core.history.records.size).to.eq(0);
  });
});
